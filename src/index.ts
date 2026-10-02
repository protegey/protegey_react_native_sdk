/**
 * @protegey/react-native-sdk — everything `@protegey/sdk` offers (device intelligence, transaction
 * reporting, identity verification, behavioral biometrics), re-exported as-is since its fetch-based
 * HTTP client already runs fine in React Native, plus an in-app KYC flow:
 *
 * ```tsx
 * <ProtegeyKycProvider><App /></ProtegeyKycProvider> // once, near your app's root
 *
 * const { present } = useProtegeyKyc();
 * const status = await present(protegey.kyc, { externalUserId }); // shows the sheet, no UI code needed
 * ```
 *
 * Reach for the lower-level `ProtegeyKycView` directly only if you need a different presentation
 * than the provided bottom sheet, or want to drive the polling UI yourself.
 */
export * from '@protegey/sdk';
export { ProtegeyKycView } from './KycWebView.js';
export type { ProtegeyKycViewProps } from './KycWebView.js';
export { ProtegeyKycProvider, useProtegeyKyc } from './KycProvider.js';
