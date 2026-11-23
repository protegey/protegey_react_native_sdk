import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import type { LivenessSession } from '@protegey/sdk';
import type { LivenessModule } from './types.js';

interface PresentLivenessOptions {
  /** `LIVENESS` (default): a selfie-only 3D liveness check. `REVERIFICATION`: liveness, then a match
   * against the face of the customer's latest KYC verification under `externalUserId`. */
  mode?: 'LIVENESS' | 'REVERIFICATION';
  externalUserId?: string;
}

interface LivenessContextValue {
  /** Starts a session and shows the capture sheet; resolves with the final session once it is
   * COMPLETED or EXPIRED, or `undefined` if the user closed the sheet first. Rejects with a
   * `ProtegeyApiError` (`errorCode` `NO_3D_ENROLLMENT`) for a reverification of someone with no
   * 3D record (KYC). */
  present: (liveness: LivenessModule, options?: PresentLivenessOptions) => Promise<LivenessSession | undefined>;
}

const LivenessContext = createContext<LivenessContextValue | null>(null);

interface ActiveSession {
  liveness: LivenessModule;
  sessionId: string;
  url: string;
  resolve: (session?: LivenessSession) => void;
}

/** Leaves the capture page's own "done" screen visible a moment before closing the sheet. */
const CLOSE_DELAY_MS = 4000;

/**
 * Same bottom-sheet presentation as `ProtegeyKycProvider`, for the separate 3D liveness product.
 * The capture page never shows the end user the match result — read it from the resolved session
 * (`livenessProven`, `matched`).
 */
export function ProtegeyLivenessProvider({ children, pollIntervalMs = 3000 }: { children: ReactNode; pollIntervalMs?: number }) {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const { height: windowHeight } = useWindowDimensions();
  const sessionRef = useRef<ActiveSession | null>(null);
  sessionRef.current = session;

  const present = useCallback((liveness: LivenessModule, { mode = 'LIVENESS', externalUserId }: PresentLivenessOptions = {}) => {
    return new Promise<LivenessSession | undefined>((resolve, reject) => {
      const start =
        mode === 'REVERIFICATION'
          ? liveness.startReverification({ externalUserId: externalUserId ?? '' })
          : liveness.startSession({ externalUserId });
      start.then(({ sessionId, url }) => setSession({ liveness, sessionId, url, resolve })).catch(reject);
    });
  }, []);

  const close = useCallback((result?: LivenessSession) => {
    sessionRef.current?.resolve(result);
    setSession(null);
  }, []);

  useEffect(() => {
    if (!session) return;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(async () => {
      try {
        const current = await session.liveness.getSession(session.sessionId);
        if (current.status !== 'PENDING' && !closeTimer) {
          clearInterval(timer);
          closeTimer = setTimeout(() => close(current), CLOSE_DELAY_MS);
        }
      } catch {
        // Transient network error — the next tick retries.
      }
    }, pollIntervalMs);
    return () => {
      clearInterval(timer);
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, [session, pollIntervalMs, close]);

  return (
    <LivenessContext.Provider value={{ present }}>
      {children}
      <Modal visible={session !== null} animationType="slide" transparent onRequestClose={() => close()}>
        {session && (
          <View style={styles.backdrop}>
            <SafeAreaView style={[styles.sheet, { height: windowHeight * 0.95 }]}>
              <View style={styles.dragHandle} />
              <View style={styles.header}>
                <TouchableOpacity onPress={() => close()}>
                  <Text style={styles.close}>Close</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Liveness check…</Text>
                <View style={styles.spacer} />
              </View>
              <WebView
                source={{ uri: session.url }}
                style={{ flex: 1 }}
                nestedScrollEnabled
                overScrollMode="always"
              />
            </SafeAreaView>
          </View>
        )}
      </Modal>
    </LivenessContext.Provider>
  );
}

export function useProtegeyLiveness(): LivenessContextValue {
  const ctx = useContext(LivenessContext);
  if (!ctx) {
    throw new Error('useProtegeyLiveness() must be called from a descendant of <ProtegeyLivenessProvider>');
  }
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  sheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#00000040', alignSelf: 'center', marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  close: { color: '#007AFF' },
  title: { fontWeight: '600' },
  spacer: { width: 48 },
});
