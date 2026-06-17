import type { PositionSource } from '../../../generated/prisma/client';
import { BleBeaconPositionProvider } from './ble-position-provider';
import { QrPositionProvider } from './qr-position-provider';
import { UwbPositionProvider } from './uwb-position-provider';
import type { PositionProvider, ResolvedPosition } from './types';

const providers = new Map<PositionSource, PositionProvider>([
  ['QR_CODE', new QrPositionProvider()],
  ['BLE_BEACON', new BleBeaconPositionProvider()],
  ['UWB', new UwbPositionProvider()],
]);

/** Register BLE/UWB providers in future phases without changing callers. */
export function registerPositionProvider(source: PositionSource, provider: PositionProvider): void {
  providers.set(source, provider);
}

export async function resolvePosition(
  source: PositionSource,
  input: unknown
): Promise<ResolvedPosition | null> {
  const provider = providers.get(source);
  if (!provider) return null;
  return provider.resolvePosition(input);
}
