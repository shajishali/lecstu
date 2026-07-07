/**
 * Import handbook catalog JSON into the database.
 * Usage: npx tsx scripts/import-handbook-catalog.ts [catalog.json]
 */
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import type { HandbookCatalogFile } from '../src/types/handbookCatalog';
import {
  enrichAllCourseNamesFromCatalog,
  importHandbookCatalogFile,
} from '../src/services/handbookCatalogService';

const defaultJson = path.resolve(__dirname, '../data/handbook-extract/fct-handbook-catalog.json');

async function main() {
  const jsonPath = path.resolve(process.argv[2] ?? defaultJson);
  if (!fs.existsSync(jsonPath)) {
    console.error('Catalog JSON not found:', jsonPath);
    console.error('Run: npm run handbook:extract');
    process.exit(1);
  }

  const file = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as HandbookCatalogFile;
  const result = await importHandbookCatalogFile(file);
  const enriched = await enrichAllCourseNamesFromCatalog();

  console.log(`Imported ${result.imported} catalog entries`);
  if (result.errors.length) {
    console.log('Errors:');
    result.errors.forEach((e) => console.log(' ', e));
  }
  console.log(`Updated ${enriched} course display names from handbook titles`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
