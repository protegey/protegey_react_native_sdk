import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import type { Protegey, KycSessionStatus } from '@protegey/sdk';
import { ProtegeyKycView } from './KycWebView.js';

interface PresentOptions {
  externalUserId: string;
}

interface KycContextValue {
  /** Starts a session AND shows it in a draggable sheet — no UI code needed on your end. Resolves
   * with the final status once the sheet is dismissed (by completion, or by the user swiping/
   * tapping Close); resolves `undefined` if closed before a status arrived. */
  present: (kyc: Protegey['kyc'], options: PresentOptions) => Promise<KycSessionStatus | undefined>;
}

const KycContext = createContext<KycContextValue | null>(null);

/** Statuses where verification has genuinely concluded (one way or another) — every other known
 * status ('Not Started', 'In Progress', 'Awaiting User', 'In Review', 'Resubmitted') means the
 * user may still be actively completing the flow inside the webview, so the sheet must stay open.
 * 'In Progress' in particular is the status every fresh session starts in, so treating it as
 * terminal (the previous check did, by only excluding 'pending'/'Not Started') closed the sheet
 * within the first poll tick. */
const TERMINAL_KYC_STATUSES = new Set(['Approved', 'Declined', 'Abandoned', 'Expired', 'Kyc Expired']);

interface ActiveSession {
  kyc: Protegey['kyc'];
  sessionId: string;
  url: string;
  resolve: (status?: KycSessionStatus) => void;
}

/** Wrap your app once with this — it renders the KYC sheet (hidden until `present()` is called) as
 * a sibling of your actual app content, the same pattern React Navigation / most modal-provider
 * libraries use. Everything under it can call `useProtegeyKyc()`. */
export function ProtegeyKycProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const { height: windowHeight } = useWindowDimensions();

  const present = useCallback((kyc: Protegey['kyc'], { externalUserId }: PresentOptions) => {
    return new Promise<KycSessionStatus | undefined>((resolve, reject) => {
      kyc
        .startSession({ externalUserId })
        .then(({ sessionId, url }) => setSession({ kyc, sessionId, url, resolve }))
        .catch(reject);
    });
  }, []);

  function close(status?: KycSessionStatus) {
    session?.resolve(status);
    setSession(null);
  }

  return (
    <KycContext.Provider value={{ present }}>
      {children}
      {/* transparent + a bottom-anchored, height-capped sheet gives the same ~80%-of-screen
          bottom sheet on both platforms — presentationStyle="pageSheet" alone doesn't cap height
          at all on Android (full-screen slide) and isn't a reliable cap on iOS either. */}
      <Modal visible={session !== null} animationType="slide" transparent onRequestClose={() => close()}>
        {session && (
          <View style={styles.backdrop}>
            <SafeAreaView style={[styles.sheet, { height: windowHeight * 0.8 }]}>
              <View style={styles.dragHandle} />
              <View style={styles.header}>
                <TouchableOpacity onPress={() => close()}>
                  <Text style={styles.close}>Close</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Verifying your identity…</Text>
                <View style={styles.spacer} />
              </View>
              <ProtegeyKycView
                kyc={session.kyc}
                sessionId={session.sessionId}
                url={session.url}
                onStatusChange={(status) => {
                  if (TERMINAL_KYC_STATUSES.has(status.status)) {
                    close(status); // done — closes the sheet on its own
                  }
                }}
              />
            </SafeAreaView>
          </View>
        )}
      </Modal>
    </KycContext.Provider>
  );
}

export function useProtegeyKyc(): KycContextValue {
  const ctx = useContext(KycContext);
  if (!ctx) {
    throw new Error('useProtegeyKyc() must be called from a descendant of <ProtegeyKycProvider>');
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
