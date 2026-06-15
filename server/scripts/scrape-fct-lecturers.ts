/**
 * Discover and scrape FCT lecturer profiles from https://fct.kln.ac.lk
 * Run: npx tsx scripts/scrape-fct-lecturers.ts
 */
import { writeFileSync } from 'fs';
import path from 'path';

const KNOWN_URLS = [
  'https://fct.kln.ac.lk/dcse-lecturers/prof-dias',
  'https://fct.kln.ac.lk/dcse-lecturers/dr-navodi-hakmanage',
  'https://fct.kln.ac.lk/dcse-lecturers/dr-rajitha-tennekoon',
  'https://fct.kln.ac.lk/dcse-lecturers/dr-rasika-rajapaksha',
  'https://fct.kln.ac.lk/dcse-lecturers/dr-madusha-chandrasena',
  'https://fct.kln.ac.lk/dcse-lecturers/prof-dhammika-weerasinghe',
  'https://fct.kln.ac.lk/dse-lecturers/prof-sidath-liyanage',
  'https://fct.kln.ac.lk/dse-lecturers/dr-carmel-wijegunasekara',
  'https://fct.kln.ac.lk/dse-lecturers/dr-muditha-tissera',
  'https://fct.kln.ac.lk/dac-lecturers/dr-pradeep-samarasekere',
  'https://fct.kln.ac.lk/dac-lecturers/dr-shakya-bandara',
  'https://fct.kln.ac.lk/dac-lecturers/dr-shakila-pathirana',
];

const EXTRA_SLUGS = [
  'dr-la-litha-liyanage', 'dr-laalitha-liyanage', 'dr-s-p-kasthuri-arachchi',
  'dr-s-kasthuri-arachchi', 'dr-sandeli-kasthuriarachchi', 'dr-kasun-vithanage',
  'dr-manjula-bandara', 'dr-nimal-dias', 'dr-kanchana-perera', 'dr-saman-buddhika',
  'prof-k-g-h-dhammika-weerasinghe', 'mr-akash-perera',
];

const PREFIXES = ['dcse-lecturers', 'dse-lecturers', 'dac-lecturers'] as const;

type DeptKey = 'DCSE' | 'DSE' | 'DAC';

const DEPT_TO_PROGRAM: Record<DeptKey, string> = {
  DCSE: 'CS',
  DSE: 'CT',
  DAC: 'CS',
};

function slugToName(slug: string): { firstName: string; lastName: string; designation: string } {
  const parts = slug.split('-').filter(Boolean);
  let title = 'Lecturer';
  let start = 0;
  if (['prof', 'dr', 'mr', 'ms', 'mrs'].includes(parts[0])) {
    title = parts[0] === 'prof' ? 'Professor' : parts[0] === 'dr' ? 'Dr.' : parts[0] === 'mr' ? 'Mr.' : parts[0] === 'ms' ? 'Ms.' : 'Mrs.';
    start = 1;
  }
  const nameParts = parts.slice(start).map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0] || 'Unknown';
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0] || 'Unknown';
  return {
    firstName,
    lastName,
    designation: title === 'Professor' ? 'Professor' : title === 'Dr.' ? 'Senior Lecturer' : `${title}`,
  };
}

function titleToName(pageTitle: string, slug: string): { firstName: string; lastName: string; designation: string } {
  const t = pageTitle.replace(/\s+/g, ' ').trim();
  const fromSlug = slugToName(slug);

  // "Prof.Dias" -> Dias
  const m = t.match(/^(Prof\.?|Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s*(.+)$/i);
  if (m) {
    const des =
      m[1].toLowerCase().startsWith('prof') ? 'Professor' :
      m[1].toLowerCase().startsWith('dr') ? 'Senior Lecturer' :
      m[1];
    const rest = m[2].trim();
    const bits = rest.split(/\s+/);
    if (bits.length >= 2) {
      return { firstName: bits.slice(0, -1).join(' '), lastName: bits[bits.length - 1], designation: des };
    }
    return { firstName: fromSlug.firstName, lastName: rest || fromSlug.lastName, designation: des };
  }

  if (t.includes(' ')) {
    const bits = t.split(/\s+/);
    return { firstName: bits.slice(0, -1).join(' '), lastName: bits[bits.length - 1], designation: fromSlug.designation };
  }

  return fromSlug;
}

function emailFromName(firstName: string, lastName: string): string {
  const f = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const l = lastName.toLowerCase().replace(/[^a-z]/g, '');
  return `${f}.${l}@kln.ac.lk`;
}

async function discoverUrls(): Promise<string[]> {
  const found = new Set<string>(KNOWN_URLS);
  for (const pre of PREFIXES) {
    for (const slug of EXTRA_SLUGS) {
      const url = `https://fct.kln.ac.lk/${pre}/${slug}`;
      try {
        const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
        if (r.ok) found.add(url);
      } catch { /* ignore */ }
    }
  }
  return [...found].sort();
}

async function scrapeProfile(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) return null;
  const html = await res.text();
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = titleMatch?.[1]?.split('|')[0]?.trim() || '';
  const slug = url.split('/').pop() || '';
  const deptPrefix = url.includes('dcse-') ? 'DCSE' : url.includes('dse-') ? 'DSE' : 'DAC';
  const { firstName, lastName, designation } = titleToName(pageTitle, slug);

  // Skip obvious student award pages
  if (slug.startsWith('mr-') && !slug.includes('nisal')) {
    const lower = html.toLowerCase();
    if (!lower.includes('teaching subjects') && !lower.includes('research topics')) {
      return null;
    }
  }

  const subjects: string[] = [];
  const subjBlock = html.match(/Teaching Subjects[\s\S]{0,8000}?<\/h2>/i);
  if (subjBlock) {
    const lines = subjBlock[0].replace(/<[^>]+>/g, '\n').split('\n').map((l) => l.trim()).filter((l) => l.length > 3 && l.length < 120);
    subjects.push(...lines.slice(0, 8));
  }

  return {
    sourceUrl: url,
    fctDepartment: deptPrefix as DeptKey,
    departmentCode: DEPT_TO_PROGRAM[deptPrefix as DeptKey],
    firstName,
    lastName,
    email: emailFromName(firstName, lastName),
    designation: slug.includes('dhammika') ? 'Dean / Professor' : designation,
    phone: undefined as string | undefined,
    sampleSubjects: subjects.slice(0, 5),
  };
}

async function main() {
  console.log('Discovering FCT lecturer profile URLs...\n');
  const urls = await discoverUrls();
  console.log(`Found ${urls.length} profile URLs\n`);

  const roster: Awaited<ReturnType<typeof scrapeProfile>>[] = [];
  for (const url of urls) {
    process.stdout.write(`  ${url} ... `);
    const row = await scrapeProfile(url);
    if (row) {
      roster.push(row);
      console.log(`${row.designation} ${row.firstName} ${row.lastName}`);
    } else {
      console.log('skip');
    }
  }

  const outPath = path.join(__dirname, '../prisma/fct-lecturer-roster.scraped.json');
  writeFileSync(outPath, JSON.stringify(roster, null, 2), 'utf8');
  console.log(`\nWrote ${roster.length} lecturers to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
