import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Native modules stubbed — these tests only check what goes over the wire.
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (k: string) => store.get(k) ?? null),
      setItem: vi.fn(async (k: string, v: string) => void store.set(k, v)),
    },
  };
});
vi.mock('react-native-device-info', () => ({
  isEmulator: async () => false,
  getTotalMemory: async () => 4 * 1024 * 1024 * 1024,
  getManufacturer: async () => 'Google',
  getTotalDiskCapacity: async () => 64 * 1024 * 1024 * 1024,
  getFreeDiskStorage: async () => 32 * 1024 * 1024 * 1024,
  getBatteryLevel: async () => 0.42,
  isBatteryCharging: async () => true,
  getSystemVersion: () => '14',
  getModel: () => 'Pixel 8',
  getVersion: () => '1.0.0',
}));

const { Protegey } = await import('../src/ProtegeyClient.js');

const fetchMock = vi.fn();

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, method: init.method, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(init.body as string) : undefined };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const protegey = new Protegey({ apiKey: 'test-key', baseUrl: 'https://dev-api.protegey.com/' });

describe('Protegey (React Native) — partner-api wire contract', () => {
  it('device.identify() → POST /partner-api/device-events with x-api-key, a stable visitorId and native attributes', async () => {
    respond(201, { recorded: true, action: 'SOFT_CHALLENGE', riskScore: 15 });
    const first = await protegey.device.identify({ externalCustomerId: 'cust-1' });
    const call = lastCall();

    expect(call.url).toBe('https://dev-api.protegey.com/partner-api/device-events');
    expect(call.method).toBe('POST');
    expect(call.headers['x-api-key']).toBe('test-key');
    expect(call.body).toMatchObject({
      externalCustomerId: 'cust-1',
      visitorId: first.visitorId,
      deviceAttributes: { platform: 'Android', deviceModel: 'Pixel 8', manufacturer: 'Google', batteryLevel: 42, isCharging: true, totalMemoryMb: 4096 },
    });
    expect(typeof call.body.eventId).toBe('string');
    expect(first).toEqual({ recorded: true, action: 'SOFT_CHALLENGE', riskScore: 15, visitorId: first.visitorId });

    respond(201, { recorded: true, action: 'ALLOW', riskScore: 0 });
    const second = await protegey.device.identify({ externalCustomerId: 'cust-1' });
    expect(second.visitorId).toBe(first.visitorId);
  });

  it('kyc.startSession() → POST /partner-api/kyc/sessions', async () => {
    respond(201, { sessionId: 'enr-1', url: 'https://kyc.example.com/?enrollmentId=enr-1&token=t' });
    const result = await protegey.kyc.startSession({ externalUserId: 'user-1', phone: '+237690000000' });

    expect(lastCall()).toMatchObject({
      url: 'https://dev-api.protegey.com/partner-api/kyc/sessions',
      method: 'POST',
      body: { externalUserId: 'user-1', phone: '+237690000000' },
    });
    expect(result.sessionId).toBe('enr-1');
  });

  it('kyc.getSession() → GET /partner-api/kyc/sessions/:sessionId (URL-encoded)', async () => {
    respond(200, { sessionId: 'a/b', status: 'IN_REVIEW', outcome: 'MANUAL' });
    const result = await protegey.kyc.getSession('a/b');

    expect(lastCall()).toMatchObject({ url: 'https://dev-api.protegey.com/partner-api/kyc/sessions/a%2Fb', method: 'GET' });
    expect(result.status).toBe('IN_REVIEW');
  });

  it('behavioral.report() → POST /partner-api/behavioral-events', async () => {
    respond(201, { status: 'LEARNING', deviationScore: 0, confidenceTier: null, stepUpRecommended: false, escalatedAlertId: null });
    const result = await protegey.behavioral.report({ externalCustomerId: 'cust-1', sessionId: 'sess-1', session: { loginHourBucket: 9 } });

    expect(lastCall()).toMatchObject({
      url: 'https://dev-api.protegey.com/partner-api/behavioral-events',
      method: 'POST',
      body: { externalCustomerId: 'cust-1', sessionId: 'sess-1', session: { loginHourBucket: 9 } },
    });
    expect(result.status).toBe('LEARNING');
  });

  it('transactions.report() → POST /partner-api/transactions, defaulting occurredAt', async () => {
    respond(201, { transactionId: 't-1', decision: 'REVIEW', riskScore: 20, deviceAction: null, alerts: [] });
    const result = await protegey.transactions.report({
      externalTransactionId: 'tx-1',
      externalCustomerId: 'cust-1',
      direction: 'DEBIT',
      amount: 15000,
      transactionType: 'transfer',
    });

    const call = lastCall();
    expect(call.url).toBe('https://dev-api.protegey.com/partner-api/transactions');
    expect(typeof call.body.occurredAt).toBe('string');
    expect(result.decision).toBe('REVIEW');
  });

  it('surfaces partner-api errors as ProtegeyApiError with the status code', async () => {
    respond(404, { statusCode: 404, message: 'Session not found', error: 'Not Found' });
    await expect(protegey.kyc.getSession('missing')).rejects.toMatchObject({ name: 'ProtegeyApiError', status: 404, message: 'Session not found' });
  });
});
