-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'CANCELLATION_REQUESTED';

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "appointments" ADD COLUMN "cancellationRequestedAt" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN "cancellationPreviousStatus" TEXT;
