/**
 * Phase 11.8 demo bootstrap — register 3 faculty buildings (ACAD, ADMIN, LAB)
 * with Ground + Floor 1 slots, then report upload/publish status.
 *
 * Run: npm run db:seed-phase-11-demo
 * Then drop JPGs in server/uploads/floorplans/import/ and run: npm run db:import-floorplans
 */
import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { upsertFacultyMapBuildings, getFacultySetupStatus } from '../src/services/facultyBuildingSeed';
import { PHASE_11_ACTIVE_FLOORS } from '../src/constants/facultyBuildings';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Phase 11.8 demo seed ===\n');

  const rows = await upsertFacultyMapBuildings(prisma);
  for (const row of rows) {
    console.log(`  ✓ ${row.code} — ${row.name} (${row.floors} floors)`);
  }

  const status = await getFacultySetupStatus(prisma);
  console.log('\n--- Setup status ---');
  console.log(`  Buildings registered: ${status.allBuildingsExist ? 'yes' : 'no'}`);
  console.log(
    `  Phase 11 floors (G + F1): ${status.phase11Uploaded}/${status.phase11Target} uploaded, ${status.phase11Published} published`
  );

  for (const b of status.buildings) {
    const floors = PHASE_11_ACTIVE_FLOORS.map((f) => (f === 0 ? 'G' : `F${f}`)).join(', ');
    const missing = b.phase11MissingFloors.length
      ? b.phase11MissingFloors.map((f) => (f === 0 ? 'G' : `F${f}`)).join(', ')
      : 'none';
    console.log(
      `  ${b.code}: ${b.uploadedCount} image(s) · ${b.phase11PublishedCount}/${PHASE_11_ACTIVE_FLOORS.length} published · missing: ${missing}`
    );
  }

  console.log('\nNext steps (no code changes):');
  console.log('  1. Add floor JPGs to server/uploads/floorplans/import/ (e.g. ACAD_floor0.jpg)');
  console.log('  2. npm run db:import-floorplans');
  console.log('  3. Admin → Indoor Navigation → Setup → Run AI analyze');
  console.log('  4. Markers tab → review & publish each floor');
  console.log('  5. Walking paths → draw paths → Vertical links\n');
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
