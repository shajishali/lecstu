import type { PositionSource } from '../../../generated/prisma/client';
import { QrPositionProvider } from './qr-position-provider';
import type { PositionProvider, ResolvedPosition } from './types';

const providers = new Map<PositionSource, PositionProvider>([
  ['QR_CODE', new QrPositionProvider()],
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
