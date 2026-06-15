/**
 * List parsed CS-Y3-AINT slots (after pathway filter).
 * Usage: npx tsx scripts/debug-aint-slots.ts <pdf-or-xlsx>
 */
import fs from 'fs';
import path from 'path';
import { parseTimetableFile } from '../src/services/timetableParserService';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npx tsx scripts/debug-aint-slots.ts <file>');
  process.exit(1);
}

async function main() {
  const buf = fs.readFileSync(path.resolve(file));
  const r = await parseTimetableFile(buf, path.basename(file));
  const exact = r.rows.filter((x) => x.groupName === 'CS-Y3-AINT');
  const related = r.rows.filter(
    (x) => /AINT/i.test(x.groupName) || /AINT/i.test(x.courseName),
  );
  console.log('CS-Y3-AINT exact:', exact.length);
  console.log('AINT-related total:', related.length);
  for (const x of related) {
    console.log(`${x.groupName} | ${x.dayOfWeek} ${x.startTime}-${x.endTime} | ${x.courseName}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
