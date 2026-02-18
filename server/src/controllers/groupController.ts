import { Request, Response, NextFunction } from 'express';
import { Readable } from 'stream';
import csvParser from 'csv-parser';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logAction } from '../services/auditLogger';

const INCLUDE = {
  department: { select: { id: true, name: true, code: true } },
  _count: { select: { members: true, timetableEntries: true } },
};

export async function listGroups(req: Request, res: Response, next: NextFunction) {
  try {
    const { search, departmentId } = req.query as Record<string, string>;
    const where: any = {};
    if (departmentId) where.departmentId = departmentId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const data = await prisma.studentGroup.findMany({
      where,
      include: INCLUDE,
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const group = await prisma.studentGroup.findUnique({
      where: { id },
      include: {
        ...INCLUDE,
        members: {
          include: { student: { select: { id: true, firstName: true, lastName: true, email: true } } },
          orderBy: { student: { firstName: 'asc' } },
        },
      },
    });
    if (!group) throw new AppError('Group not found', 404);
    res.json({ success: true, data: group });
  } catch (err) { next(err); }
}

export async function createGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, batchYear, departmentId } = req.body;
    const group = await prisma.studentGroup.create({
      data: { name, batchYear, departmentId },
      include: INCLUDE,
    });
    await logAction((req as any).user.id, 'CREATE', 'StudentGroup', group.id, { name, batchYear });
    res.status(201).json({ success: true, data: group });
  } catch (err: any) {
    if (err.code === 'P2002') return next(new AppError('A group with this name already exists in this department', 409));
    next(err);
  }
}

export async function updateGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.studentGroup.findUnique({ where: { id } });
    if (!existing) throw new AppError('Group not found', 404);

    const group = await prisma.studentGroup.update({
      where: { id },
      data: req.body,
      include: INCLUDE,
    });
    await logAction((req as any).user.id, 'UPDATE', 'StudentGroup', id, req.body);
    res.json({ success: true, data: group });
  } catch (err: any) {
    if (err.code === 'P2002') return next(new AppError('A group with this name already exists in this department', 409));
    next(err);
  }
}

export async function deleteGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.studentGroup.findUnique({ where: { id } });
    if (!existing) throw new AppError('Group not found', 404);

    await prisma.studentGroup.delete({ where: { id } });
    await logAction((req as any).user.id, 'DELETE', 'StudentGroup', id, { name: existing.name });
    res.json({ success: true, message: 'Group deleted' });
  } catch (err) { next(err); }
}

export async function assignStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = req.params.id as string;
    const { studentIds } = req.body as { studentIds: string[] };

    const group = await prisma.studentGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new AppError('Group not found', 404);

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw new AppError('studentIds array is required', 400);
    }

    const existing = await prisma.studentGroupMember.findMany({
      where: { groupId },
      select: { studentId: true },
    });
    const existingSet = new Set(existing.map((e) => e.studentId));
    const newIds = studentIds.filter((sid) => !existingSet.has(sid));

    if (newIds.length > 0) {
      await prisma.studentGroupMember.createMany({
        data: newIds.map((studentId) => ({ studentId, groupId })),
        skipDuplicates: true,
      });
    }

    await logAction((req as any).user.id, 'ASSIGN_STUDENTS', 'StudentGroup', groupId, { added: newIds.length });
    res.json({ success: true, message: `${newIds.length} students assigned`, added: newIds.length, skipped: studentIds.length - newIds.length });
  } catch (err) { next(err); }
}

export async function removeStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = req.params.id as string;
    const studentId = req.params.studentId as string;

    const membership = await prisma.studentGroupMember.findUnique({
      where: { studentId_groupId: { studentId, groupId } },
    });
    if (!membership) throw new AppError('Student is not in this group', 404);

    await prisma.studentGroupMember.delete({ where: { id: membership.id } });
    await logAction((req as any).user.id, 'REMOVE_STUDENT', 'StudentGroup', groupId, { studentId });
    res.json({ success: true, message: 'Student removed from group' });
  } catch (err) { next(err); }
}

export async function bulkAssignStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = req.params.id as string;
    if (!req.file) throw new AppError('CSV file is required', 400);

    const group = await prisma.studentGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new AppError('Group not found', 404);

    const rows: { email: string }[] = [];
    const stream = Readable.from(req.file.buffer.toString());
    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(csvParser({ mapHeaders: ({ header }: { header: string }) => header.trim() }))
        .on('data', (row: any) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    if (rows.length === 0) throw new AppError('CSV is empty', 400);

    const emails = rows.map((r) => r.email?.trim().toLowerCase()).filter(Boolean);
    const students = await prisma.user.findMany({
      where: { email: { in: emails }, role: 'STUDENT' },
      select: { id: true, email: true },
    });

    const emailToId = new Map(students.map((s) => [s.email, s.id]));
    const errors: string[] = [];
    const validIds: string[] = [];

    for (const email of emails) {
      const id = emailToId.get(email);
      if (!id) errors.push(`Student not found: ${email}`);
      else validIds.push(id);
    }

    let added = 0;
    if (validIds.length > 0) {
      const result = await prisma.studentGroupMember.createMany({
        data: validIds.map((studentId) => ({ studentId, groupId })),
        skipDuplicates: true,
      });
      added = result.count;
    }

    await logAction((req as any).user.id, 'BULK_ASSIGN', 'StudentGroup', groupId, { added, errors: errors.length });
    res.json({
      success: true,
      message: `${added} students assigned`,
      summary: { total: emails.length, added, duplicatesSkipped: validIds.length - added, notFound: errors.length },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) { next(err); }
}

export async function getAvailableStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = req.params.id as string;
    const existing = await prisma.studentGroupMember.findMany({
      where: { groupId },
      select: { studentId: true },
    });
    const excludeIds = existing.map((e) => e.studentId);

    const students = await prisma.user.findMany({
      where: { role: 'STUDENT', id: { notIn: excludeIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { firstName: 'asc' },
    });

    res.json({ success: true, data: students });
  } catch (err) { next(err); }
}
