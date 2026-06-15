import prisma from '../config/database';
import {
  PROGRAMS,
  YEARS_WITH_PATHWAYS,
  buildGroupName,
  type StudyYear,
} from '../../prisma/fct-faculty-config';
import { AppError } from '../middleware/errorHandler';

export type RegisterOptionsProgram = {
  code: string;
  name: string;
  years: StudyYear[];
  pathways: { code: string; name: string }[];
};

export function getRegisterOptions(): { programs: RegisterOptionsProgram[] } {
  return {
    programs: PROGRAMS.map((p) => ({
      code: p.code,
      name: p.name,
      years: [...p.years],
      pathways: p.pathways.map((pw) => ({ code: pw.code, name: pw.name })),
    })),
  };
}

export function validateStudentEnrollmentInput(
  programCode: string,
  studyYear: string,
  pathwayCode?: string | null,
): { programCode: string; studyYear: StudyYear; pathwayCode?: string } {
  const program = PROGRAMS.find((p) => p.code === programCode.toUpperCase());
  if (!program) {
    throw new AppError('Invalid degree program. Choose CS, ET, CT, or BS.', 400);
  }

  const year = studyYear.toUpperCase() as StudyYear;
  if (!program.years.includes(year)) {
    throw new AppError(`${program.name} does not have study year ${year}.`, 400);
  }

  const needsPathway =
    YEARS_WITH_PATHWAYS.includes(year) && program.pathways.length > 0;

  if (needsPathway) {
    if (!pathwayCode?.trim()) {
      throw new AppError('Pathway is required for 3rd and 4th year students.', 400);
    }
    const pw = program.pathways.find((p) => p.code === pathwayCode.toUpperCase());
    if (!pw) {
      throw new AppError('Invalid pathway for the selected program.', 400);
    }
    return { programCode: program.code, studyYear: year, pathwayCode: pw.code };
  }

  if (pathwayCode?.trim()) {
    throw new AppError('Pathway is only required for 3rd and 4th year.', 400);
  }

  return { programCode: program.code, studyYear: year };
}

export async function resolveStudentGroupId(
  programCode: string,
  studyYear: StudyYear,
  pathwayCode?: string,
): Promise<string> {
  const groupName = buildGroupName(programCode, studyYear, pathwayCode);
  const group = await prisma.studentGroup.findFirst({
    where: { name: groupName },
    select: { id: true },
  });

  if (!group) {
    throw new AppError(
      `Student group "${groupName}" is not set up. Ask admin to run faculty seed or create the group.`,
      404,
    );
  }

  return group.id;
}

export async function assignStudentToGroup(
  studentId: string,
  programCode: string,
  studyYear: StudyYear,
  pathwayCode?: string,
): Promise<{ groupId: string; groupName: string; departmentId: string }> {
  const department = await prisma.department.findFirst({
    where: { code: programCode },
    select: { id: true },
  });
  if (!department) {
    throw new AppError(`Department for program ${programCode} not found. Run db:seed.`, 500);
  }

  const groupId = await resolveStudentGroupId(programCode, studyYear, pathwayCode);
  const groupName = buildGroupName(programCode, studyYear, pathwayCode);

  await prisma.studentGroupMember.deleteMany({ where: { studentId } });
  await prisma.studentGroupMember.create({
    data: { studentId, groupId },
  });

  await prisma.user.update({
    where: { id: studentId },
    data: { departmentId: department.id },
  });

  return { groupId, groupName, departmentId: department.id };
}
