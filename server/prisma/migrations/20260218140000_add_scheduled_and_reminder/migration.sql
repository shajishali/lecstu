-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'SCHEDULED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'APPOINTMENT_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE 'APPOINTMENT_REMINDER';

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
