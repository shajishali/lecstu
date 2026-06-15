-- Phase 11.1: floor plan publish workflow + EXIT marker type for building connections

CREATE TYPE "FloorPlanPublishStatus" AS ENUM ('DRAFT', 'REVIEWED', 'PUBLISHED');

ALTER TABLE "floor_plans" ADD COLUMN IF NOT EXISTS "publishStatus" "FloorPlanPublishStatus" NOT NULL DEFAULT 'DRAFT';

DO $$ BEGIN
  ALTER TYPE "MapMarkerType" ADD VALUE 'EXIT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
