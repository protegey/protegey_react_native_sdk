import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, create } from 'react-test-renderer';
import { ProtegeyKycView } from '../src/KycWebView.js';
import type { KycSessionStatus } from '@protegey/sdk';

// react-native-webview needs a real native runtime — stubbed here since these tests only cover
// the polling side-effect, not actual WebView rendering (that's react-native-webview's own
// responsibility to test, not ours).
vi.mock('react-native-webview', () => ({
  WebView: () => null,
}));

function buildKyc(statuses: KycSessionStatus[]) {
  let call = 0;
  return { getSession: vi.fn(async () => statuses[Math.min(call++, statuses.length - 1)]) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('ProtegeyKycView', () => {
  it('polls kyc.getSession on an interval and reports only status changes', async () => {
    const kyc = buildKyc([
      { sessionId: 's1', externalUserId: 'cust-1', status: 'pending', decision: null },
      { sessionId: 's1', externalUserId: 'cust-1', status: 'pending', decision: null },
      { sessionId: 's1', externalUserId: 'cust-1', status: 'Approved', decision: { outcome: 'pass' } },
    ]);
    const onStatusChange = vi.fn();

    act(() => {
      create(
        <ProtegeyKycView kyc={kyc as never} sessionId="s1" url="https://verify.didit.me/session/s1" onStatusChange={onStatusChange} pollIntervalMs={1000} />,
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // pending — first report
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // pending again — no new call, unchanged
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // Approved — second report
    });

    expect(kyc.getSession).toHaveBeenCalledTimes(3);
    expect(onStatusChange).toHaveBeenCalledTimes(2);
    expect(onStatusChange).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: 'pending' }));
    expect(onStatusChange).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: 'Approved' }));
  });

  it('stops polling once unmounted', async () => {
    const kyc = buildKyc([{ sessionId: 's1', externalUserId: 'cust-1', status: 'pending', decision: null }]);
    const onStatusChange = vi.fn();

    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <ProtegeyKycView kyc={kyc as never} sessionId="s1" url="https://verify.didit.me/session/s1" onStatusChange={onStatusChange} pollIntervalMs={1000} />,
      );
    });
    act(() => tree.unmount());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(kyc.getSession).not.toHaveBeenCalled();
  });
});
