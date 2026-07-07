/**
 * Render handbook PDF pages and extract text (OCR fallback for scanned pages).
 * Usage: npx tsx scripts/extract-handbook-pdf.ts [path-to.pdf]
 */
import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { mergeCatalogEntries, parseHandbookTextLines } from '../src/services/handbookTextParser';
import type { HandbookCatalogFile } from '../src/types/handbookCatalog';

const defaultPdf = path.resolve(
  __dirname,
  '../../httpsfct.kln.ac.lkmediaattachments20220616fct-student-handbook-22.pdf 3.pdf',
);

async function main() {
  const pdfPath = path.resolve(process.argv[2] ?? defaultPdf);
  if (!fs.existsSync(pdfPath)) {
    console.error('PDF not found:', pdfPath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buffer });
  const info = await parser.getInfo();
  const totalPages = info.totalPages ?? 60;
  console.log(`Handbook: ${path.basename(pdfPath)} (${totalPages} pages)`);

  const outDir = path.resolve(__dirname, '../data/handbook-extract');
  fs.mkdirSync(outDir, { recursive: true });

  const allLines: string[] = [];

  for (let page = 1; page <= totalPages; page++) {
    const textResult = await parser.getText({ pageRange: String(page) });
    const pageText = (textResult as { text?: string })?.text ?? '';
    const lines = pageText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const useful = lines.filter((l) => !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(l));
    allLines.push(...useful);

    if (useful.length < 3) {
      try {
        const shot = await parser.getScreenshot({ pageRange: String(page), scale: 1.5 });
        const pages = (shot as { pages?: { data: Buffer }[] })?.pages ?? [];
        if (pages[0]?.data) {
          const imgPath = path.join(outDir, `page-${String(page).padStart(3, '0')}.png`);
          fs.writeFileSync(imgPath, pages[0].data);
          console.log(`  Page ${page}: no text — saved ${path.basename(imgPath)} for manual/OCR review`);
        }
      } catch {
        console.log(`  Page ${page}: no extractable text`);
      }
    } else {
      console.log(`  Page ${page}: ${useful.length} text lines`);
    }
  }

  const entries = mergeCatalogEntries(parseHandbookTextLines(allLines));
  const catalog: HandbookCatalogFile = {
    source: path.basename(pdfPath),
    extractedAt: new Date().toISOString(),
    entries,
  };

  const jsonPath = path.join(outDir, 'fct-handbook-catalog.json');
  fs.writeFileSync(jsonPath, JSON.stringify(catalog, null, 2));
  console.log(`\nParsed ${entries.length} course entries -> ${jsonPath}`);
  if (entries.length === 0) {
    console.log(
      'No courses parsed (PDF is likely scanned). Run the curated builder instead:',
    );
    console.log('  python scripts/build-fct-handbook-catalog.py');
    console.log('  npm run handbook:seed');
    console.log('Or sync from timetables only:');
    console.log('  npm run handbook:sync-from-timetable');
  }

  await parser.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
