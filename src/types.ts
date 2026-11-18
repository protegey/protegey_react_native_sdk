import type { Protegey as BaseProtegey, RuleSeverity } from '@protegey/sdk';

/**
 * Since `@protegey/sdk` v0.7.0 the wire-exact response types (`KycStatus`, `KycSessionStatus`,
 * `Alert`, `ReportTransactionResult`, ...) live in the base SDK and are re-exported from
 * `./index.ts` as-is. This file only keeps what's specific to this package: the narrower module
 * surfaces `Protegey` exposes here (the client-side subset of the partner API).
 */

/** `protegey.kyc` — the base SDK's KYC module, limited to the two calls an app makes:
 * `startSession()` (`POST /partner-api/kyc/sessions`) and `getSession()`
 * (`GET /partner-api/kyc/sessions/:sessionId`). List/update/resend belong on your backend. */
export type KycModule = Pick<BaseProtegey['kyc'], 'startSession' | 'getSession'>;

/** `protegey.transactions` — `report()` only (`POST /partner-api/transactions`). Server-to-server
 * in a real integration: see the README's "Transactions" section. */
export type TransactionsModule = Pick<BaseProtegey['transactions'], 'report'>;

/** Kept for 0.3.0 API stability — same as `@protegey/sdk`'s `RuleSeverity` (lowercase on the wire). */
export type AlertRuleSeverity = RuleSeverity;
