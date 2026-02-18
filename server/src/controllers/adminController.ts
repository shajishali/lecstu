import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';

export async function getDashboardStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const [
      totalUsers,
      students,
      lecturers,
      admins,
      faculties,
      departments,
      courses,
      halls,
      offices,
      groups,
      timetableEntries,
      appointments,
      buildings,
    ] = await Promise.all([
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

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, students, lecturers, admins },
        academic: { faculties, departments, courses, groups },
        facilities: { halls, offices, buildings },
        operations: { timetableEntries, appointments },
      },
    });
  } catch (err) {
    next(err);
  }
}
