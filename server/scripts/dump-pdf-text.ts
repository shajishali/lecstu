import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';

const pdfPath = process.argv[2];
const buffer = fs.readFileSync(path.resolve(pdfPath));
const parser = new PDFParse({ data: buffer });

async function main() {
  const textResult = await parser.getText({ cellSeparator: '\t', cellThreshold: 5 });
  const text = (textResult as { text?: string })?.text || '';
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  console.log('Total lines:', lines.length);
  console.log('\n--- Group-like headers ---');
  for (const l of lines) {
    if (/^Y\d+\s/i.test(l) || /^Batch:/i.test(l) || /Group$/i.test(l)) {
      console.log(l);
    }
  }
  console.log('\n--- FET footer / period ---');
  for (const l of lines) {
    if (/FET|Faculty of Computing|Semester|23-24|24-25/i.test(l)) {
      console.log(l);
    }
  }
  console.log('\n--- First 40 lines ---');
  lines.slice(0, 40).forEach((l, i) => console.log(`${i + 1}: ${l}`));
  await parser.destroy();
}

main();
