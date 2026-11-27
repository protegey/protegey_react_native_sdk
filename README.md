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
import {
  NO_3D_ENROLLMENT,
  Protegey,
  ProtegeyApiError,
  ProtegeyKycProvider,
  ProtegeyLivenessProvider,
  useProtegeyKyc,
  useProtegeyLiveness,
} from '@protegey/react-native-sdk';

const protegey = new Protegey({ apiKey: 'YOUR_API_KEY', baseUrl: 'https://api.protegey.com' });

// Wrap your app once, near the root.
export default function App() {
  return (
    <ProtegeyKycProvider>
      <ProtegeyLivenessProvider>
        <Home />
      </ProtegeyLivenessProvider>
    </ProtegeyKycProvider>
  );
}

function Home() {
  const { present } = useProtegeyKyc();
  const { present: presentLiveness } = useProtegeyLiveness();

  // Device intelligence — call on login / session start.
  await protegey.device.identify({ externalCustomerId: 'cust-9981' });

  // Identity verification — one call starts the session AND shows it in a draggable bottom sheet
  // (drag handle + Close button). The user never leaves your app, and there's no UI code to write
  // for that on your end.
  const status = await present(protegey.kyc, { externalUserId: 'cust-9981' });
  // status?.status === 'APPROVED' | 'DECLINED' | ... — or undefined if closed before one arrived.

  // 3D liveness — a separate, paid product (KYC above is unaffected). Same bottom sheet.
  // LIVENESS: is a real, live person in front of the camera? REVERIFICATION: is it also the same
  // person as their KYC (face match)? The end user sees a success/failure screen; the app reads
  // the result from the resolved session (undefined if the sheet was closed first).
  try {
    const session = await presentLiveness(protegey.liveness, { mode: 'REVERIFICATION', externalUserId: 'cust-9981' });
    // session?.livenessProven, session?.matched (true = same person as the KYC), session?.status
  } catch (err) {
    if (err instanceof ProtegeyApiError && err.errorCode === NO_3D_ENROLLMENT) {
      // No KYC face on record for this customer — run a KYC verification first.
    }
  }

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

## Device location

In production your backend reports transactions server-to-server. The app's only location job is to
keep Protegey up to date with the customer's last device position: a transaction of the same
customer within ~15 minutes reuses it (GPS/IP distance, impossible travel, new area, mock location).

React Native has no built-in geolocation, and this package doesn't force a native location
dependency on you — hand it the module your app already uses:

```tsx
import * as Location from 'expo-location'; // or: import Geolocation from '@react-native-community/geolocation';

const protegey = new Protegey({ apiKey: 'YOUR_API_KEY', baseUrl: 'https://api.protegey.com', geolocation: Location });

// e.g. on login / app foreground — reads the position and sends it with device.identify()
const sent = await protegey.location.update({ externalCustomerId: 'cust-9981' });
// sent: the GpsLocationInput that was sent, or null (no module, no permission, no fix)

// Only read it, without sending anything
const position = await protegey.location.current({ timeoutMs: 3000, highAccuracy: false });
```

- `geolocation` accepts `expo-location` (`import * as Location`), `@react-native-community/geolocation`
  or `react-native-geolocation-service`. Without it, a `navigator.geolocation` polyfill is used if
  your app installed one; otherwise `location` simply resolves `null`.
- **No prompt unless you ask** (`requestPermission`, default `false`): with `expo-location` the
  foreground permission is checked first; with a navigator-style module, Android's permission is
  checked with `PermissionsAndroid`. A permanently denied permission is never re-asked; a refusal
  simply means no position. iOS + navigator-style module: authorization is left to the module —
  `@react-native-community/geolocation` asks by itself unless you configure it with
  `Geolocation.setRNConfiguration({ skipPermissionRequests: true })`; `expo-location` has no such caveat.
- `timeoutMs` (default 1500) bounds the wait for a fresh fix, then the last known position is used if
  there is one. `highAccuracy` defaults to `true` (GPS); `false` saves battery. `isMocked` is sent when
  the module reports it (Android).
- **Never throws.** No position, or a failed call, resolves to `null`.

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
| `location.update()` (sends the position with the device identify call) | POST | `/partner-api/device-events` |
| `behavioral.report()` | POST | `/partner-api/behavioral-events` |
| `kyc.startSession()` / `useProtegeyKyc().present()` | POST | `/partner-api/kyc/sessions` |
| `kyc.getSession()` (polled by the KYC sheet) | GET | `/partner-api/kyc/sessions/:sessionId` |
| `liveness.startSession()` / `startReverification()` / `useProtegeyLiveness().present()` | POST | `/partner-api/liveness/sessions` |
| `liveness.getSession()` (polled by the liveness sheet) | GET | `/partner-api/liveness/sessions/:sessionId` |
| `transactions.report()` (server-side only, see above) | POST | `/partner-api/transactions` |

Every enum value in a response is UPPER_SNAKE_CASE (`status: 'IN_REVIEW'`, `outcome: 'MANUAL'`,
`action: 'SOFT_CHALLENGE'`, `decision: 'BLOCKED'`, alert `status: 'OPEN'`...). The exported
`KycStatus`, `KycSessionStatus`, `Alert` and `ReportTransactionResult` types list the exact values.

`kyc.getSession()` also returns `recommendation` (Protegey's own verdict: `APPROVE` / `REVIEW` /
`REJECT` / `null`, unchanged by a manual override — `status` is the final decision) and `images`
(`documentFront`, `documentBack`, `selfie`, `documentFaceCrop`, each `{ url, expiresAt }` or `null`).
Those pre-signed URLs are valid for one hour and re-issued on every call: display or download them
within the hour, then call `getSession()` again for fresh links — never persist the URL.
For partner groups, `groupPresence` lists the same person's KYC at sister entities of your group
(`[{ entity, status, createdAt, matchedOn }]`, `matchedOn` among `FACE` / `GOVERNMENT_ID` / `PHONE` /
`EMAIL`), or `null` — information for your reviewer, not a risk flag.
Failed calls throw `ProtegeyApiError` with the HTTP `status`, the API's `message`, and an
`errorCode` when the API sends one (`PARTNER_SUSPENDED` / `PARTNER_CONTRACT_REQUIRED`, both 403;
`NO_3D_ENROLLMENT`, a 400, for a liveness reverification of someone with no KYC face on record).

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
