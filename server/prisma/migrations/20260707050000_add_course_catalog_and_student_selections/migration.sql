-- CreateEnum
CREATE TYPE "CourseRequirementType" AS ENUM ('COMPULSORY', 'OPTIONAL');

-- CreateTable
CREATE TABLE "program_courses" (
    "id" TEXT NOT NULL,
    "programCode" TEXT NOT NULL,
    "studyYear" INTEGER NOT NULL,
    "pathwayCode" TEXT NOT NULL DEFAULT '',
    "requirementType" "CourseRequirementType" NOT NULL DEFAULT 'COMPULSORY',
    "semester" INTEGER,
    "credits" INTEGER,
    "handbookTitle" TEXT,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_course_lecturers" (
    "id" TEXT NOT NULL,
    "programCourseId" TEXT NOT NULL,
    "lecturerId" TEXT,
    "lecturerName" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "program_course_lecturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_course_selections" (
    "id" TEXT NOT NULL,
    "academicYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "student_course_selections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "program_courses_programCode_studyYear_pathwayCode_idx" ON "program_courses"("programCode", "studyYear", "pathwayCode");

-- CreateIndex
CREATE UNIQUE INDEX "program_courses_programCode_studyYear_pathwayCode_courseId_key" ON "program_courses"("programCode", "studyYear", "pathwayCode", "courseId");

-- CreateIndex
CREATE INDEX "program_course_lecturers_programCourseId_idx" ON "program_course_lecturers"("programCourseId");

-- CreateIndex
CREATE INDEX "program_course_lecturers_lecturerId_idx" ON "program_course_lecturers"("lecturerId");

-- CreateIndex
CREATE INDEX "student_course_selections_studentId_idx" ON "student_course_selections"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "student_course_selections_studentId_courseId_academicYear_key" ON "student_course_selections"("studentId", "courseId", "academicYear");

-- AddForeignKey
ALTER TABLE "program_courses" ADD CONSTRAINT "program_courses_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_course_lecturers" ADD CONSTRAINT "program_course_lecturers_programCourseId_fkey" FOREIGN KEY ("programCourseId") REFERENCES "program_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_course_lecturers" ADD CONSTRAINT "program_course_lecturers_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_course_selections" ADD CONSTRAINT "student_course_selections_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_course_selections" ADD CONSTRAINT "student_course_selections_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
