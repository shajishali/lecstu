import type { PositionProvider, ResolvedPosition } from './types';

/** Phase 3 stub - register when UWB positioning is integrated. */
export class UwbPositionProvider implements PositionProvider {
  readonly source = 'UWB' as const;

  async resolvePosition(_input: unknown): Promise<ResolvedPosition | null> {
    return null;
  }
}
