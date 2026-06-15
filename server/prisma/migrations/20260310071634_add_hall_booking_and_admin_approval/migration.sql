-- CreateEnum
CREATE TYPE "HallBookingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'PENDING_ADMIN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'APPOINTMENT_ADMIN_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'APPOINTMENT_ADMIN_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'HALL_BOOKING_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'HALL_BOOKING_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'HALL_BOOKING_REJECTED';

-- AlterTable
ALTER TABLE "appointments" ALTER COLUMN "status" SET DEFAULT 'PENDING_ADMIN';

-- CreateTable
CREATE TABLE "hall_bookings" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "reason" TEXT,
    "status" "HallBookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "studentId" TEXT NOT NULL,
    "hallId" TEXT NOT NULL,

    CONSTRAINT "hall_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hall_bookings_hallId_date_idx" ON "hall_bookings"("hallId", "date");

-- CreateIndex
CREATE INDEX "hall_bookings_studentId_idx" ON "hall_bookings"("studentId");

-- CreateIndex
CREATE INDEX "hall_bookings_status_idx" ON "hall_bookings"("status");

-- AddForeignKey
ALTER TABLE "hall_bookings" ADD CONSTRAINT "hall_bookings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hall_bookings" ADD CONSTRAINT "hall_bookings_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "lecture_halls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
