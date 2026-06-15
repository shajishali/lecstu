import prisma from '../config/database';
import { UNASSIGNED_LECTURER_EMAIL } from './conflictDetector';
import {
  deriveTimetableCodeFromName,
  effectiveTimetableCode,
} from './lecturerInitialsMatch';

/** @deprecated FET-only virtual IDs removed — booking uses registered lecturers only */
export const FET_LECTURER_ID_PREFIX = 'fet:';

export function isFetVirtualLecturerId(id: string): boolean {
  return id.startsWith(FET_LECTURER_ID_PREFIX);
}

export function parseFetVirtualLecturerId(id: string): string | null {
  if (!isFetVirtualLecturerId(id)) return null;
  const code = id.slice(FET_LECTURER_ID_PREFIX.length).trim();
  return code || null;
}

export interface DirectoryTeachingHall {
  name: string;
  building: string;
}

export interface LecturerDirectoryItem {
  id: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  profileImage: string | null;
  timetableCode: string | null;
  derivedFromName: boolean;
  bookable: boolean;
  isFetOnly: boolean;
  department: { id: string; name: string; code: string } | null;
  lecturerOffice: { id: string; roomNumber: string; building: string; floor: number } | null;
  scheduleSlotCount: number;
  teachingHalls: DirectoryTeachingHall[];
}

type LecturerUserRow = {
  id: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  email: string;
  phone: string | null;
  profileImage: string | null;
  timetableCode: string | null;
  department: { id: string; name: string; code: string } | null;
  lecturerOffice: {
    id: string;
    roomNumber: string;
    building: string;
    floor: number;
  } | null;
};

function userMatchesSearch(u: LecturerUserRow, searchQ: string): boolean {
  const q = searchQ.toLowerCase();
  const full = `${u.firstName} ${u.lastName}`.toLowerCase();
  const code = effectiveTimetableCode(u.firstName, u.lastName, u.timetableCode);
  if (full.includes(q) || (u.email || '').toLowerCase().includes(q)) return true;
  if (code && code.toLowerCase().includes(q)) return true;
  if (u.designation?.toLowerCase().includes(q)) return true;
  if (u.lecturerOffice?.roomNumber.toLowerCase().includes(q)) return true;
  return false;
}

async function schedulePlacesForLecturer(lecturerId: string): Promise<DirectoryTeachingHall[]> {
  const slots = await prisma.lecturerScheduleSlot.findMany({
    where: { lecturerId, location: { not: null } },
    select: { location: true },
    distinct: ['location'],
  });
  const halls: DirectoryTeachingHall[] = [];
  for (const s of slots) {
    const loc = s.location?.trim();
    if (!loc) continue;
    halls.push({ name: loc, building: loc });
  }
  return halls;
}

export async function listDirectoryLecturers(filters?: {
  search?: string;
  departmentId?: string;
}): Promise<LecturerDirectoryItem[]> {
  const users = await prisma.user.findMany({
    where: {
      role: 'LECTURER',
      isActive: true,
      NOT: { email: UNASSIGNED_LECTURER_EMAIL },
      ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      designation: true,
      email: true,
      phone: true,
      profileImage: true,
      timetableCode: true,
      department: { select: { id: true, name: true, code: true } },
      lecturerOffice: {
        select: { id: true, roomNumber: true, building: true, floor: true },
      },
      _count: { select: { scheduleSlots: true } },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  const searchQ = filters?.search?.trim();
  const filteredUsers = searchQ
    ? users.filter((u) => userMatchesSearch(u, searchQ))
    : users;

  const items: LecturerDirectoryItem[] = [];

  for (const u of filteredUsers) {
    const effective = effectiveTimetableCode(u.firstName, u.lastName, u.timetableCode);
    const derivedOnly =
      !u.timetableCode?.trim() &&
      !!deriveTimetableCodeFromName(u.firstName, u.lastName);

    const teachingHalls: DirectoryTeachingHall[] = [];
    if (u.lecturerOffice) {
      teachingHalls.push({
        name: `Office ${u.lecturerOffice.roomNumber}`,
        building: u.lecturerOffice.building,
      });
    }
    const schedulePlaces = await schedulePlacesForLecturer(u.id);
    for (const p of schedulePlaces) {
      if (!teachingHalls.some((h) => h.name === p.name)) teachingHalls.push(p);
    }

    items.push({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      designation: u.designation,
      email: u.email,
      phone: u.phone,
      profileImage: u.profileImage,
      timetableCode: effective,
      derivedFromName: derivedOnly,
      bookable: true,
      isFetOnly: false,
      department: u.department,
      lecturerOffice: u.lecturerOffice,
      scheduleSlotCount: u._count.scheduleSlots,
      teachingHalls,
    });
  }

  return items;
}

export async function getDirectoryLecturerProfile(id: string) {
  if (isFetVirtualLecturerId(id)) return null;

  const lecturer = await prisma.user.findFirst({
    where: { id, role: 'LECTURER', isActive: true, NOT: { email: UNASSIGNED_LECTURER_EMAIL } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      designation: true,
      email: true,
      phone: true,
      profileImage: true,
      timetableCode: true,
      department: { select: { id: true, name: true, code: true } },
      lecturerOffice: {
        select: { id: true, roomNumber: true, building: true, floor: true },
      },
      scheduleSlots: {
        select: {
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          slotType: true,
          label: true,
          location: true,
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      },
    },
  });
  if (!lecturer) return null;

  const derivedOnly =
    !lecturer.timetableCode?.trim() &&
    !!deriveTimetableCodeFromName(lecturer.firstName, lecturer.lastName);

  const places: DirectoryTeachingHall[] = [];
  if (lecturer.lecturerOffice) {
    places.push({
      name: `Office ${lecturer.lecturerOffice.roomNumber}`,
      building: lecturer.lecturerOffice.building,
    });
  }
  for (const s of lecturer.scheduleSlots) {
    const loc = s.location?.trim();
    if (loc && !places.some((p) => p.name === loc)) {
      places.push({ name: loc, building: loc });
    }
  }

  return {
    id: lecturer.id,
    firstName: lecturer.firstName,
    lastName: lecturer.lastName,
    designation: lecturer.designation,
    email: lecturer.email,
    phone: lecturer.phone,
    profileImage: lecturer.profileImage,
    timetableCode: effectiveTimetableCode(
      lecturer.firstName,
      lecturer.lastName,
      lecturer.timetableCode,
    ),
    derivedFromName: derivedOnly,
    bookable: true,
    isFetOnly: false,
    department: lecturer.department,
    office: lecturer.lecturerOffice,
    scheduleSlots: lecturer.scheduleSlots,
    teachingHalls: places,
  };
}
