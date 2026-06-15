import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';

export async function getDashboardStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const counts = await Promise.allSettled([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.user.count({ where: { role: 'LECTURER' } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.faculty.count(),
      prisma.department.count(),
      prisma.course.count(),
      prisma.lectureHall.count(),
      prisma.lecturerOffice.count(),
      prisma.studentGroup.count(),
      prisma.masterTimetable.count(),
      prisma.appointment.count(),
      prisma.mapBuilding.count(),
    ]);

    const get = (i: number) => (counts[i].status === 'fulfilled' ? counts[i].value : 0);

    res.json({
      success: true,
      data: {
        users: { total: get(0), students: get(1), lecturers: get(2), admins: get(3) },
        academic: { faculties: get(4), departments: get(5), courses: get(6), groups: get(9) },
        facilities: { halls: get(7), offices: get(8), buildings: get(12) },
        operations: { timetableEntries: get(10), appointments: get(11) },
      },
    });
  } catch (err) {
    next(err);
  }
}
