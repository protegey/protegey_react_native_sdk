import { useEffect, useRef } from 'react';
import { WebView } from 'react-native-webview';
import type { Protegey, KycSessionStatus } from '@protegey/sdk';

export interface ProtegeyKycViewProps {
  /** Pass `protegey.kyc` from your own `Protegey` instance. */
  kyc: Protegey['kyc'];
  /** From `kyc.startSession()`'s result. */
  sessionId: string;
  /** From `kyc.startSession()`'s result. */
  url: string;
  onStatusChange: (status: KycSessionStatus) => void;
  pollIntervalMs?: number;
}

/**
 * Shows the Didit-hosted KYC flow inside the host app — the end user never leaves the partner's
 * app. Didit is a third party Protegey doesn't control the completion redirect of, so this doesn't
 * watch navigation: it polls `kyc.getSession()` in the background (the same best-effort polling
 * fallback `@protegey/sdk` already documents) and reports every status change via
 * `onStatusChange`. The host app decides what counts as "done" and closes/pops this view itself —
 * it's a bare `<WebView>` with no header of its own, so you control your own chrome.
 */
export function ProtegeyKycView({ kyc, sessionId, url, onStatusChange, pollIntervalMs = 3000 }: ProtegeyKycViewProps) {
  const lastStatusRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const status = await kyc.getSession(sessionId);
        if (status.status !== lastStatusRef.current) {
          lastStatusRef.current = status.status;
          onStatusChange(status);
        }
      } catch {
        // Transient network error — next tick retries, same best-effort spirit as the rest of the
        // SDK's polling fallback.
      }
    }, pollIntervalMs);
    return () => clearInterval(timer);
  }, [kyc, sessionId, onStatusChange, pollIntervalMs]);

  return <WebView source={{ uri: url }} style={{ flex: 1 }} />;
}
