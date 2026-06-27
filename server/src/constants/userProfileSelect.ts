/** Shared Prisma select for /auth/me and /profile */
export const userProfileSelect = {
  id: true,
  email: true,
  recoveryEmail: true,
  firstName: true,
  lastName: true,
  role: true,
  phone: true,
  profileImage: true,
  designation: true,
  timetableCode: true,
  isActive: true,
  department: { select: { id: true, name: true, code: true } },
  lecturerOffice: { select: { id: true, roomNumber: true, building: true, floor: true } },
  studentGroupMemberships: {
    select: {
      selectedBatchYearLabel: true,
      group: {
        select: {
          id: true,
          name: true,
          batchYear: true,
          batchLabel: true,
          pathway: { select: { id: true, name: true, code: true } },
        },
      },
    },
  },
  createdAt: true,
  updatedAt: true,
} as const;
