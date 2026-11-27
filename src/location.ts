import { PermissionsAndroid, Platform } from 'react-native';
import type { GpsLocationInput, IdentifyInput, IdentifyResult, LocationReadOptions, UpdateLocationInput } from '@protegey/sdk';

/** The parts of `expo-location` this SDK uses — pass `import * as Location from 'expo-location'`. */
export interface ExpoLocationLike {
  getForegroundPermissionsAsync(): Promise<{ status: string; granted?: boolean; canAskAgain?: boolean }>;
  requestForegroundPermissionsAsync(): Promise<{ status: string; granted?: boolean }>;
  getCurrentPositionAsync(options?: { accuracy?: number }): Promise<NativePosition>;
  getLastKnownPositionAsync?(): Promise<NativePosition | null>;
  hasServicesEnabledAsync?(): Promise<boolean>;
  Accuracy?: { High?: number; Balanced?: number };
}

/** A `navigator.geolocation`-style module — `@react-native-community/geolocation`,
 * `react-native-geolocation-service`, or a `navigator.geolocation` polyfill. */
export interface NavigatorGeolocationLike {
  getCurrentPosition(
    success: (position: NativePosition) => void,
    error?: (error: unknown) => void,
    options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
  ): void;
}

/** The geolocation module you give `new Protegey({ ..., geolocation })`. */
export type ProtegeyGeolocation = ExpoLocationLike | NavigatorGeolocationLike;

interface NativePosition {
  coords: { latitude: number; longitude: number; accuracy?: number | null };
  timestamp?: number;
  /** Android: the fix comes from a mock-location provider (expo-location, react-native-geolocation-service). */
  mocked?: boolean;
}

const DEFAULT_TIMEOUT_MS = 1500;
/** Extra time a pending permission dialog may take before we give up. */
const PROMPT_GRACE_MS = 60_000;

function isExpo(module: ProtegeyGeolocation): module is ExpoLocationLike {
  return typeof (module as ExpoLocationLike).getCurrentPositionAsync === 'function';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

function toLocation(position: NativePosition | null | undefined): GpsLocationInput | null {
  if (!position?.coords) return null;
  const { latitude, longitude, accuracy } = position.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const location: GpsLocationInput = { latitude, longitude };
  if (typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0) location.accuracyMeters = accuracy;
  if (typeof position.timestamp === 'number' && Number.isFinite(position.timestamp)) {
    location.capturedAt = new Date(position.timestamp).toISOString();
  }
  if (typeof position.mocked === 'boolean') location.isMocked = position.mocked;
  return location;
}

async function readWithExpo(
  expo: ExpoLocationLike,
  requestPermission: boolean,
  timeoutMs: number,
  highAccuracy: boolean,
): Promise<GpsLocationInput | null> {
  if (expo.hasServicesEnabledAsync && !(await expo.hasServicesEnabledAsync())) return null;

  let permission = await expo.getForegroundPermissionsAsync();
  if (permission.status !== 'granted' && requestPermission && permission.canAskAgain !== false) {
    permission = await expo.requestForegroundPermissionsAsync();
  }
  if (permission.status !== 'granted') return null;

  const accuracy = highAccuracy ? (expo.Accuracy?.High ?? 4) : (expo.Accuracy?.Balanced ?? 3);
  const fresh = await withTimeout(expo.getCurrentPositionAsync({ accuracy }), timeoutMs);
  if (fresh) return toLocation(fresh);
  // No fresh fix in time: fall back to the last known position (its capturedAt says how old).
  return expo.getLastKnownPositionAsync ? toLocation(await withTimeout(expo.getLastKnownPositionAsync(), 1_000)) : null;
}

/** Android: checks (and, if asked, requests) the location permission. iOS: the module itself
 * handles authorization, so this always lets the read go ahead. */
async function androidPermissionGranted(requestPermission: boolean): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const { ACCESS_FINE_LOCATION: fine, ACCESS_COARSE_LOCATION: coarse } = PermissionsAndroid.PERMISSIONS;
  if ((await PermissionsAndroid.check(fine)) || (await PermissionsAndroid.check(coarse))) return true;
  if (!requestPermission) return false;
  const results = await PermissionsAndroid.requestMultiple([fine, coarse]);
  const granted = PermissionsAndroid.RESULTS.GRANTED;
  return results[fine] === granted || results[coarse] === granted;
}

function readNavigatorPosition(
  geo: NavigatorGeolocationLike,
  options: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
  guardMs: number,
): Promise<NativePosition | null> {
  return withTimeout(
    new Promise<NativePosition>((resolve, reject) => {
      try {
        geo.getCurrentPosition(resolve, reject, options);
      } catch (error) {
        reject(error);
      }
    }),
    guardMs,
  );
}

async function readWithNavigator(
  geo: NavigatorGeolocationLike,
  requestPermission: boolean,
  timeoutMs: number,
  highAccuracy: boolean,
): Promise<GpsLocationInput | null> {
  if (!(await androidPermissionGranted(requestPermission))) return null;
  const guardMs = timeoutMs + (Platform.OS === 'android' ? 1_000 : PROMPT_GRACE_MS);
  const fresh = await readNavigatorPosition(geo, { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: 0 }, guardMs);
  if (fresh) return toLocation(fresh);
  return toLocation(await readNavigatorPosition(geo, { maximumAge: Infinity, timeout: 0 }, 1_000));
}

/**
 * Device location for React Native. In production your backend reports transactions
 * server-to-server; the app's only job is to keep Protegey up to date with the customer's last
 * device position, which a transaction of the same customer within ~15 minutes reuses.
 *
 * React Native has no built-in geolocation, and this package does not force a native location
 * dependency on you: give `new Protegey({ ..., geolocation })` the module you already use
 * (`expo-location`, `@react-native-community/geolocation`, `react-native-geolocation-service`).
 * Without one it falls back to a `navigator.geolocation` polyfill if present, else resolves `null`.
 *
 * Never throws: without a module, without the permission, or when no fix arrives in time, it
 * resolves to `null` and nothing is sent.
 */
export class RNLocationModule {
  constructor(
    private readonly device: { identify(input?: IdentifyInput): Promise<IdentifyResult> },
    private readonly geolocation?: ProtegeyGeolocation,
  ) {}

  /** Reads the device position, or `null`. Sends nothing. */
  async current(options: LocationReadOptions = {}): Promise<GpsLocationInput | null> {
    try {
      const module = this.geolocation ?? globalGeolocation();
      if (!module) return null;
      const requestPermission = options.requestPermission ?? false;
      const timeoutMs = Math.max(0, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      const highAccuracy = options.highAccuracy ?? true;
      return isExpo(module)
        ? await readWithExpo(module, requestPermission, timeoutMs, highAccuracy)
        : await readWithNavigator(module, requestPermission, timeoutMs, highAccuracy);
    } catch {
      return null;
    }
  }

  /**
   * Reads the device position and sends it to Protegey with the device identify call
   * (`POST /partner-api/device-events`, with this package's stable visitorId and device
   * attributes). Resolves to the location sent, or `null` when there was no position or the call
   * failed — it never throws.
   */
  async update(input: UpdateLocationInput): Promise<GpsLocationInput | null> {
    try {
      const { externalCustomerId, ...options } = input;
      const location = await this.current(options);
      if (!location) return null;
      await this.device.identify({ externalCustomerId, location });
      return location;
    } catch {
      return null;
    }
  }
}

function globalGeolocation(): NavigatorGeolocationLike | null {
  const nav = (globalThis as { navigator?: { geolocation?: NavigatorGeolocationLike } }).navigator;
  const geo = nav?.geolocation;
  return geo && typeof geo.getCurrentPosition === 'function' ? geo : null;
}
