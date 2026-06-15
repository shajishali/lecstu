-- CreateEnum
CREATE TYPE "NavNodeType" AS ENUM ('ROOM', 'CORRIDOR', 'STAIRS', 'LIFT', 'ENTRANCE');

-- CreateTable
CREATE TABLE "nav_nodes" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "type" "NavNodeType" NOT NULL,
    "mapMarkerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nav_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nav_edges" (
    "id" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "bidirectional" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nav_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nav_nodes_mapMarkerId_key" ON "nav_nodes"("mapMarkerId");

-- CreateIndex
CREATE INDEX "nav_nodes_buildingId_floor_idx" ON "nav_nodes"("buildingId", "floor");

-- CreateIndex
CREATE UNIQUE INDEX "nav_edges_fromNodeId_toNodeId_key" ON "nav_edges"("fromNodeId", "toNodeId");

-- CreateIndex
CREATE INDEX "nav_edges_fromNodeId_idx" ON "nav_edges"("fromNodeId");

-- CreateIndex
CREATE INDEX "nav_edges_toNodeId_idx" ON "nav_edges"("toNodeId");

-- AddForeignKey
ALTER TABLE "nav_nodes" ADD CONSTRAINT "nav_nodes_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "map_buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nav_nodes" ADD CONSTRAINT "nav_nodes_mapMarkerId_fkey" FOREIGN KEY ("mapMarkerId") REFERENCES "map_markers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nav_edges" ADD CONSTRAINT "nav_edges_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "nav_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nav_edges" ADD CONSTRAINT "nav_edges_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "nav_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
