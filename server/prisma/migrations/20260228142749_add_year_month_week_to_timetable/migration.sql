-- DropIndex
DROP INDEX "idx_timetable_group_day";

-- DropIndex
DROP INDEX "idx_timetable_hall_slot";

-- DropIndex
DROP INDEX "idx_timetable_lecturer_slot";

-- DropIndex
DROP INDEX "master_timetable_hallId_dayOfWeek_idx";

-- DropIndex
DROP INDEX "master_timetable_lecturerId_dayOfWeek_idx";

-- AlterTable
ALTER TABLE "master_timetable" ADD COLUMN     "month" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "week" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "idx_timetable_hall_slot" ON "master_timetable"("year", "month", "week", "dayOfWeek", "startTime", "hallId");

-- CreateIndex
CREATE INDEX "idx_timetable_lecturer_slot" ON "master_timetable"("year", "month", "week", "dayOfWeek", "startTime", "lecturerId");

-- CreateIndex
CREATE INDEX "idx_timetable_group_day" ON "master_timetable"("groupId", "year", "month", "week", "dayOfWeek");

-- CreateIndex
CREATE INDEX "master_timetable_lecturerId_year_month_week_dayOfWeek_idx" ON "master_timetable"("lecturerId", "year", "month", "week", "dayOfWeek");

-- CreateIndex
CREATE INDEX "master_timetable_hallId_year_month_week_dayOfWeek_idx" ON "master_timetable"("hallId", "year", "month", "week", "dayOfWeek");
