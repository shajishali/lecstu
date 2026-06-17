import type { PositionProvider, ResolvedPosition } from './types';

/** Phase 2 stub — register when BLE beacon hardware/SDK is integrated. */
export class BleBeaconPositionProvider implements PositionProvider {
  readonly source = 'BLE_BEACON' as const;

  async resolvePosition(_input: unknown): Promise<ResolvedPosition | null> {
    return null;
  }
}
