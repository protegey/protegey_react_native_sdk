## 0.4.0

- Chore: bump the `@protegey/sdk` git dependency from `3acdf00` (v0.7.0) to `784e71f` (v0.8.0).
- Types: `kyc.getSession()` now returns `recommendation` (`KycRecommendation`: `APPROVE` | `REVIEW` |
  `REJECT` | `null`) and `images` (`KycSessionImages` — pre-signed `{ url, expiresAt }` links valid
  1 hour, re-issued on every call). `KycManualReview.previousStatus` / `newStatus` are UPPER_SNAKE_CASE.
  Re-exports `KycRecommendation`, `KycPresignedImage` and `KycSessionImages`.
- Cash deposits (`/partner-api/cash-deposits`) are server-to-server: use `@protegey/sdk`'s
  `cashDeposits` from your backend — not exposed by this package's client.

## 0.3.1

- Chore: bump the `@protegey/sdk` git dependency from `ca93963` (v0.6.0) to `3acdf00` (v0.7.0),
  which now ships the wire-exact partner-api types itself, `ProtegeyApiError.errorCode`
  (`PARTNER_SUSPENDED` / `PARTNER_CONTRACT_REQUIRED`) and corrected webhook-retry docs.
- Refactor: `KycStatus`, `KycSessionStatus`, `Alert`, `ReportTransactionResult`,
  `TransactionDecision`, `AlertStatus`, `AlertDisposition` and `AlertDecisionVerdict` are now
  re-exported from `@protegey/sdk` instead of being duplicated here. `AlertRuleSeverity` stays as an
  alias of the base SDK's `RuleSeverity`. `KycModule` / `TransactionsModule` are now `Pick`s of the
  base modules (still only `startSession`/`getSession` and `report`), so no casts are needed.
- Types: `transactions.report()`'s `alerts` is now `Array<Alert | AlertWithContext>` (the
  device-signal alert's extra fields moved to `AlertWithContext`), and `KycSessionStatus.decision`
  is the typed `KycDecision`. Also re-exports `KycDecision`, `KycManualReview`, `AlertWithContext`,
  `AlertTransactionSnapshot` and `RuleSeverity`.

## 0.3.0

Audited against the current partner API (protegey-backend `prod`, 2026-11-18). Routes, auth
header, request bodies and the device/behavioral/KYC-start responses were already correct; the
fixes are in the response typings:

- Fix: `KycSessionStatus.status` is now the exact `KycStatus` union (`NOT_STARTED`, `IN_PROGRESS`,
  `AWAITING_USER`, `IN_REVIEW`, `APPROVED`, `DECLINED`, `RESUBMITTED`, `ABANDONED`, `EXPIRED`,
  `KYC_EXPIRED`) instead of `string`. `useProtegeyKyc().present()` and `ProtegeyKycView`'s
  `onStatusChange` use it.
- Fix: `Alert` (in `transactions.report()`'s `alerts[]`) now models the real alert object —
  `status` (`OPEN`/`CONFIRMED`/`MORE_INFO_REQUESTED`/`DISMISSED`), `decisionVerdict`
  (`BLOCK`/`STEP_UP`/`ESCALATE`/`ALERT`), `disposition`, `alertNumber`, `triggeredAt`,
  `matchedValues`..., plus the context fields of a device-signal alert — instead of an open bag.
  `ReportTransactionResult` uses it; new exported types `AlertStatus`, `AlertDisposition`,
  `AlertDecisionVerdict`, `AlertRuleSeverity`, `TransactionDecision`, `KycModule`,
  `TransactionsModule`.
- Breaking (types only): `ProtegeyKycView`'s `kyc` prop and `present()`'s first argument are typed
  as this package's `KycModule`. Pass `protegey.kyc` from this package's `Protegey`, as before.
- Tests: wire-contract tests for every call (path, method, `x-api-key`, body); KYC view fixtures use
  real response shapes.
- Docs: README lists the exact endpoints called, and the security note now spells out that an
  embedded key can call every partner-api endpoint.

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
  comment — the hosted capture flow is Protegey's own hosted identity verification app, not a
  third-party ("provider") redirect.

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
