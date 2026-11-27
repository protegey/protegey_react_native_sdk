import { Protegey as BaseProtegey } from '@protegey/sdk';
import type { ProtegeyOptions } from '@protegey/sdk';
import { RNDeviceModule } from './device.js';
import { RNLocationModule } from './location.js';
import type { ProtegeyGeolocation } from './location.js';
import type { KycModule, LivenessModule, TransactionsModule } from './types.js';

/**
 * Same shape as `@protegey/sdk`'s `Protegey` — `.device`, `.transactions`, `.kyc`, `.behavioral`
 * — except `.device` is the React-Native-aware wrapper from `./device.js` instead of the base
 * browser-fingerprinting one, so `identify()` works correctly out of the box with no extra setup
 * on the caller's part. `transactions`/`kyc`/`behavioral` are the base modules unchanged (their
 * HTTP calls already run fine in React Native); `kyc`/`transactions` are typed down to the
 * client-side calls (see `./types.js`).
 *
 * `.transactions` is kept for a quick local/sandbox test, but isn't the recommended way to report
 * a transaction from a shipped app — see the package README's "Transactions" section: that call
 * belongs server-to-server, from your own backend, which already has the authoritative
 * transaction data and doesn't need to embed the full-privilege API key in an app bundle.
 */
export interface ProtegeyRNOptions extends ProtegeyOptions {
  /** Optional geolocation module for `protegey.location` — `import * as Location from
   * 'expo-location'`, or `@react-native-community/geolocation` / `react-native-geolocation-service`.
   * Omit it and `location` uses a `navigator.geolocation` polyfill if present, else resolves null. */
  geolocation?: ProtegeyGeolocation;
}

export class Protegey {
  readonly device: RNDeviceModule;
  readonly transactions: TransactionsModule;
  readonly kyc: KycModule;
  /** 3D liveness and re-verification — a separate, paid product (KYC is unaffected). */
  readonly liveness: LivenessModule;
  readonly behavioral: BaseProtegey['behavioral'];
  /** Device GPS position, sent with `device.identify()` — see `RNLocationModule`. */
  readonly location: RNLocationModule;

  constructor(options: ProtegeyRNOptions) {
    const base = new BaseProtegey(options);
    this.device = new RNDeviceModule(base.device);
    this.transactions = base.transactions;
    this.kyc = base.kyc;
    this.liveness = base.liveness;
    this.behavioral = base.behavioral;
    this.location = new RNLocationModule(this.device, options.geolocation);
  }
}
