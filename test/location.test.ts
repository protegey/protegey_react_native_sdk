import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rn = vi.hoisted(() => ({
  Platform: { OS: 'android' as 'android' | 'ios' },
  granted: new Set<string>(),
  requestResult: 'denied',
}));

vi.mock('react-native', () => ({
  Platform: rn.Platform,
  PermissionsAndroid: {
    PERMISSIONS: { ACCESS_FINE_LOCATION: 'fine', ACCESS_COARSE_LOCATION: 'coarse' },
    RESULTS: { GRANTED: 'granted', DENIED: 'denied', NEVER_ASK_AGAIN: 'never_ask_again' },
    check: vi.fn(async (permission: string) => rn.granted.has(permission)),
    requestMultiple: vi.fn(async (permissions: string[]) =>
      Object.fromEntries(permissions.map((p) => [p, rn.requestResult])),
    ),
  },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => 'rn-stable-id'), setItem: vi.fn(async () => undefined) },
}));
vi.mock('react-native-device-info', () => ({
  isEmulator: async () => false,
  getTotalMemory: async () => 0,
  getManufacturer: async () => 'Google',
  getTotalDiskCapacity: async () => 0,
  getFreeDiskStorage: async () => 0,
  getBatteryLevel: async () => 0.5,
  isBatteryCharging: async () => false,
  getSystemVersion: () => '14',
  getModel: () => 'Pixel 8',
  getVersion: () => '1.0.0',
}));

const { RNLocationModule } = await import('../src/location.js');
const { Protegey } = await import('../src/ProtegeyClient.js');
const { PermissionsAndroid } = await import('react-native');

const fix = { coords: { latitude: 14.6928, longitude: -17.4467, accuracy: 8 }, timestamp: Date.parse('2026-11-27T09:30:00.000Z') };

function expo(overrides: Record<string, unknown> = {}) {
  return {
    getForegroundPermissionsAsync: vi.fn(async () => ({ status: 'granted', canAskAgain: true })),
    requestForegroundPermissionsAsync: vi.fn(async () => ({ status: 'granted' })),
    getCurrentPositionAsync: vi.fn(async () => ({ ...fix, mocked: false })),
    getLastKnownPositionAsync: vi.fn(async () => null),
    hasServicesEnabledAsync: vi.fn(async () => true),
    Accuracy: { High: 4, Balanced: 3 },
    ...overrides,
  };
}

function navigatorGeo(impl?: (success: (p: unknown) => void, error: (e: unknown) => void, options?: Record<string, unknown>) => void) {
  return { getCurrentPosition: vi.fn(impl ?? ((success: (p: unknown) => void) => success(fix))) };
}

const device = () => ({ identify: vi.fn(async () => ({ recorded: true, action: 'ALLOW', riskScore: 0, visitorId: 'v' }) as never) });

beforeEach(() => {
  rn.Platform.OS = 'android';
  rn.granted.clear();
  rn.requestResult = 'denied';
  vi.mocked(PermissionsAndroid.requestMultiple).mockClear();
  vi.mocked(PermissionsAndroid.check).mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe('RNLocationModule — expo-location', () => {
  it('reads the position when already granted, high accuracy by default', async () => {
    const module = expo();
    const location = await new RNLocationModule(device(), module).current();
    expect(location).toEqual({
      latitude: 14.6928,
      longitude: -17.4467,
      accuracyMeters: 8,
      capturedAt: '2026-11-27T09:30:00.000Z',
      isMocked: false,
    });
    expect(module.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 4 });
    expect(module.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('uses Balanced accuracy when highAccuracy is false', async () => {
    const module = expo();
    await new RNLocationModule(device(), module).current({ highAccuracy: false });
    expect(module.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 3 });
  });

  it('never prompts by default when undetermined', async () => {
    const module = expo({ getForegroundPermissionsAsync: vi.fn(async () => ({ status: 'undetermined', canAskAgain: true })) });
    expect(await new RNLocationModule(device(), module).current()).toBeNull();
    expect(module.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(module.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('prompts with requestPermission, but never re-asks a permanent denial', async () => {
    const undecided = expo({ getForegroundPermissionsAsync: vi.fn(async () => ({ status: 'undetermined', canAskAgain: true })) });
    expect((await new RNLocationModule(device(), undecided).current({ requestPermission: true }))?.latitude).toBe(14.6928);
    expect(undecided.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);

    const blocked = expo({ getForegroundPermissionsAsync: vi.fn(async () => ({ status: 'denied', canAskAgain: false })) });
    expect(await new RNLocationModule(device(), blocked).current({ requestPermission: true })).toBeNull();
    expect(blocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns null when location services are off', async () => {
    const module = expo({ hasServicesEnabledAsync: vi.fn(async () => false) });
    expect(await new RNLocationModule(device(), module).current()).toBeNull();
  });

  it('falls back to the last known position when no fresh fix arrives in time', async () => {
    const module = expo({
      getCurrentPositionAsync: vi.fn(() => new Promise(() => undefined)),
      getLastKnownPositionAsync: vi.fn(async () => ({ ...fix, mocked: true })),
    });
    const location = await new RNLocationModule(device(), module).current({ timeoutMs: 10 });
    expect(location).toMatchObject({ latitude: 14.6928, isMocked: true });
  });

  it('never throws', async () => {
    const module = expo({ getForegroundPermissionsAsync: vi.fn(async () => Promise.reject(new Error('native'))) });
    await expect(new RNLocationModule(device(), module).current()).resolves.toBeNull();
  });
});

describe('RNLocationModule — navigator-style module (@react-native-community/geolocation)', () => {
  it('Android: reads only when the permission is already granted, without prompting', async () => {
    const geo = navigatorGeo();
    expect(await new RNLocationModule(device(), geo).current()).toBeNull();
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled();

    rn.granted.add('coarse');
    const location = await new RNLocationModule(device(), geo).current();
    expect(location).toMatchObject({ latitude: 14.6928, accuracyMeters: 8 });
    expect(geo.getCurrentPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: true, timeout: 1500, maximumAge: 0 });
  });

  it('Android: requests the permission when asked', async () => {
    rn.requestResult = 'granted';
    const geo = navigatorGeo();
    expect((await new RNLocationModule(device(), geo).current({ requestPermission: true }))?.latitude).toBe(14.6928);
    expect(PermissionsAndroid.requestMultiple).toHaveBeenCalledWith(['fine', 'coarse']);
  });

  it('falls back to the cached position on timeout', async () => {
    rn.granted.add('fine');
    const geo = navigatorGeo((success, error, options) => {
      if (options?.maximumAge === Infinity) success({ ...fix, coords: { ...fix.coords, latitude: 1 } });
      else error({ code: 3 });
    });
    expect((await new RNLocationModule(device(), geo).current())?.latitude).toBe(1);
  });

  it('iOS: leaves authorization to the module and reads', async () => {
    rn.Platform.OS = 'ios';
    const geo = navigatorGeo();
    expect((await new RNLocationModule(device(), geo).current())?.longitude).toBe(-17.4467);
    expect(PermissionsAndroid.check).not.toHaveBeenCalled();
  });

  it('uses a navigator.geolocation polyfill when no module is given', async () => {
    rn.granted.add('fine');
    vi.stubGlobal('navigator', { geolocation: navigatorGeo() });
    expect((await new RNLocationModule(device()).current())?.latitude).toBe(14.6928);
  });

  it('returns null without any geolocation module', async () => {
    vi.stubGlobal('navigator', { product: 'ReactNative' });
    expect(await new RNLocationModule(device()).current()).toBeNull();
  });
});

describe('Protegey.location.update (React Native)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('sends the position with device.identify (stable visitorId) and resolves to it', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ recorded: true, action: 'ALLOW', riskScore: 0 }), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    );
    const protegey = new Protegey({ apiKey: 'test-key', baseUrl: 'https://api.example.test', geolocation: expo() });
    const sent = await protegey.location.update({ externalCustomerId: 'cust-1' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(url).toBe('https://api.example.test/partner-api/device-events');
    expect(body).toMatchObject({ externalCustomerId: 'cust-1', visitorId: 'rn-stable-id', location: sent });
    expect(sent?.latitude).toBe(14.6928);
  });

  it('sends nothing and resolves to null without a position', async () => {
    vi.stubGlobal('navigator', undefined);
    const protegey = new Protegey({ apiKey: 'test-key', baseUrl: 'https://api.example.test' });
    expect(await protegey.location.update({ externalCustomerId: 'cust-1' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws when the API call fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }));
    const protegey = new Protegey({ apiKey: 'bad', baseUrl: 'https://api.example.test', geolocation: expo() });
    await expect(protegey.location.update({ externalCustomerId: 'cust-1' })).resolves.toBeNull();
  });
});
