import type { PositionSource } from '../../../generated/prisma/client';

export type ResolvedPosition = {
  nodeId: string;
  floor: number;
  label: string;
  source: PositionSource;
};

export interface PositionProvider {
  readonly source: PositionSource;
  resolvePosition(input: unknown): Promise<ResolvedPosition | null>;
}
