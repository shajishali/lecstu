import prisma from '../config/database';
import { invalidateAll } from './timetableCache';
import {
  extractSlotRefsFromGridSnapshot,
  mergeSlotRefSources,
  normalizeGridSnapshot,
  type GridSlotRef,
} from './timetableGridBuilder';
import { parseFetCellContent, mergeConsecutiveSlots, type ParsedTimetableRow } from './timetableParserService';
import { isFetLecturerCodeToken } from './lecturerInitialsMatch';
import { UNASSIGNED_LECTURER_EMAIL } from './conflictDetector';
import {
  linkLecturersFromSheetInitials,
  invalidateLecturerDisplayIndex,
} from './lecturerDisplayService';
import type { TimetableGridSnapshot } from '../types/timetableGrid';

/** Fix merged FET slot times in DB (e.g. Thu ENPR 44043 starting at 09:00 instead of 08:00). */
export async function repairFetMergedSlotTimes(): Promise<{ updated: number; deactivated: number }> {
  const entries = await prisma.masterTimetable.findMany({
    where: { isActive: true },
    include: {
      course: { select: { code: true, name: true } },
      group: { select: { name: true } },
      hall: { select: { name: true } },
      lecturer: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  const parsed: (ParsedTimetableRow & { dbId: string })[] = entries.map((e) => ({
    dbId: e.id,
    year: e.year,
    month: e.month,
    week: e.week,
    dayOfWeek: e.dayOfWeek,
    startTime: e.startTime,
    endTime: e.endTime,
    courseCode: e.course.code,
    courseName: e.course.name,
    lecturerEmail: e.lecturer.email,
    lecturerName: e.lecturerInitials ?? `${e.lecturer.firstName} ${e.lecturer.lastName}`.trim(),
    hallName: e.hall.name,
    groupName: e.group.name,
    semester: e.semester,
  }));

  const byGroup = new Map<string, typeof parsed>();
  for (const row of parsed) {
    if (!byGroup.has(row.groupName)) byGroup.set(row.groupName, []);
    byGroup.get(row.groupName)!.push(row);
  }

  let updated = 0;
  let deactivated = 0;

  for (const [, rows] of byGroup) {
    const merged = mergeConsecutiveSlots(rows);
    const usedIds = new Set<string>();

    for (const m of merged) {
      const matches = rows.filter(
        (r) =>
          r.groupName === m.groupName &&
          r.dayOfWeek === m.dayOfWeek &&
          r.courseCode === m.courseCode &&
          r.year === m.year &&
          r.month === m.month &&
          r.week === m.week &&
          !usedIds.has(r.dbId),
      );
      if (matches.length === 0) continue;

      matches.sort((a, b) => a.startTime.localeCompare(b.startTime));
      const keeper = matches[0];
      usedIds.add(keeper.dbId);

      if (keeper.startTime !== m.startTime || keeper.endTime !== m.endTime) {
        await prisma.masterTimetable.update({
          where: { id: keeper.dbId },
          data: { startTime: m.startTime, endTime: m.endTime },
        });
        updated++;
      }

      for (let i = 1; i < matches.length; i++) {
        usedIds.add(matches[i].dbId);
        await prisma.masterTimetable.update({
          where: { id: matches[i].dbId },
          data: { isActive: false },
        });
        deactivated++;
      }
    }
  }

  const wrongThu = await prisma.masterTimetable.findMany({
    where: {
      isActive: true,
      dayOfWeek: 'THURSDAY',
      startTime: '09:00',
      endTime: '10:55',
      course: { code: { contains: '44043' } },
      group: { name: { contains: 'ETIA' } },
    },
    select: { id: true },
  });
  for (const row of wrongThu) {
    await prisma.masterTimetable.update({
      where: { id: row.id },
      data: { startTime: '08:00' },
    });
    updated++;
  }

  invalidateAll();
  return { updated, deactivated };
}

function slotRefFromEntry(s: {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  course: { name: string };
  hall: { name: string };
  lecturerInitials: string | null;
  lecturer?: { firstName: string; lastName: string; email: string };
}): GridSlotRef {
  let lecturerName = s.lecturerInitials?.trim() || undefined;
  if (
    !lecturerName &&
    s.lecturer &&
    s.lecturer.email !== UNASSIGNED_LECTURER_EMAIL
  ) {
    lecturerName = `${s.lecturer.firstName} ${s.lecturer.lastName}`.trim() || undefined;
  }
  return {
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    courseName: s.course.name,
    hallName: s.hall.name,
    lecturerName,
  };
}

/** Known FET details when import lost hall/lecturer (ET-Y4-ETIA Sem I 2026). */
const ET_Y4_ETIA_BACKFILL: GridSlotRef[] = [
  {
    dayOfWeek: 'MONDAY',
    startTime: '10:00',
    endTime: '11:55',
    courseName: 'ETIA 44423 AUTOMATION_LAB',
    hallName: 'AB-IA-05-1',
    lecturerName: 'SB',
  },
  {
    dayOfWeek: 'MONDAY',
    startTime: '14:00',
    endTime: '16:55',
    courseName: 'Y4 ET ENPR 41033 T',
    hallName: 'AB-LCH-09-2',
    lecturerName: 'CJ',
  },
  {
    dayOfWeek: 'WEDNESDAY',
    startTime: '09:00',
    endTime: '10:55',
    courseName: 'ETIA 44423 T',
    hallName: 'AB-Seminar-04-03',
    lecturerName: 'SB',
  },
  {
    dayOfWeek: 'WEDNESDAY',
    startTime: '14:00',
    endTime: '16:55',
    courseName: 'ETIA 44433 T',
    hallName: 'AB-LCH-04-1',
    lecturerName: 'CJ',
  },
  {
    dayOfWeek: 'THURSDAY',
    startTime: '08:00',
    endTime: '10:55',
    courseName: 'Y4 ET, Y4 CT ENPR 44043 T',
    hallName: 'AB-LCH-07-1',
    lecturerName: 'VL_Amila',
  },
  {
    dayOfWeek: 'FRIDAY',
    startTime: '10:00',
    endTime: '11:55',
    courseName: 'Y4 ET ENPR 44052 SCALE_UP SP',
    hallName: 'AB-SCALE-08-01',
    lecturerName: 'SP',
  },
  {
    dayOfWeek: 'FRIDAY',
    startTime: '14:00',
    endTime: '16:55',
    courseName: 'ETIA 44413 T',
    hallName: 'AB-Seminar-04-09',
    lecturerName: 'CJ',
  },
];

export function backfillSlotRefsForGroup(groupName: string, slots: GridSlotRef[]): GridSlotRef[] {
  if (groupName.toUpperCase() !== 'ET-Y4-ETIA') return slots;
  const merged = [...slots];
  for (const bf of ET_Y4_ETIA_BACKFILL) {
    const idx = merged.findIndex(
      (s) =>
        s.dayOfWeek === bf.dayOfWeek &&
        s.startTime === bf.startTime &&
        s.endTime === bf.endTime,
    );
    if (idx < 0) merged.push(bf);
    else {
      merged[idx] = {
        ...merged[idx],
        courseName: bf.courseName,
        hallName:
          merged[idx].hallName === 'TBD' || !merged[idx].hallName ? bf.hallName : merged[idx].hallName,
        lecturerName: merged[idx].lecturerName || bf.lecturerName,
      };
    }
  }
  return merged;
}

/** Update master slots + courses from enriched FET lines. */
export async function repairMasterSlotsFromFetLines(
  groupName: string,
  slotRefs: GridSlotRef[],
): Promise<{ updated: number }> {
  const { isFetLecturerCodeToken } = await import('./lecturerInitialsMatch');
  let updated = 0;

  for (const ref of slotRefs) {
    const entries = await prisma.masterTimetable.findMany({
      where: {
        isActive: true,
        dayOfWeek: ref.dayOfWeek as 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY',
        startTime: ref.startTime,
        endTime: ref.endTime,
        group: { name: { equals: groupName, mode: 'insensitive' } },
      },
      include: { course: { select: { id: true, name: true } }, hall: { select: { id: true, name: true } } },
    });
    if (entries.length === 0) continue;

    for (const entry of entries) {
      const data: {
        lecturerInitials?: string | null;
        course?: { update: { name: string } };
        hall?: { connect: { id: string } };
      } = {};

      const lect = ref.lecturerName?.trim();
      if (lect && isFetLecturerCodeToken(lect.split(/\s+/)[0] ?? lect)) {
        data.lecturerInitials = lect.replace(/\s+/g, '').toUpperCase();
      }

      const entryNorm = entry.course.name.replace(/\s+/g, ' ').trim();
      const refNorm = ref.courseName.replace(/\s+/g, ' ').trim();
      const isEtBackfill =
        groupName.toUpperCase() === 'ET-Y4-ETIA' &&
        ET_Y4_ETIA_BACKFILL.some(
          (bf) =>
            bf.dayOfWeek === ref.dayOfWeek &&
            bf.startTime === ref.startTime &&
            bf.endTime === ref.endTime &&
            bf.courseName === ref.courseName,
        );
      if (refNorm && (isEtBackfill || (refNorm !== entryNorm && refNorm.length >= entryNorm.length))) {
        data.course = { update: { name: refNorm } };
      }

      if (ref.hallName && ref.hallName !== 'TBD' && entry.hall.name === 'TBD') {
        let hall = await prisma.lectureHall.findFirst({
          where: { name: { equals: ref.hallName, mode: 'insensitive' } },
        });
        if (!hall) {
          const { parseLectureHall } = await import('../config/fct-faculty-config');
          const parsed = parseLectureHall(ref.hallName);
          hall = await prisma.lectureHall.create({
            data: {
              name: parsed.name,
              building: parsed.building,
              floor: parsed.floor,
              capacity: parsed.capacity,
              equipment: parsed.equipment,
            },
          });
        }
        data.hall = { connect: { id: hall.id } };
      }

      if (Object.keys(data).length > 0) {
        await prisma.masterTimetable.update({ where: { id: entry.id }, data });
        updated++;
      }
    }
  }

  return { updated };
}

/** Re-parse grid cells with full FET parser and merge richer lecturer/hall lines. */
function enrichSlotRefsFromGridParser(
  grid: TimetableGridSnapshot,
  slotRefs: GridSlotRef[],
): GridSlotRef[] {
  const gridRefs = extractSlotRefsFromGridSnapshot(grid);
  const merged = mergeSlotRefSources(gridRefs, slotRefs);

  const dayCols = grid.dayColumns ?? [];
  const timeRows = grid.timeRows ?? [];
  const byKey = new Map(merged.map((s) => [`${s.dayOfWeek}|${s.startTime}|${s.endTime}`, s]));

  for (let di = 0; di < dayCols.length; di++) {
    const day = dayCols[di]?.day;
    if (!day) continue;
    for (let ti = 0; ti < timeRows.length; ti++) {
      const cell = grid.cells?.[ti]?.[di];
      if (!cell || cell.isEmpty || cell.isBreak || cell.mergeContinue) continue;
      const span = Math.max(1, cell.rowSpan ?? 1);
      const endTi = Math.min(ti + span - 1, timeRows.length - 1);
      const start = timeRows[ti]?.start;
      const end = timeRows[endTi]?.end;
      if (!start || !end) continue;

      const lines = [
        ...(cell.displayLines ?? []),
        ...(cell.lines ?? []),
        ...(cell.rawText ? String(cell.rawText).split(/\n/) : []),
      ]
        .map((l) => l.trim())
        .filter(Boolean);
      const parsed = parseFetCellContent(lines);
      if (!parsed) continue;

      const key = `${day}|${start}|${end}`;
      const prev = byKey.get(key);
      byKey.set(key, {
        dayOfWeek: day,
        startTime: start,
        endTime: end,
        courseName: parsed.courseName || prev?.courseName || '',
        hallName:
          parsed.hallName !== 'TBD' ? parsed.hallName : prev?.hallName || 'TBD',
        lecturerName: parsed.lecturerName || prev?.lecturerName,
      });
    }
  }

  return [...byKey.values()];
}

async function ensureHallRecord(hallName: string): Promise<string> {
  const existing = await prisma.lectureHall.findFirst({
    where: { name: { equals: hallName, mode: 'insensitive' } },
  });
  if (existing) return existing.id;
  const { parseLectureHall } = await import('../config/fct-faculty-config');
  const parsed = parseLectureHall(hallName);
  const created = await prisma.lectureHall.create({
    data: {
      name: parsed.name,
      building: parsed.building,
      floor: parsed.floor,
      capacity: parsed.capacity,
      equipment: parsed.equipment,
    },
  });
  return created.id;
}

/** Sync master timetable rows from merged slot refs (grid + DB). */
export async function repairMasterSlotsFromSlotRefs(
  groupName: string,
  slotRefs: GridSlotRef[],
): Promise<{ updated: number; stillMissingLect: number; stillMissingHall: number }> {
  let updated = 0;
  let stillMissingLect = 0;
  let stillMissingHall = 0;

  for (const ref of slotRefs) {
    const entries = await prisma.masterTimetable.findMany({
      where: {
        isActive: true,
        dayOfWeek: ref.dayOfWeek as 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY',
        startTime: ref.startTime,
        endTime: ref.endTime,
        group: { name: { equals: groupName, mode: 'insensitive' } },
      },
      include: { course: { select: { id: true, name: true } }, hall: { select: { id: true, name: true } } },
    });
    if (entries.length === 0) continue;

    for (const entry of entries) {
      const data: {
        lecturerInitials?: string | null;
        course?: { update: { name: string } };
        hall?: { connect: { id: string } };
      } = {};

      const lect = ref.lecturerName?.trim();
      if (lect && lect !== '-' && lect !== '-' && !entry.lecturerInitials?.trim()) {
        const code = lect.split(/\s+/).find((p) => isFetLecturerCodeToken(p));
        if (code) data.lecturerInitials = code.replace(/\s+/g, '').toUpperCase();
      }

      const refCourse = ref.courseName?.trim();
      if (refCourse && refCourse.length > (entry.course.name?.length ?? 0)) {
        data.course = { update: { name: refCourse } };
      }

      if (ref.hallName && ref.hallName !== 'TBD' && entry.hall.name.toUpperCase() === 'TBD') {
        data.hall = { connect: { id: await ensureHallRecord(ref.hallName) } };
      }

      if (Object.keys(data).length > 0) {
        await prisma.masterTimetable.update({ where: { id: entry.id }, data });
        updated++;
      }

      if (!entry.lecturerInitials?.trim() && !data.lecturerInitials) stillMissingLect++;
      const hallName = data.hall ? ref.hallName : entry.hall.name;
      if (!hallName || hallName.toUpperCase() === 'TBD') stillMissingHall++;
    }
  }

  return { updated, stillMissingLect, stillMissingHall };
}

/**
 * System-wide repair: every group grid + master slot gets lecturer + hall where
 * the stored FET cell text contains them.
 */
export async function repairAllTimetableDetailsFromGrids(): Promise<{
  repaired: number;
  masterUpdated: number;
  lecturersLinked: number;
  stillMissingLecturer: number;
  stillMissingHall: number;
}> {
  invalidateLecturerDisplayIndex();
  const { linked: lecturersLinked } = await linkLecturersFromSheetInitials();

  const snapshots = await prisma.timetableTableSnapshot.findMany({
    select: { id: true, groupName: true, gridData: true },
  });

  let repaired = 0;
  let masterUpdated = 0;
  let stillMissingLecturer = 0;
  let stillMissingHall = 0;

  for (const snap of snapshots) {
    const raw = snap.gridData as unknown as TimetableGridSnapshot;
    const grid = normalizeGridSnapshot(raw);

    const dbSlots = await prisma.masterTimetable.findMany({
      where: {
        isActive: true,
        group: { name: { equals: snap.groupName, mode: 'insensitive' } },
      },
      include: {
        course: { select: { name: true } },
        hall: { select: { name: true } },
        lecturer: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    if (dbSlots.length === 0) continue;

    let slotRefs = backfillSlotRefsForGroup(snap.groupName, dbSlots.map(slotRefFromEntry));
    slotRefs = enrichSlotRefsFromGridParser(grid, slotRefs);

    const masterResult = await repairMasterSlotsFromSlotRefs(snap.groupName, slotRefs);
    masterUpdated += masterResult.updated;
    stillMissingLecturer += masterResult.stillMissingLect;
    stillMissingHall += masterResult.stillMissingHall;
    repaired++;
  }

  invalidateAll();
  return { repaired, masterUpdated, lecturersLinked, stillMissingLecturer, stillMissingHall };
}

/** @deprecated Use repairAllTimetableDetailsFromGrids */
export async function repairGridSnapshotsFromSlots(): Promise<{
  repaired: number;
  masterUpdated: number;
}> {
  const r = await repairAllTimetableDetailsFromGrids();
  return { repaired: r.repaired, masterUpdated: r.masterUpdated };
}
