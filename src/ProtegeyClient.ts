import { Protegey as BaseProtegey } from '@protegey/sdk';
import type { ProtegeyOptions } from '@protegey/sdk';
import { RNDeviceModule } from './device.js';
import type { KycModule, TransactionsModule } from './types.js';

/**
 * Same shape as `@protegey/sdk`'s `Protegey` — `.device`, `.transactions`, `.kyc`, `.behavioral`
 * — except `.device` is the React-Native-aware wrapper from `./device.js` instead of the base
 * browser-fingerprinting one, so `identify()` works correctly out of the box with no extra setup
 * on the caller's part. `transactions`/`kyc`/`behavioral` are the base modules unchanged (their
 * HTTP calls already run fine in React Native); `kyc`/`transactions` are only re-typed with the
 * wire-exact response types from `./types.js`.
 *
 * `.transactions` is kept for a quick local/sandbox test, but isn't the recommended way to report
 * a transaction from a shipped app — see the package README's "Transactions" section: that call
 * belongs server-to-server, from your own backend, which already has the authoritative
 * transaction data and doesn't need to embed the full-privilege API key in an app bundle.
 */
export class Protegey {
  readonly device: RNDeviceModule;
  readonly transactions: TransactionsModule;
  readonly kyc: KycModule;
  readonly behavioral: BaseProtegey['behavioral'];

  constructor(options: ProtegeyOptions) {
    const base = new BaseProtegey(options);
    this.device = new RNDeviceModule(base.device);
    // Same objects — the base SDK just types `status`/`alerts` loosely.
    this.transactions = base.transactions as unknown as TransactionsModule;
    this.kyc = base.kyc as unknown as KycModule;
    this.behavioral = base.behavioral;
  }
}
