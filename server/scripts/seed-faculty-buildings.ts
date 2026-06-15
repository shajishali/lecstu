/**
 * Upsert the three FCT faculty map buildings (ACAD, ADMIN, LAB). Phase 6.4.
 * Run: npm run db:seed-faculty-buildings
 */
import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { upsertFacultyMapBuildings } from '../src/services/facultyBuildingSeed';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding faculty map buildings (ACAD, ADMIN, LAB)...\n');

  const rows = await upsertFacultyMapBuildings(prisma);
  for (const row of rows) {
    console.log(`  ✓ ${row.code} — ${row.name} (${row.floors} floors)`);
  }

  console.log('\nDone. Upload floor JPGs via Admin → Buildings → Floor Plans');
  console.log('  or: npm run db:import-floorplans\n');
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
