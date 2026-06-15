-- Add ROOM place type for generic rooms (e.g. changing room, staff room)

DO $$ BEGIN
  ALTER TYPE "MapMarkerType" ADD VALUE 'ROOM';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
