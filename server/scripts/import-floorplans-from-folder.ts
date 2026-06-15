/**
 * Import JPG/PNG floor plans from server/uploads/floorplans/import/
 * Filenames must match: ACAD_floor1.jpg, LAB_floor2.png, etc.
 * Run: npm run db:import-floorplans
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  getFloorPlansImportDir,
  moveUploadedToCanonical,
  parseFloorPlanFilename,
  defaultFloorPlanBounds,
  isValidFloorIndex,
  formatFloorLabel,
} from '../src/services/floorPlanStorage';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const importDir = getFloorPlansImportDir();
  const files = fs.readdirSync(importDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));

  if (files.length === 0) {
    console.log(`No images in ${importDir}`);
    console.log('Add files like ACAD_floor1.jpg then run again.\n');
    return;
  }

  console.log(`Importing ${files.length} floor plan(s) from import folder...\n`);

  for (const file of files) {
    const parsed = parseFloorPlanFilename(file);
    if (!parsed) {
      console.log(`  ✗ ${file} — skip (name must be CODE_floorN.jpg, e.g. ACAD_floor1.jpg)`);
      continue;
    }

    const building = await prisma.mapBuilding.findUnique({ where: { code: parsed.code } });
    if (!building) {
      console.log(`  ✗ ${file} — no building with code ${parsed.code} (run db:seed-faculty-buildings)`);
      continue;
    }

    if (!isValidFloorIndex(parsed.floor, building.floors)) {
      console.log(
        `  ✗ ${file} — floor ${parsed.floor} out of range (use 0=${formatFloorLabel(0)} … ${building.floors - 1})`
      );
      continue;
    }

    const src = path.join(importDir, file);
    const { imagePath } = moveUploadedToCanonical(src, building.code, parsed.floor, file);
    const bounds = defaultFloorPlanBounds(building.latitude, building.longitude);

    await prisma.floorPlan.upsert({
      where: { buildingId_floor: { buildingId: building.id, floor: parsed.floor } },
      create: {
        buildingId: building.id,
        floor: parsed.floor,
        imagePath,
        bounds,
      },
      update: { imagePath, bounds },
    });

    console.log(`  ✓ ${file} → ${imagePath}`);
  }

  console.log('\nImport complete. Restart dev server if map cache is stale.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
