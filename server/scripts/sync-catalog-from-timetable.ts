/**
 * Build initial catalog from imported timetables + lecturer roster (when handbook OCR is empty).
 * Usage: npm run handbook:sync-from-timetable
 */
import 'dotenv/config';
import {
  enrichAllCourseNamesFromCatalog,
  syncCatalogFromTimetable,
} from '../src/services/handbookCatalogService';

async function main() {
  const { synced } = await syncCatalogFromTimetable();
  const enriched = await enrichAllCourseNamesFromCatalog();
  console.log(`Synced ${synced} program-course entries from master timetable`);
  console.log(`Updated ${enriched} course display names`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
