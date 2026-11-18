import type {
  KycOutcome,
  KycSessionStatus as BaseKycSessionStatus,
  ReportTransactionInput,
  StartKycSessionInput,
  StartKycSessionResult,
} from '@protegey/sdk';

/**
 * Wire-exact response types for the partner-api calls this package exposes. `@protegey/sdk` does
 * the HTTP; it types a few enum fields as a bare `string` and `Alert` as an open bag, so these
 * narrow them to exactly what partner-api returns. Every value below is UPPER_SNAKE_CASE because
 * partner-api uppercases `status`/`decision`/`decisionVerdict`/`disposition`/`outcome`/... on
 * every response (`common/utils/partner-api-case.util.ts`). Keep in sync with protegey-backend.
 */

/** `GET /partner-api/kyc/sessions/:sessionId` → `status`. A biometric session starts `IN_PROGRESS`,
 * ends `APPROVED` / `IN_REVIEW` / `DECLINED`, and is `RESUBMITTED` after a resend. */
export type KycStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'AWAITING_USER'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'DECLINED'
  | 'RESUBMITTED'
  | 'ABANDONED'
  | 'EXPIRED'
  | 'KYC_EXPIRED';

/** Response of `GET /partner-api/kyc/sessions/:sessionId` — `@protegey/sdk`'s shape with `status`
 * narrowed to {@link KycStatus}. */
export interface KycSessionStatus extends Omit<BaseKycSessionStatus, 'status'> {
  status: KycStatus;
}

/** `decision` on a transaction. */
export type TransactionDecision = 'CLEAR' | 'REVIEW' | 'BLOCKED';

export type AlertStatus = 'OPEN' | 'CONFIRMED' | 'MORE_INFO_REQUESTED' | 'DISMISSED';
export type AlertDisposition = 'CONFIRMED_FRAUD' | 'FALSE_POSITIVE' | 'NO_ACTION' | 'SAR_FILED' | 'ESCALATED';
export type AlertDecisionVerdict = 'BLOCK' | 'STEP_UP' | 'ESCALATE' | 'ALERT';
/** Stays lowercase on the wire — `ruleSeverity` isn't one of the uppercased keys. */
export type AlertRuleSeverity = 'review' | 'block' | 'step_up' | 'escalate';

/** An alert as returned in `POST /partner-api/transactions` → `alerts[]`. */
export interface Alert {
  id: string;
  partnerId: string;
  isSandbox: boolean;
  ruleId: string;
  alertNumber: number;
  ruleCode: string;
  externalCustomerId: string;
  transactionId: string | null;
  triggeredAt: string;
  matchedValues: Record<string, unknown>;
  status: AlertStatus;
  decisionVerdict: AlertDecisionVerdict | null;
  assignedToUserId: string | null;
  disposition: AlertDisposition | null;
  investigationNotes: string | null;
  dueAt: string | null;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  createdAt: string;
  // Only present on the device-signal alert (rule `DEVICE-SIGNAL-001`) appended when no rule
  // fired but the device action was BLOCK / HARD_CHALLENGE.
  ruleName?: string;
  ruleNameFr?: string | null;
  ruleExplanation?: string | null;
  ruleExplanationFr?: string | null;
  ruleSeverity?: AlertRuleSeverity;
  ruleNumber?: number;
  transaction?: {
    /** Decimal string, e.g. "15000.00". */
    amount: string;
    currency: string;
    direction: 'DEBIT' | 'CREDIT';
    transactionType: string;
    occurredAt: string;
  } | null;
}

/** Response of `POST /partner-api/transactions`. */
export interface ReportTransactionResult {
  transactionId: string;
  decision: TransactionDecision;
  riskScore: number;
  deviceAction: 'ALLOW' | 'SOFT_CHALLENGE' | 'HARD_CHALLENGE' | 'BLOCK' | null;
  alerts: Alert[];
}

/** `protegey.kyc` — same runtime object as `@protegey/sdk`'s, with the precise response type. */
export interface KycModule {
  /** `POST /partner-api/kyc/sessions` — returns the hosted capture link (single-use, 30 min). */
  startSession(input: StartKycSessionInput): Promise<StartKycSessionResult>;
  /** `GET /partner-api/kyc/sessions/:sessionId` — `sessionId` is the one `startSession()` returned. */
  getSession(sessionId: string): Promise<KycSessionStatus>;
}

/** `protegey.transactions` — same runtime object as `@protegey/sdk`'s, with the precise response
 * type. Server-to-server in a real integration: see the README's "Transactions" section. */
export interface TransactionsModule {
  /** `POST /partner-api/transactions`. `occurredAt` defaults to now. */
  report(input: ReportTransactionInput): Promise<ReportTransactionResult>;
}

export type { KycOutcome };
