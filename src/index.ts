/**
 * @protegey/react-native-sdk — everything `@protegey/sdk` offers (device intelligence, transaction
 * reporting, identity verification, behavioral biometrics), plus an in-app KYC flow and a
 * React-Native-native `device.identify()` (a stable visitorId persisted via AsyncStorage, and
 * real device attributes collected via react-native-device-info — the base SDK has no DOM to
 * fingerprint here, so used directly it falls back to a fresh random id with no attributes on
 * every call; see ./device.ts):
 *
 * ```tsx
 * <ProtegeyKycProvider><App /></ProtegeyKycProvider> // once, near your app's root
 *
 * const protegey = new Protegey({ apiKey, baseUrl });
 * await protegey.device.identify({ externalCustomerId }); // stable visitorId + real attributes
 *
 * const { present } = useProtegeyKyc();
 * const status = await present(protegey.kyc, { externalUserId }); // shows the sheet, no UI code needed
 * ```
 *
 * Reach for the lower-level `ProtegeyKycView` directly only if you need a different presentation
 * than the provided bottom sheet, or want to drive the polling UI yourself.
 */
export { ProtegeyApiError } from '@protegey/sdk';
export type {
  DeviceAttributes,
  DeviceAction,
  IdentifyInput,
  IdentifyResult,
  ReportTransactionInput,
  ReportTransactionResult,
  TransactionDirection,
  ProtegeyOptions,
  Alert,
  StartKycSessionInput,
  StartKycSessionResult,
  KycSessionStatus,
  KeystrokeMetrics,
  TouchMetrics,
  NavigationMetrics,
  SessionMetrics,
  ReportBehavioralEventInput,
  ReportBehavioralEventResult,
  BehavioralConfidenceTier,
} from '@protegey/sdk';
export { Protegey } from './ProtegeyClient.js';
export { RNDeviceModule } from './device.js';
export { ProtegeyKycView } from './KycWebView.js';
export type { ProtegeyKycViewProps } from './KycWebView.js';
export { ProtegeyKycProvider, useProtegeyKyc } from './KycProvider.js';
