/**
 * Import handbook catalog JSON and merge lecturer data from timetables.
 * Usage: npm run handbook:seed
 */
import {
  enrichAllCourseNamesFromCatalog,
  importHandbookCatalogFile,
  syncCatalogFromTimetable,
} from '../src/services/handbookCatalogService';
import type { HandbookCatalogFile } from '../types/handbookCatalog';
import fs from 'fs';
import path from 'path';

const jsonPath = path.resolve(__dirname, '../data/handbook-extract/fct-handbook-catalog.json');

async function main() {
  if (!fs.existsSync(jsonPath)) {
    console.error('Catalog JSON missing. Run: python scripts/build-fct-handbook-catalog.py');
    process.exit(1);
  }

  const file = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as HandbookCatalogFile;
  const imported = await importHandbookCatalogFile(file);
  console.log(`Handbook import: ${imported.imported} entries, ${imported.errors.length} errors`);
  if (imported.errors.length) {
    console.warn(imported.errors.slice(0, 10).join('\n'));
  }

  const { synced } = await syncCatalogFromTimetable();
  console.log(`Timetable sync: ${synced} group-course links (adds lecturers + missing slots)`);

  const enriched = await enrichAllCourseNamesFromCatalog();
  console.log(`Updated ${enriched} course display names from handbook titles`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
