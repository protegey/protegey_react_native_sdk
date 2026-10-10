import { Protegey as BaseProtegey } from '@protegey/sdk';
import type { ProtegeyOptions } from '@protegey/sdk';
import { RNDeviceModule } from './device.js';

/**
 * Same shape as `@protegey/sdk`'s `Protegey` — `.device`, `.transactions`, `.kyc`, `.behavioral`
 * — except `.device` is the React-Native-aware wrapper from `./device.js` instead of the base
 * browser-fingerprinting one, so `identify()` works correctly out of the box with no extra setup
 * on the caller's part. `transactions`/`kyc`/`behavioral` are untouched: their HTTP calls already
 * run fine in React Native as-is.
 *
 * `.transactions` is kept for a quick local/sandbox test, but isn't the recommended way to report
 * a transaction from a shipped app — see the package README's "Transactions" section: that call
 * belongs server-to-server, from your own backend, which already has the authoritative
 * transaction data and doesn't need to embed the full-privilege API key in an app bundle.
 */
export class Protegey {
  readonly device: RNDeviceModule;
  readonly transactions: BaseProtegey['transactions'];
  readonly kyc: BaseProtegey['kyc'];
  readonly behavioral: BaseProtegey['behavioral'];

  constructor(options: ProtegeyOptions) {
    const base = new BaseProtegey(options);
    this.device = new RNDeviceModule(base.device);
    this.transactions = base.transactions;
    this.kyc = base.kyc;
    this.behavioral = base.behavioral;
  }
}
