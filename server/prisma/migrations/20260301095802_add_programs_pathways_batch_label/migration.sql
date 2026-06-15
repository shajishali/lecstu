-- AlterTable
ALTER TABLE "student_groups" ADD COLUMN     "batchLabel" TEXT,
ADD COLUMN     "pathwayId" TEXT;

-- CreateTable
CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "facultyId" TEXT NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pathways" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "programId" TEXT NOT NULL,

    CONSTRAINT "pathways_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "programs_code_key" ON "programs"("code");

-- CreateIndex
CREATE INDEX "programs_facultyId_idx" ON "programs"("facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "pathways_code_key" ON "pathways"("code");

-- CreateIndex
CREATE INDEX "pathways_programId_idx" ON "pathways"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "pathways_name_programId_key" ON "pathways"("name", "programId");

-- CreateIndex
CREATE INDEX "student_groups_pathwayId_idx" ON "student_groups"("pathwayId");

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathways" ADD CONSTRAINT "pathways_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_groups" ADD CONSTRAINT "student_groups_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "pathways"("id") ON DELETE SET NULL ON UPDATE CASCADE;
