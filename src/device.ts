import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getBatteryLevel, getManufacturer, getModel, getSystemVersion, getTotalMemory, getVersion, isBatteryCharging, isEmulator } from 'react-native-device-info';
import type { Protegey as BaseProtegey, DeviceAttributes, IdentifyInput, IdentifyResult } from '@protegey/sdk';

type BaseDeviceModule = InstanceType<typeof BaseProtegey>['device'];

const VISITOR_ID_STORAGE_KEY = '@protegey/visitorId';

/**
 * Wraps the base SDK's device module with exactly what its own fingerprint.ts doc comment asks
 * every non-browser caller to supply: a visitorId that's STABLE across app launches (the base
 * SDK has no DOM to fingerprint in React Native, so left alone it falls back to a fresh random id
 * on every single call — useless for device-sharing/velocity detection), plus real device
 * attributes collected natively via react-native-device-info instead of being left empty.
 * Mirrors what protegey_flutter_sdk already does with device_info_plus.
 */
export class RNDeviceModule {
  constructor(private readonly base: BaseDeviceModule) {}

  async identify(input: IdentifyInput = {}): Promise<IdentifyResult> {
    const visitorId = input.visitorId ?? (await getOrCreateVisitorId());
    const attributes = await collectNativeAttributes();
    return this.base.identify({
      ...input,
      visitorId,
      deviceAttributes: { ...attributes, ...input.deviceAttributes },
    });
  }
}

async function getOrCreateVisitorId(): Promise<string> {
  const existing = await AsyncStorage.getItem(VISITOR_ID_STORAGE_KEY);
  if (existing) return existing;
  const fresh = `rn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await AsyncStorage.setItem(VISITOR_ID_STORAGE_KEY, fresh);
  return fresh;
}

/**
 * manufacturer/batteryLevel/isCharging aren't in @protegey/sdk's own DeviceAttributes type yet,
 * but the backend's DeviceAttributesDto already accepts them (same fields protegey_flutter_sdk
 * already sends) — widened locally rather than blocked on that package catching up.
 */
async function collectNativeAttributes(): Promise<DeviceAttributes & Record<string, unknown>> {
  try {
    const [emulator, totalMemoryBytes, manufacturer, batteryLevel, charging] = await Promise.all([
      isEmulator().catch(() => undefined),
      getTotalMemory().catch(() => undefined),
      getManufacturer().catch(() => undefined),
      getBatteryLevel().catch(() => undefined),
      isBatteryCharging().catch(() => undefined),
    ]);
    return {
      platform: Platform.OS === 'ios' ? 'iOS' : 'Android',
      osVersion: getSystemVersion(),
      deviceModel: getModel(),
      manufacturer,
      appVersion: getVersion(),
      isEmulator: emulator,
      totalMemoryMb: typeof totalMemoryBytes === 'number' ? Math.round(totalMemoryBytes / (1024 * 1024)) : undefined,
      batteryLevel: typeof batteryLevel === 'number' && batteryLevel >= 0 ? Math.round(batteryLevel * 100) : undefined,
      isCharging: charging,
    };
  } catch {
    // Best-effort only — identify() must never fail just because device-info collection did.
    return {};
  }
}
