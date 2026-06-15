import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';

const buffer = fs.readFileSync(path.resolve(process.argv[2]));
const parser = new PDFParse({ data: buffer });

async function main() {
  const textResult = await parser.getText({ cellSeparator: '\t', cellThreshold: 5 });
  const lines = ((textResult as { text?: string })?.text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (/Y3\s+AINT/i.test(lines[i]) || (lines[i] === 'Y3 AINT')) {
      console.log(`--- context @ line ${i + 1} ---`);
      for (let j = Math.max(0, i - 5); j < Math.min(lines.length, i + 25); j++) {
        console.log(`${j + 1}: ${lines[j]}`);
      }
    }
  }
  await parser.destroy();
}

main();
