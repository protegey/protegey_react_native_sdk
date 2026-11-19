# @protegey/react-native-sdk

Official Protegey SDK for React Native — device intelligence and behavioral biometrics, plus an
in-app KYC flow so your users never leave your app to verify their identity.

## Install

Not yet published to npm — install directly from GitHub for now (also install its peer
dependencies if you don't already have them: `react-native-webview` for the in-app KYC sheet,
`react-native-device-info` and `@react-native-async-storage/async-storage` for `device.identify()`
to report real device attributes and a visitorId that's stable across app launches):

```bash
npm install git+https://github.com/protegey/protegey_react_native_sdk.git \
  react-native-webview react-native-device-info @react-native-async-storage/async-storage
```

## Usage

```tsx
import { Protegey, ProtegeyKycProvider, useProtegeyKyc } from '@protegey/react-native-sdk';

const protegey = new Protegey({ apiKey: 'YOUR_API_KEY', baseUrl: 'https://api.protegey.com' });

// Wrap your app once, near the root.
export default function App() {
  return (
    <ProtegeyKycProvider>
      <Home />
    </ProtegeyKycProvider>
  );
}

function Home() {
  const { present } = useProtegeyKyc();

  // Device intelligence — call on login / session start.
  await protegey.device.identify({ externalCustomerId: 'cust-9981' });

  // Identity verification — one call starts the session AND shows it in a draggable bottom sheet
  // (drag handle + Close button). The user never leaves your app, and there's no UI code to write
  // for that on your end.
  const status = await present(protegey.kyc, { externalUserId: 'cust-9981' });
  // status?.status === 'APPROVED' | 'DECLINED' | ... — or undefined if closed before one arrived.

  // Behavioral biometrics — aggregated keystroke/touch/navigation metadata only, never raw content
  const behavioral = await protegey.behavioral.report({
    externalCustomerId: 'cust-9981',
    sessionId: 'sess-20260115-01',
    keystroke: { avgInterKeyLatencyMs: 145, typingSpeedCharsPerSec: 4.2, errorRate: 0.02 },
  });
  // behavioral.status === 'LEARNING' for a customer's first 5 sessions — expected, not an error.
}
```

Prefer `ProtegeyKycView` directly only if you need a different presentation than the provided
bottom sheet, or want to drive the polling UI yourself — see its doc comment in `src/KycWebView.tsx`.

## Transactions — report these from your backend, not from this app

`POST /partner-api/transactions` is meant to be called server-to-server, from your own backend,
not from this SDK — it carries the full-privilege API key, and your backend already has the
authoritative transaction data (amount, currency, parties) since it's the one processing it.
Calling `device.identify()` above is this app's actual job: as long as your backend sends the
same `externalCustomerId` when it reports the transaction a few minutes later, Protegey picks up
this device/session signal automatically — nothing to relay yourself. `protegey.transactions`
still exists on the underlying `@protegey/sdk` client for a quick local/sandbox test, but shipping
a real app through it means embedding your secret key in the app bundle, which this package does
nothing to restrict (see Security below) — report transactions from `@protegey/sdk` on your
Node backend, or the PHP/Java SDKs, instead.

## `baseUrl` — no default, on purpose

This package ships inside apps that can't be force-updated the moment Protegey's own API domain
changes. Baking in a guess would risk every already-shipped app silently talking to a stale host
later — so `baseUrl` is required, with no fallback. Confirm the current value with Protegey before
you ship.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

## What this package calls

All requests go to `{baseUrl}/partner-api/...` (no `/api/v1` prefix) with an `x-api-key` header.

| Method | Call | Endpoint |
|---|---|---|
| `device.identify()` | POST | `/partner-api/device-events` |
| `behavioral.report()` | POST | `/partner-api/behavioral-events` |
| `kyc.startSession()` / `useProtegeyKyc().present()` | POST | `/partner-api/kyc/sessions` |
| `kyc.getSession()` (polled by the KYC sheet) | GET | `/partner-api/kyc/sessions/:sessionId` |
| `transactions.report()` (server-side only, see above) | POST | `/partner-api/transactions` |

Every enum value in a response is UPPER_SNAKE_CASE (`status: 'IN_REVIEW'`, `outcome: 'MANUAL'`,
`action: 'SOFT_CHALLENGE'`, `decision: 'BLOCKED'`, alert `status: 'OPEN'`...). The exported
`KycStatus`, `KycSessionStatus`, `Alert` and `ReportTransactionResult` types list the exact values.

`kyc.getSession()` also returns `recommendation` (Protegey's own verdict: `APPROVE` / `REVIEW` /
`REJECT` / `null`, unchanged by a manual override — `status` is the final decision) and `images`
(`documentFront`, `documentBack`, `selfie`, `documentFaceCrop`, each `{ url, expiresAt }` or `null`).
Those pre-signed URLs are valid for one hour and re-issued on every call: display or download them
within the hour, then call `getSession()` again for fresh links — never persist the URL.
Failed calls throw `ProtegeyApiError` with the HTTP `status`, the API's `message`, and an
`errorCode` when the API sends one (`PARTNER_SUSPENDED` / `PARTNER_CONTRACT_REQUIRED`, both 403).

The rest of the partner API (cash deposits, KYB applicants, alerts, sanctions screening, the shared
fraud signal network, KYC session list/update/resend) and webhook signature verification are deliberately not
in this package: they belong on your backend. Use `@protegey/sdk` (Node) or the PHP/Java/.NET SDKs
there.

## Security note

Your API key is used directly from your app — the same key your backend would otherwise use
server-side. Partner API keys aren't scoped: a key extracted from an app bundle can call **every**
partner-api endpoint (approve/reject KYB applicants, update alerts, read KYC sessions including
their photos, report transactions...), not just the device/behavioral/KYC calls this package makes.
Keep it out of source control, and prefer your sandbox key until Protegey offers a restricted
client-side key.
