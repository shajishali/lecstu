-- Backup manual walking paths so auto-build cannot permanently erase admin work
ALTER TABLE "floor_plans" ADD COLUMN "walkingPathsSnapshot" JSONB;
