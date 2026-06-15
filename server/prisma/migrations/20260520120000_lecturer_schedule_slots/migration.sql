-- CreateEnum
CREATE TYPE "LecturerSlotType" AS ENUM ('TEACHING', 'BUSY', 'OFFICE_HOUR');

-- CreateTable
CREATE TABLE "lecturer_schedule_slots" (
    "id" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotType" "LecturerSlotType" NOT NULL DEFAULT 'BUSY',
    "label" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lecturerId" TEXT NOT NULL,

    CONSTRAINT "lecturer_schedule_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lecturer_schedule_slots_lecturerId_dayOfWeek_idx" ON "lecturer_schedule_slots"("lecturerId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "lecturer_schedule_slots" ADD CONSTRAINT "lecturer_schedule_slots_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
