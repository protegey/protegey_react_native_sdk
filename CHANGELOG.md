## 0.1.0

- Initial release.
- Re-exports `@protegey/sdk` (device, transactions, kyc, behavioral) as-is.
- `ProtegeyKycView` — low-level in-app KYC webview widget.
- `ProtegeyKycProvider` / `useProtegeyKyc()` — one-call KYC integration: starts a session and shows
  it in a draggable bottom sheet automatically, no UI code needed on the partner's end.
