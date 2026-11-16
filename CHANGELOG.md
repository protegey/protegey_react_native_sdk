## 0.2.0

- Fix: bump the `@protegey/sdk` git dependency to its current `main` (v0.6.0) — this SDK's own
  `fix: match partner-api's UPPER_SNAKE_CASE status values` release never actually moved the
  dependency pin, so the UPPER_SNAKE_CASE types it re-exports (`DeviceAction`, etc.) were still
  stale until now. Also picks up `CustomerSegment`, the expanded `KycSessionStatus` fields, and
  `StartKycSessionInput.email`/`phone`.
- Feat: `device.identify()` now collects `totalStorageMb`/`freeStorageMb` via
  `react-native-device-info`, and sends `manufacturer`/`batteryLevel`/`isCharging` as proper typed
  `DeviceAttributes` fields instead of an unsound cast (now that `@protegey/sdk` v0.6.0 types them
  itself). `isVpnActive` is left uncollected — `react-native-device-info` has no VPN-detection API.
- Feat: `useProtegeyKyc().present()` now accepts optional `email`/`phone`, passed through to
  `kyc.startSession()` for Protegey's cross-partner identity-resolution matching.
- Fix: re-export `TransactionChannel` and `CustomerSegment` from `src/index.ts` — both were missing
  even though `ReportTransactionInput` uses them.
- Docs: fixed stale pre-rollout casing in the README's example comments (`'Approved'`/`'Declined'`
  → `'APPROVED'`/`'DECLINED'`, `'learning'` → `'LEARNING'`), and corrected `ProtegeyKycView`'s doc
  comment — the hosted capture flow is Protegey's own FaceTec-hosted `facetec-web` app, not a
  third-party ("Didit") redirect.

## 0.1.2

- Docs: clarified that `transactions.report()` isn't the recommended way to report a transaction
  from a shipped app — that call belongs server-to-server, from your own backend, now that
  Protegey auto-links a `device.identify()` signal to a later transaction by `externalCustomerId`
  alone (no `visitorId` relay needed). No code change; `protegey.transactions` still works.

## 0.1.1

- Fix: `device.identify()` now works correctly out of the box. The base `@protegey/sdk`'s
  fingerprinting is browser-only (canvas/WebGL) — with no DOM in React Native, used directly it
  silently fell back to a fresh random `visitorId` with **empty device attributes** on every call,
  so device signals never correlated and transactions showed no enriched device data. `Protegey`
  now wraps `.device` with an RN-native implementation: a visitorId persisted across app launches
  via `@react-native-async-storage/async-storage`, and real attributes (model, manufacturer, OS
  version, battery, emulator detection, ...) collected via `react-native-device-info`.
- New peer dependencies: `react-native-device-info`, `@react-native-async-storage/async-storage`.
- `transactions`/`kyc`/`behavioral` are unchanged — their HTTP calls already worked fine in React
  Native.

## 0.1.0

- Initial release.
- Re-exports `@protegey/sdk` (device, transactions, kyc, behavioral) as-is.
- `ProtegeyKycView` — low-level in-app KYC webview widget.
- `ProtegeyKycProvider` / `useProtegeyKyc()` — one-call KYC integration: starts a session and shows
  it in a draggable bottom sheet automatically, no UI code needed on the partner's end.
