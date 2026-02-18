import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole, DayOfWeek, MapMarkerType } from '../src/generated/prisma/client';
import bcrypt from 'bcrypt';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('🌱 Starting seed...\n');

  // ─── Clean existing data ───
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.mapMarker.deleteMany();
  await prisma.floorPlan.deleteMany();
  await prisma.mapBuilding.deleteMany();
  await prisma.masterTimetable.deleteMany();
  await prisma.studentGroupMember.deleteMany();
  await prisma.studentGroup.deleteMany();
  await prisma.lecturerOffice.deleteMany();
  await prisma.lectureHall.deleteMany();
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.faculty.deleteMany();

  console.log('  Cleaned existing data');

  // ─── FACULTIES (3) ───
  const faculties = await Promise.all([
    prisma.faculty.create({ data: { name: 'Faculty of Computing', code: 'FOC', description: 'Computing and IT programs' } }),
    prisma.faculty.create({ data: { name: 'Faculty of Engineering', code: 'FOE', description: 'Engineering and technology programs' } }),
    prisma.faculty.create({ data: { name: 'Faculty of Science', code: 'FOS', description: 'Pure and applied science programs' } }),
  ]);
  console.log(`  ✓ Created ${faculties.length} faculties`);

  // ─── DEPARTMENTS (6) ───
  const departments = await Promise.all([
    prisma.department.create({ data: { name: 'Computer Science', code: 'CS', facultyId: faculties[0].id } }),
    prisma.department.create({ data: { name: 'Information Technology', code: 'IT', facultyId: faculties[0].id } }),
    prisma.department.create({ data: { name: 'Electrical Engineering', code: 'EE', facultyId: faculties[1].id } }),
    prisma.department.create({ data: { name: 'Mechanical Engineering', code: 'ME', facultyId: faculties[1].id } }),
    prisma.department.create({ data: { name: 'Mathematics', code: 'MATH', facultyId: faculties[2].id } }),
    prisma.department.create({ data: { name: 'Physics', code: 'PHY', facultyId: faculties[2].id } }),
  ]);
  console.log(`  ✓ Created ${departments.length} departments`);

  // ─── ADMIN USERS (2) ───
  const defaultPassword = await hashPassword('lecstu123');

  const admins = await Promise.all([
    prisma.user.create({
      data: { email: 'admin@lecstu.edu', password: defaultPassword, role: UserRole.ADMIN, firstName: 'System', lastName: 'Admin', departmentId: departments[0].id },
    }),
    prisma.user.create({
      data: { email: 'admin2@lecstu.edu', password: defaultPassword, role: UserRole.ADMIN, firstName: 'Deputy', lastName: 'Admin', departmentId: departments[1].id },
    }),
  ]);
  console.log(`  ✓ Created ${admins.length} admins`);

  // ─── LECTURERS (20) ───
  const lecturerData = [
    { firstName: 'Kumara', lastName: 'Perera', dept: 0 },
    { firstName: 'Nimal', lastName: 'Silva', dept: 0 },
    { firstName: 'Sachini', lastName: 'Fernando', dept: 0 },
    { firstName: 'Rajesh', lastName: 'Kumar', dept: 1 },
    { firstName: 'Dilani', lastName: 'Jayawardena', dept: 1 },
    { firstName: 'Suresh', lastName: 'Bandara', dept: 1 },
    { firstName: 'Kamala', lastName: 'Wijesinghe', dept: 2 },
    { firstName: 'Rohan', lastName: 'Gunaratne', dept: 2 },
    { firstName: 'Priya', lastName: 'Ramanathan', dept: 2 },
    { firstName: 'Tharindu', lastName: 'Dissanayake', dept: 3 },
    { firstName: 'Malini', lastName: 'Wickramasinghe', dept: 3 },
    { firstName: 'Saman', lastName: 'Rathnayake', dept: 3 },
    { firstName: 'Anjali', lastName: 'Pathirana', dept: 4 },
    { firstName: 'Lakshman', lastName: 'Herath', dept: 4 },
    { firstName: 'Deepika', lastName: 'Senanayake', dept: 4 },
    { firstName: 'Nuwan', lastName: 'Karunaratne', dept: 5 },
    { firstName: 'Chathura', lastName: 'Weerasinghe', dept: 5 },
    { firstName: 'Ishara', lastName: 'Abeysekara', dept: 5 },
    { firstName: 'Vimukthi', lastName: 'De Alwis', dept: 0 },
    { firstName: 'Thamara', lastName: 'Liyanage', dept: 1 },
  ];

  const lecturers = await Promise.all(
    lecturerData.map((l, i) =>
      prisma.user.create({
        data: {
          email: `lecturer${i + 1}@lecstu.edu`,
          password: defaultPassword,
          role: UserRole.LECTURER,
          firstName: l.firstName,
          lastName: l.lastName,
          departmentId: departments[l.dept].id,
        },
      })
    )
  );
  console.log(`  ✓ Created ${lecturers.length} lecturers`);

  // ─── STUDENTS (100) ───
  const firstNames = [
    'Amal', 'Bimal', 'Chamara', 'Dinesh', 'Eshan', 'Fathima', 'Gayan', 'Harsha',
    'Isuru', 'Janaka', 'Kasun', 'Lahiru', 'Madhavi', 'Niluka', 'Oshadha', 'Pasan',
    'Rashmi', 'Sandun', 'Thilini', 'Udara', 'Vindya', 'Wasana', 'Yasith', 'Zainab',
    'Akila',
  ];
  const lastNames = [
    'Perera', 'Silva', 'Fernando', 'Jayasuriya', 'Wijeratne', 'Bandara', 'Gunasekara',
    'Ratnayake', 'Herath', 'Dissanayake', 'Senaratne', 'Jayawardena', 'Wickramasinghe',
    'Amarasinghe', 'Gunawardena', 'Kumarasinghe', 'Rajapaksa', 'Samaraweera',
    'Thilakaratne', 'Weerasekara',
  ];

  const students = await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      prisma.user.create({
        data: {
          email: `student${i + 1}@lecstu.edu`,
          password: defaultPassword,
          role: UserRole.STUDENT,
          firstName: firstNames[i % firstNames.length],
          lastName: lastNames[i % lastNames.length],
          departmentId: departments[i % departments.length].id,
        },
      })
    )
  );
  console.log(`  ✓ Created ${students.length} students`);

  // ─── LECTURE HALLS (10) ───
  const halls = await Promise.all([
    prisma.lectureHall.create({ data: { name: 'Hall A', building: 'Main Building', floor: 0, capacity: 200, equipment: ['projector', 'mic', 'whiteboard'] } }),
    prisma.lectureHall.create({ data: { name: 'Hall B', building: 'Main Building', floor: 0, capacity: 150, equipment: ['projector', 'whiteboard'] } }),
    prisma.lectureHall.create({ data: { name: 'Hall C', building: 'Main Building', floor: 1, capacity: 100, equipment: ['projector', 'mic', 'smartboard'] } }),
    prisma.lectureHall.create({ data: { name: 'Lab 1', building: 'Computing Block', floor: 0, capacity: 40, equipment: ['computers', 'projector'] } }),
    prisma.lectureHall.create({ data: { name: 'Lab 2', building: 'Computing Block', floor: 0, capacity: 40, equipment: ['computers', 'projector'] } }),
    prisma.lectureHall.create({ data: { name: 'Lab 3', building: 'Computing Block', floor: 1, capacity: 35, equipment: ['computers', 'projector', 'smartboard'] } }),
    prisma.lectureHall.create({ data: { name: 'Seminar Room 1', building: 'Science Block', floor: 0, capacity: 30, equipment: ['projector', 'whiteboard'] } }),
    prisma.lectureHall.create({ data: { name: 'Seminar Room 2', building: 'Science Block', floor: 1, capacity: 25, equipment: ['projector', 'whiteboard'] } }),
    prisma.lectureHall.create({ data: { name: 'Auditorium', building: 'Admin Building', floor: 0, capacity: 500, equipment: ['projector', 'mic', 'speakers', 'stage'] } }),
    prisma.lectureHall.create({ data: { name: 'Workshop Hall', building: 'Engineering Block', floor: 0, capacity: 60, equipment: ['workbenches', 'projector', 'tools'] } }),
  ]);
  console.log(`  ✓ Created ${halls.length} lecture halls`);

  // ─── LECTURER OFFICES (20) ───
  await Promise.all(
    lecturers.map((lec, i) =>
      prisma.lecturerOffice.create({
        data: {
          roomNumber: `R${100 + i}`,
          building: ['Main Building', 'Computing Block', 'Science Block', 'Engineering Block'][i % 4],
          floor: i % 3,
          lecturerId: lec.id,
        },
      })
    )
  );
  console.log('  ✓ Created 20 lecturer offices');

  // ─── COURSES (15) ───
  const courses = await Promise.all([
    prisma.course.create({ data: { name: 'Data Structures & Algorithms', code: 'CS2012', credits: 4, semester: 1, departmentId: departments[0].id } }),
    prisma.course.create({ data: { name: 'Database Systems', code: 'CS2023', credits: 3, semester: 1, departmentId: departments[0].id } }),
    prisma.course.create({ data: { name: 'Artificial Intelligence', code: 'CS3045', credits: 3, semester: 1, departmentId: departments[0].id } }),
    prisma.course.create({ data: { name: 'Web Development', code: 'IT2015', credits: 3, semester: 1, departmentId: departments[1].id } }),
    prisma.course.create({ data: { name: 'Network Security', code: 'IT3022', credits: 3, semester: 1, departmentId: departments[1].id } }),
    prisma.course.create({ data: { name: 'Software Engineering', code: 'IT2034', credits: 4, semester: 1, departmentId: departments[1].id } }),
    prisma.course.create({ data: { name: 'Circuit Theory', code: 'EE1011', credits: 3, semester: 1, departmentId: departments[2].id } }),
    prisma.course.create({ data: { name: 'Digital Electronics', code: 'EE2018', credits: 3, semester: 1, departmentId: departments[2].id } }),
    prisma.course.create({ data: { name: 'Thermodynamics', code: 'ME1012', credits: 3, semester: 1, departmentId: departments[3].id } }),
    prisma.course.create({ data: { name: 'Fluid Mechanics', code: 'ME2024', credits: 3, semester: 1, departmentId: departments[3].id } }),
    prisma.course.create({ data: { name: 'Linear Algebra', code: 'MATH1010', credits: 3, semester: 1, departmentId: departments[4].id } }),
    prisma.course.create({ data: { name: 'Probability & Statistics', code: 'MATH2021', credits: 3, semester: 1, departmentId: departments[4].id } }),
    prisma.course.create({ data: { name: 'Classical Mechanics', code: 'PHY1011', credits: 3, semester: 1, departmentId: departments[5].id } }),
    prisma.course.create({ data: { name: 'Quantum Physics', code: 'PHY3035', credits: 3, semester: 1, departmentId: departments[5].id } }),
    prisma.course.create({ data: { name: 'Machine Learning', code: 'CS3056', credits: 4, semester: 1, departmentId: departments[0].id } }),
  ]);
  console.log(`  ✓ Created ${courses.length} courses`);

  // ─── STUDENT GROUPS (5) ───
  const groups = await Promise.all([
    prisma.studentGroup.create({ data: { name: 'CS-2024-A', batchYear: 2024, departmentId: departments[0].id } }),
    prisma.studentGroup.create({ data: { name: 'CS-2024-B', batchYear: 2024, departmentId: departments[0].id } }),
    prisma.studentGroup.create({ data: { name: 'IT-2024-A', batchYear: 2024, departmentId: departments[1].id } }),
    prisma.studentGroup.create({ data: { name: 'EE-2024-A', batchYear: 2024, departmentId: departments[2].id } }),
    prisma.studentGroup.create({ data: { name: 'MATH-2024-A', batchYear: 2024, departmentId: departments[4].id } }),
  ]);
  console.log(`  ✓ Created ${groups.length} student groups`);

  // ─── ASSIGN STUDENTS TO GROUPS ───
  const groupAssignments = students.map((student, i) => ({
    studentId: student.id,
    groupId: groups[i % groups.length].id,
  }));

  await prisma.studentGroupMember.createMany({ data: groupAssignments });
  console.log(`  ✓ Assigned ${groupAssignments.length} students to groups`);

  // ─── MASTER TIMETABLE (weekly schedule) ───
  const timeSlots = [
    { start: '08:00', end: '09:00' },
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
    { start: '13:00', end: '14:00' },
    { start: '14:00', end: '15:00' },
    { start: '15:00', end: '16:00' },
  ];

  const timetableEntries = [
    // Monday
    { day: DayOfWeek.MONDAY, slot: 0, course: 0, lecturer: 0, hall: 0, group: 0 },
    { day: DayOfWeek.MONDAY, slot: 1, course: 1, lecturer: 1, hall: 3, group: 0 },
    { day: DayOfWeek.MONDAY, slot: 2, course: 3, lecturer: 3, hall: 1, group: 2 },
    { day: DayOfWeek.MONDAY, slot: 3, course: 6, lecturer: 6, hall: 2, group: 3 },
    { day: DayOfWeek.MONDAY, slot: 4, course: 10, lecturer: 12, hall: 6, group: 4 },
    { day: DayOfWeek.MONDAY, slot: 5, course: 14, lecturer: 18, hall: 4, group: 1 },
    // Tuesday
    { day: DayOfWeek.TUESDAY, slot: 0, course: 2, lecturer: 2, hall: 0, group: 0 },
    { day: DayOfWeek.TUESDAY, slot: 1, course: 4, lecturer: 4, hall: 1, group: 2 },
    { day: DayOfWeek.TUESDAY, slot: 2, course: 7, lecturer: 7, hall: 2, group: 3 },
    { day: DayOfWeek.TUESDAY, slot: 3, course: 11, lecturer: 13, hall: 6, group: 4 },
    { day: DayOfWeek.TUESDAY, slot: 4, course: 0, lecturer: 0, hall: 3, group: 1 },
    { day: DayOfWeek.TUESDAY, slot: 5, course: 8, lecturer: 9, hall: 9, group: 3 },
    // Wednesday
    { day: DayOfWeek.WEDNESDAY, slot: 0, course: 5, lecturer: 5, hall: 1, group: 2 },
    { day: DayOfWeek.WEDNESDAY, slot: 1, course: 12, lecturer: 15, hall: 7, group: 4 },
    { day: DayOfWeek.WEDNESDAY, slot: 2, course: 1, lecturer: 1, hall: 0, group: 0 },
    { day: DayOfWeek.WEDNESDAY, slot: 3, course: 9, lecturer: 10, hall: 9, group: 3 },
    { day: DayOfWeek.WEDNESDAY, slot: 4, course: 3, lecturer: 3, hall: 4, group: 2 },
    { day: DayOfWeek.WEDNESDAY, slot: 5, course: 13, lecturer: 16, hall: 7, group: 4 },
    // Thursday
    { day: DayOfWeek.THURSDAY, slot: 0, course: 14, lecturer: 18, hall: 5, group: 0 },
    { day: DayOfWeek.THURSDAY, slot: 1, course: 2, lecturer: 2, hall: 0, group: 1 },
    { day: DayOfWeek.THURSDAY, slot: 2, course: 6, lecturer: 6, hall: 2, group: 3 },
    { day: DayOfWeek.THURSDAY, slot: 3, course: 10, lecturer: 12, hall: 6, group: 4 },
    { day: DayOfWeek.THURSDAY, slot: 4, course: 4, lecturer: 4, hall: 1, group: 2 },
    { day: DayOfWeek.THURSDAY, slot: 5, course: 0, lecturer: 0, hall: 3, group: 0 },
    // Friday
    { day: DayOfWeek.FRIDAY, slot: 0, course: 5, lecturer: 5, hall: 4, group: 2 },
    { day: DayOfWeek.FRIDAY, slot: 1, course: 8, lecturer: 9, hall: 9, group: 3 },
    { day: DayOfWeek.FRIDAY, slot: 2, course: 11, lecturer: 13, hall: 7, group: 4 },
    { day: DayOfWeek.FRIDAY, slot: 3, course: 1, lecturer: 1, hall: 0, group: 1 },
    { day: DayOfWeek.FRIDAY, slot: 4, course: 7, lecturer: 7, hall: 2, group: 3 },
    { day: DayOfWeek.FRIDAY, slot: 5, course: 14, lecturer: 18, hall: 5, group: 1 },
  ];

  await prisma.masterTimetable.createMany({
    data: timetableEntries.map((e) => ({
      dayOfWeek: e.day,
      startTime: timeSlots[e.slot].start,
      endTime: timeSlots[e.slot].end,
      courseId: courses[e.course].id,
      lecturerId: lecturers[e.lecturer].id,
      hallId: halls[e.hall].id,
      groupId: groups[e.group].id,
      semester: 1,
      year: 2026,
    })),
  });
  console.log(`  ✓ Created ${timetableEntries.length} timetable entries`);

  // ─── MAP BUILDINGS (4) ───
  const buildings = await Promise.all([
    prisma.mapBuilding.create({ data: { name: 'Main Building', code: 'MAIN', latitude: 7.2906, longitude: 80.6337, floors: 3 } }),
    prisma.mapBuilding.create({ data: { name: 'Computing Block', code: 'COMP', latitude: 7.2910, longitude: 80.6340, floors: 2 } }),
    prisma.mapBuilding.create({ data: { name: 'Science Block', code: 'SCI', latitude: 7.2903, longitude: 80.6342, floors: 2 } }),
    prisma.mapBuilding.create({ data: { name: 'Engineering Block', code: 'ENG', latitude: 7.2908, longitude: 80.6335, floors: 2 } }),
  ]);
  console.log(`  ✓ Created ${buildings.length} map buildings`);

  // ─── MAP MARKERS (sample) ───
  await prisma.mapMarker.createMany({
    data: [
      { buildingId: buildings[0].id, floor: 0, type: MapMarkerType.HALL, label: 'Hall A', x: 50, y: 30, hallId: halls[0].id },
      { buildingId: buildings[0].id, floor: 0, type: MapMarkerType.HALL, label: 'Hall B', x: 50, y: 60, hallId: halls[1].id },
      { buildingId: buildings[0].id, floor: 1, type: MapMarkerType.HALL, label: 'Hall C', x: 50, y: 30, hallId: halls[2].id },
      { buildingId: buildings[1].id, floor: 0, type: MapMarkerType.HALL, label: 'Lab 1', x: 30, y: 40, hallId: halls[3].id },
      { buildingId: buildings[1].id, floor: 0, type: MapMarkerType.HALL, label: 'Lab 2', x: 70, y: 40, hallId: halls[4].id },
      { buildingId: buildings[0].id, floor: 0, type: MapMarkerType.ENTRANCE, label: 'Main Entrance', x: 50, y: 95 },
      { buildingId: buildings[1].id, floor: 0, type: MapMarkerType.ENTRANCE, label: 'Computing Entrance', x: 50, y: 95 },
      { buildingId: buildings[2].id, floor: 0, type: MapMarkerType.AMENITY, label: 'Canteen', x: 80, y: 50 },
    ],
  });
  console.log('  ✓ Created 8 map markers');

  console.log('\n✅ Seed completed successfully!');
  console.log('   Credentials for all users: password = "lecstu123"');
  console.log('   Admin login: admin@lecstu.edu / lecstu123\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
