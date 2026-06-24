import prisma from '../config/database';
import type { TimetableGridSnapshot } from '../types/timetableGrid';
import type { ConflictInfo } from './conflictDetector';
import { gridSnapshotsToParsedRows, normalizeGridSnapshot } from './timetableGridBuilder';

function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 < e2 && s2 < e1;
}

function normalizeHallName(name: string): string {
  return (name || '')
    .trim()
    .replace(/^room:\s*/i, '')
    .replace(/\s+COMMON\b/gi, '')
    .toLowerCase();
}

function groupNamesEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** True when the batch's saved grid still shows this hall/time (not a stale master_timetable row). */
export async function batchSnapshotShowsHallSlot(
  groupName: string,
  period: { year: number; month: number; week: number },
  slot: { dayOfWeek: string; startTime: string; endTime: string; hallName: string },
): Promise<boolean> {
  const snap = await prisma.timetableTableSnapshot.findFirst({
    where: {
      groupName: { equals: groupName, mode: 'insensitive' },
      year: period.year,
      month: period.month,
      week: period.week,
    },
    select: { gridData: true },
  });
  if (!snap) return true;

  const grid = normalizeGridSnapshot(snap.gridData as unknown as TimetableGridSnapshot);
  const rows = gridSnapshotsToParsedRows([grid]);
  const targetHall = normalizeHallName(slot.hallName);
  if (!targetHall || targetHall === 'tbd') return false;

  return rows.some((r) => {
    if (r.dayOfWeek.toLowerCase() !== slot.dayOfWeek.toLowerCase()) return false;
    if (!timesOverlap(slot.startTime, slot.endTime, r.startTime, r.endTime)) return false;
    const hall = normalizeHallName(r.hallName || 'TBD');
    return hall !== 'tbd' && hall === targetHall;
  });
}

/** Drop hall conflicts when the other batch's grid no longer shows that slot (orphan DB row). */
export async function filterStaleCrossBatchHallConflicts(
  conflicts: ConflictInfo[],
  period: { year: number; month: number; week: number },
  editingGroupName: string,
): Promise<ConflictInfo[]> {
  const kept: ConflictInfo[] = [];

  for (const c of conflicts) {
    if (c.type !== 'HALL') {
      kept.push(c);
      continue;
    }

    const entry = await prisma.masterTimetable.findUnique({
      where: { id: c.conflictingEntryId },
      include: {
        group: { select: { name: true } },
        hall: { select: { name: true } },
      },
    });
    if (!entry) continue;
    if (groupNamesEqual(entry.group.name, editingGroupName)) continue;

    const visible = await batchSnapshotShowsHallSlot(entry.group.name, period, {
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      hallName: entry.hall.name,
    });
    if (visible) kept.push(c);
  }

  return kept;
}
