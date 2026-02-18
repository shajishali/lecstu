import type { WeeklyTimetable, TimetableSlot } from './timetableService';

interface CacheEntry {
  data: { weekly: WeeklyTimetable; flat: TimetableSlot[] };
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL = 5 * 60 * 1000; // 5 minutes

export function getCached(key: string): CacheEntry['data'] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached(key: string, data: CacheEntry['data']): void {
  cache.set(key, { data, expiresAt: Date.now() + TTL });
}

export function invalidateUser(userId: string): void {
  for (const key of cache.keys()) {
    if (key.includes(userId)) {
      cache.delete(key);
    }
  }
}

export function invalidateAll(): void {
  cache.clear();
}

export function cacheStats(): { size: number; ttlMs: number } {
  return { size: cache.size, ttlMs: TTL };
}
