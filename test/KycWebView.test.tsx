import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, create } from 'react-test-renderer';
import { ProtegeyKycView } from '../src/KycWebView.js';
import type { KycSessionStatus, KycStatus } from '../src/types.js';

// react-native-webview needs a real native runtime — stubbed here since these tests only cover
// the polling side-effect, not actual WebView rendering (that's react-native-webview's own
// responsibility to test, not ours).
vi.mock('react-native-webview', () => ({
  WebView: () => null,
}));

// Wire-exact GET /partner-api/kyc/sessions/:sessionId shape (UPPER_SNAKE_CASE status/outcome).
function session(status: KycStatus, outcome: KycSessionStatus['outcome'] = null): KycSessionStatus {
  return {
    sessionId: 's1',
    externalUserId: 'cust-1',
    status,
    outcome,
    decision: outcome ? { source: 'biometric', outcome } : null,
    fullName: null,
    documentType: null,
    country: null,
    livenessScore: null,
    faceMatchScore: null,
    documentPhoto: null,
    documentBackPhoto: null,
    selfiePhoto: null,
    documentFaceCrop: null,
  };
}

function buildKyc(statuses: KycSessionStatus[]) {
  let call = 0;
  return { getSession: vi.fn(async () => statuses[Math.min(call++, statuses.length - 1)]) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('ProtegeyKycView', () => {
  it('polls kyc.getSession on an interval and reports only status changes', async () => {
    const kyc = buildKyc([
      session('IN_PROGRESS'),
      session('IN_PROGRESS'),
      session('APPROVED', 'SUCCESS'),
    ]);
    const onStatusChange = vi.fn();

    act(() => {
      create(
        <ProtegeyKycView kyc={kyc as never} sessionId="s1" url="https://kyc.example.com/?enrollmentId=s1&token=t" onStatusChange={onStatusChange} pollIntervalMs={1000} />,
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // IN_PROGRESS — first report
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // IN_PROGRESS again — no new call, unchanged
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // APPROVED — second report
    });

    expect(kyc.getSession).toHaveBeenCalledTimes(3);
    expect(onStatusChange).toHaveBeenCalledTimes(2);
    expect(onStatusChange).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: 'IN_PROGRESS' }));
    expect(onStatusChange).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: 'APPROVED', outcome: 'SUCCESS' }));
  });

  it('stops polling once unmounted', async () => {
    const kyc = buildKyc([session('IN_PROGRESS')]);
    const onStatusChange = vi.fn();

    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <ProtegeyKycView kyc={kyc as never} sessionId="s1" url="https://kyc.example.com/?enrollmentId=s1&token=t" onStatusChange={onStatusChange} pollIntervalMs={1000} />,
      );
    });
    act(() => tree.unmount());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(kyc.getSession).not.toHaveBeenCalled();
  });
});
