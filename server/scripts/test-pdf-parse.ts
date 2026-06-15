import fs from 'fs';
import path from 'path';
import { parsePdf } from '../src/services/timetableParserService';

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Usage: npx tsx scripts/test-pdf-parse.ts <path-to-pdf>');
  process.exit(1);
}

async function main() {
  const buffer = fs.readFileSync(path.resolve(pdfPath));
  const result = await parsePdf(buffer, path.basename(pdfPath));
  console.log('Rows parsed:', result.rows.length);
  console.log('Errors:', result.errors.length);
  console.log('Headers detected:', result.headersDetected);
  if (result.errors.length) console.log('First errors:', result.errors.slice(0, 10));
  const groups = new Map<string, number>();
  for (const r of result.rows) {
    groups.set(r.groupName, (groups.get(r.groupName) || 0) + 1);
  }
  console.log('\nGroups (' + groups.size + '):');
  [...groups.entries()].sort((a, b) => b[1] - a[1]).forEach(([g, n]) => console.log(`  ${n}\t${g}`));
  if (result.rows.length) {
    console.log('\nSample row:', result.rows[0]);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
