-- Floor plan drawable region (excludes legend text below architecture)
ALTER TABLE "floor_plans" ADD COLUMN IF NOT EXISTS "drawableRegion" JSONB;
