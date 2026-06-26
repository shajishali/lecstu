import prisma from '../config/database';
import {
  resolveCanonicalGroupName,
  resolveCanonicalGroupNames,
} from '../config/fct-faculty-config';

/** Resolve admin/import group id to the canonical seeded group when one exists */
export async function resolveGroupIdToCanonical(groupId: string): Promise<string> {
  const group = await prisma.studentGroup.findUnique({
    where: { id: groupId },
    select: { id: true, name: true },
  });
  if (!group) return groupId;

  const canonical = resolveCanonicalGroupName(group.name);
  if (!canonical || canonical.toUpperCase() === group.name.toUpperCase()) {
    return groupId;
  }

  const target = await prisma.studentGroup.findFirst({
    where: { name: { equals: canonical, mode: 'insensitive' } },
    select: { id: true },
  });
  return target?.id ?? groupId;
}

/**
 * Canonical class key for a student's enrolled group (e.g. CS-Y3-AINT).
 * Pathway-specific groups must not pull in generic CS-Y3 or multi-pathway PDF groups.
 */
function studentCanonicalKey(groupName: string): string {
  const single = resolveCanonicalGroupName(groupName);
  if (single) return single.toUpperCase();
  const multi = resolveCanonicalGroupNames(groupName);
  if (multi.length === 1) return multi[0].toUpperCase();
  return groupName.trim().toUpperCase();
}

/**
 * Group IDs whose timetable applies to this student: their membership plus
 * legacy PDF alias groups that map to the exact same single canonical class.
 */
export async function resolveGroupIdsForStudent(studentId: string): Promise<string[]> {
  const memberships = await prisma.studentGroupMember.findMany({
    where: { studentId },
    select: { groupId: true, group: { select: { name: true } } },
  });

  if (memberships.length === 0) return [];

  const ids = new Set<string>();
  const allGroups = await prisma.studentGroup.findMany({
    select: { id: true, name: true },
  });

  for (const m of memberships) {
    ids.add(m.groupId);
    const targetKey = studentCanonicalKey(m.group.name);

    for (const g of allGroups) {
      if (g.id === m.groupId) continue;
      const aliases = resolveCanonicalGroupNames(g.name);
      if (aliases.length === 1 && aliases[0].toUpperCase() === targetKey) {
        ids.add(g.id);
      }
    }
  }

  return [...ids];
}

/** Program / year / pathway derived from the student's enrolled group name */
export function parseEnrollmentFromGroupName(groupName: string): {
  programCode: string;
  studyYear: string;
  pathwayCode: string;
} {
  const yFirst = groupName.match(/^Y([1-4])[-\s]+(CS|ET|CT|BS|BST)(?:[-\s]+([A-Z0-9]+))?/i);
  if (yFirst) {
    const suffix = yFirst[3]?.toUpperCase() ?? '';
    return {
      programCode: yFirst[2].toUpperCase() === 'BST' ? 'BS' : yFirst[2].toUpperCase(),
      studyYear: `Y${yFirst[1]}`.toUpperCase(),
      pathwayCode: suffix.match(/^\d{2}$|^20\d{2}$/) ? '' : suffix,
    };
  }

  const parts = groupName.split('-');
  if (parts.length >= 2 && /^Y[1-4]$/i.test(parts[1])) {
    return {
      programCode: parts[0].toUpperCase(),
      studyYear: parts[1].toUpperCase(),
      pathwayCode: parts.length >= 3 ? parts.slice(2).join('-').toUpperCase() : '',
    };
  }
  return { programCode: '', studyYear: '', pathwayCode: '' };
}

export async function findCanonicalGroupId(canonicalName: string): Promise<string | null> {
  const group = await prisma.studentGroup.findFirst({
    where: { name: { equals: canonicalName, mode: 'insensitive' } },
    select: { id: true },
  });
  return group?.id ?? null;
}

export { resolveCanonicalGroupName, resolveCanonicalGroupNames };
