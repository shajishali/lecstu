-- AlterTable
ALTER TABLE "users" ADD COLUMN "adminLastModifiedAt" TIMESTAMP(3),
ADD COLUMN "adminLastModifiedById" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_adminLastModifiedById_fkey" FOREIGN KEY ("adminLastModifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
