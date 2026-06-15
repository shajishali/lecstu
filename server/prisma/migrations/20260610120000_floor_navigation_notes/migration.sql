-- Story-based indoor navigation: admin notes + parsed guide per floor

ALTER TABLE "floor_plans" ADD COLUMN IF NOT EXISTS "navigationNotes" TEXT;
ALTER TABLE "floor_plans" ADD COLUMN IF NOT EXISTS "navigationGuide" JSONB;
