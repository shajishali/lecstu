/**
 * CLI: extract FET timetable rows as JSON (used by Python timetable-extract service fallback).
 * Usage: npx tsx scripts/pdf-extract-json.ts <path-to.pdf>
 */
import fs from 'fs';
import path from 'path';
import { parsePdfBuiltIn } from '../src/services/timetableParserService';

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error(JSON.stringify({ success: false, error: 'Usage: pdf-extract-json.ts <pdf>' }));
  process.exit(1);
}

async function main() {
  const abs = path.resolve(pdfPath);
  const buffer = fs.readFileSync(abs);
  const result = await parsePdfBuiltIn(buffer, path.basename(abs));
  console.log(
    JSON.stringify({
      success: true,
      rows: result.rows,
      errors: result.errors,
      engine: result.headersDetected.format || 'node-pdf-parse',
      total: result.rows.length,
    }),
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ success: false, error: String(e) }));
  process.exit(1);
});
