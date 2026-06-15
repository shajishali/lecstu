-- Indoor Navigation Module: QR positioning, navigation sessions, EXIT node type, floor scale

-- CreateEnum
CREATE TYPE "PositionSource" AS ENUM ('QR_CODE', 'BLE_BEACON', 'UWB', 'MANUAL', 'ENTRANCE_DEFAULT');
CREATE TYPE "NavigationSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- AlterEnum (NavNodeType: add EXIT)
ALTER TYPE "NavNodeType" ADD VALUE IF NOT EXISTS 'EXIT';

-- AlterTable
ALTER TABLE "floor_plans" ADD COLUMN IF NOT EXISTS "scaleMetersPerUnit" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "nav_qr_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "buildingId" TEXT NOT NULL,
    "navNodeId" TEXT NOT NULL,

    CONSTRAINT "nav_qr_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "navigation_sessions" (
    "id" TEXT NOT NULL,
    "status" "NavigationSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "positionSource" "PositionSource" NOT NULL DEFAULT 'ENTRANCE_DEFAULT',
    "currentFloor" INTEGER,
    "currentNodeId" TEXT,
    "destinationNodeId" TEXT,
    "routePayload" JSONB,
    "stepIndex" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,

    CONSTRAINT "navigation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nav_qr_codes_code_key" ON "nav_qr_codes"("code");
CREATE INDEX "nav_qr_codes_buildingId_idx" ON "nav_qr_codes"("buildingId");
CREATE INDEX "nav_qr_codes_navNodeId_idx" ON "nav_qr_codes"("navNodeId");
CREATE INDEX "navigation_sessions_userId_status_idx" ON "navigation_sessions"("userId", "status");
CREATE INDEX "navigation_sessions_buildingId_idx" ON "navigation_sessions"("buildingId");

-- AddForeignKey
ALTER TABLE "nav_qr_codes" ADD CONSTRAINT "nav_qr_codes_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "map_buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nav_qr_codes" ADD CONSTRAINT "nav_qr_codes_navNodeId_fkey" FOREIGN KEY ("navNodeId") REFERENCES "nav_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "navigation_sessions" ADD CONSTRAINT "navigation_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "navigation_sessions" ADD CONSTRAINT "navigation_sessions_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "map_buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
