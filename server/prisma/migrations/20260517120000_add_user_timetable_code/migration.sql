-- AlterTable
ALTER TABLE "users" ADD COLUMN "timetableCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_timetableCode_key" ON "users"("timetableCode");
