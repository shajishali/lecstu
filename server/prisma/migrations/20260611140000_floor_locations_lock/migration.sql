-- Lock floor plan + marker positions for Walking paths (Phase 11.2)
ALTER TABLE "floor_plans" ADD COLUMN "locationsLockedAt" TIMESTAMP(3);
ALTER TABLE "floor_plans" ADD COLUMN "lockedImagePath" TEXT;
ALTER TABLE "floor_plans" ADD COLUMN "lockedMarkerSnapshot" JSONB;
