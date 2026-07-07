-- CreateTable
CREATE TABLE "student_timetable_module_configs" (
    "studentId" TEXT NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "configuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_timetable_module_configs_pkey" PRIMARY KEY ("studentId")
);

-- AddForeignKey
ALTER TABLE "student_timetable_module_configs" ADD CONSTRAINT "student_timetable_module_configs_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
