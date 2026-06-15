import * as XLSX from 'xlsx';
import { parseExcel } from '../src/services/timetableParserService';

const grid = [
  ['Faculty of Computing and Technology'],
  ['Y3 AINT'],
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ['08:00 - 08:55', '', 'CSCI 32012 T', '', '', ''],
  ['', '', 'NM', '', '', ''],
  ['', '', 'AB-LCH-09-1', '', '', ''],
];

/** Two stacked FET tables on one sheet (like 29-in-one workbook layout). */
const stackedGrid = [
  ['Faculty of Computing and Technology'],
  ['Y3 AINT'],
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ['08:00 - 08:55', 'CSCI 32012 T', '', '', '', ''],
  ['', 'NM', '', '', '', ''],
  ['', 'AB-LCH-09-1', '', '', '', ''],
  ['Faculty of Computing and Technology'],
  ['Y3 SPCS'],
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ['08:00 - 08:55', '', 'SWST 32033 P', '', '', ''],
  ['', '', 'KP', '', '', ''],
  ['', '', 'LB-CMP-01-1', '', '', ''],
];

/**
 * Simulate the real Y3 AINT sheet from the screenshot — cells that start with
 * group labels AND contain course codes (previously caused all courses to be dropped).
 */
const y3AintRealGrid = [
  ['', 'Y3 AINT', '', '', '', '', '', ''],
  ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  // Mon 08:00–09:55  "Y3 GANI, Y3 CS GANI 32024+CSCI 32062 P\nKVS\nAB-CMP-02-3"
  ['08:00 - 09:55', 'Y3 GANI, Y3 CS GANI 32024+CSCI 32062 P\nKVS\nAB-CMP-02-3', '', 'Y3 CS CSCI 32083 T\nML\nAB8-LCH-07-2', '', 'Y3 CS CSCI 32092 T\nVL_HS\nAB-LCH-04-1', '', '---'],
  // Tue 09:00–09:55  "Y3 AINT, Y3 SPCS CSCI 32073 VR_LAB\nMB\nLB-CMP-10-1"
  ['09:00 - 09:55', '', 'Y3 AINT, Y3 SPCS CSCI 32073 VR_LAB\nMB\nLB-CMP-10-1', '', '', '', '', '---'],
  // Mon 10:00–11:55  "Y3 CS CSCI 32012 T\nND\nAB-LCH-05-2"
  // Thu 10:00–11:55  "Y3 AINT, Y3 SPCS AINT 32012 T\nSK\nLB-CMP-01-1"
  // Fri 10:00–11:55  "Y3 CS DELT 33212 T\nRG\nAB-LCH-09-2"
  ['10:00 - 11:55', 'Y3 CS CSCI 32012 T\nND\nAB-LCH-05-2', '', '', 'Y3 AINT, Y3 SPCS AINT 32012 T\nSK\nLB-CMP-01-1', 'Y3 CS DELT 33212 T\nRG\nAB-LCH-09-2', 'Y3 CS CSCI 32042 T\nVL_6\nAB-LCH-07-2', '---'],
  // Mon 14:00–16:55  DSCI 32012+SWST 32033
  // Thu 13:00–14:55  AINT 32022
  ['14:00 - 16:55', 'Y3 CS, Y3 SWST DSCI 32012+SWST 32033 P\nKH\nAB-CMP-02-1', '', 'Y3 CS CSCI 32032 T\nSL\nAB-LCH-07-2', 'Y3 AINT, Y3 SPCS, Y3 DSCI AINT 32022 T SL\nAB-LCH-05-2', '', '', '---'],
  ['15:00 - 16:55', '', '', 'Y3 CS CSCI 32052 NETWORK_LAB\nAP\nAB-CMP-07-1', 'Y3 CS CSCI 32022 T\nMS\nAB-LCH-07-1', '', '', '---'],
  ['Timetable generated with FET 7.4.1 on 5/1/26 8:04 PM', '', '', '', '', '', '', ''],
];

/** Y4 SWST FET grid — in-cell batch labels must not split the section (Saturday block included). */
const y4SwstGrid = [
  ['Faculty of Computing and Technology'],
  ['Y4 SWST'],
  ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  [
    '08:00 - 10:55',
    '---',
    '---',
    '---',
    'Y4 ET, Y4 CT\nENPR 44043 T\nVL_Amila\nAB-LCH-07-1',
    '---',
    '---',
    '---',
  ],
  [
    '10:00 - 10:55',
    '---',
    'Y4 SWST, Y4 CS\nSWST 44042 T\nVL_SG\nAB-LCH-07-3',
    '---',
    '---',
    '---',
    '---',
    '---',
  ],
  [
    '15:00 - 16:55',
    '---',
    'Y4 SWST\nCTEC 44022 Online',
    '---',
    '---',
    '---',
    '---',
    '---',
  ],
  [
    '13:00 - 16:55',
    '---',
    '---',
    '---',
    '---',
    '---',
    'Y4 SWST, Y4 CS\nSWST 44062+CSCI 44092 P\nVL_SG\nAB-CMP-01-1',
    '---',
  ],
  ['Timetable generated with FET 7.4.1 on 5/1/26 8:04 PM', '', '', '', '', '', '', ''],
];

const EXPECTED_COURSES_Y4_SWST = [
  'ENPR 44043',
  'SWST 44042',
  'CTEC 44022',
  'SWST 44062',
  'CSCI 44092',
];

// Expected courses that MUST appear for Y3 AINT
const EXPECTED_COURSES_Y3_AINT = [
  'CSCI 32012',
  'CSCI 32073',  // "Y3 AINT, Y3 SPCS CSCI 32073 VR_LAB" — was dropped before fix
  'AINT 32012',  // "Y3 AINT, Y3 SPCS AINT 32012 T" — was dropped before fix
  'AINT 32022',  // "Y3 AINT, Y3 SPCS, Y3 DSCI AINT 32022 T SL" — was dropped before fix
  'DSCI 32012',  // "Y3 CS, Y3 SWST DSCI 32012+SWST 32033 P" — was dropped before fix
  'SWST 32033',  // combined with DSCI 32012 — was dropped before fix
  'CSCI 32083',
  'CSCI 32092',
  'DELT 33212',
  'CSCI 32042',
  'CSCI 32032',
  'CSCI 32052',
  'CSCI 32022',
];

const ws = XLSX.utils.aoa_to_sheet(grid);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

const pdfPath = process.argv[2];
async function main() {
  if (pdfPath) {
    const fs = await import('fs');
    const b = fs.readFileSync(pdfPath);
    const r = await parseExcel(b, pdfPath);
    console.log('file', pdfPath, 'rows', r.rows.length, r.headersDetected);
    if (r.errors.length) console.log('errors', r.errors.slice(0, 3));
    return;
  }

  // ── Test 1: basic single sheet ────────────────────────────────────────────
  const r = await parseExcel(buf, 'Timetable_Sem_II.xlsx');
  console.log('single-sheet', r.rows.length, r.headersDetected);
  if (r.rows[0]) console.log('sample', r.rows[0]);

  // ── Test 2: two stacked batches on one sheet ──────────────────────────────
  const ws2 = XLSX.utils.aoa_to_sheet(stackedGrid);
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, ws2, 'AllBatches');
  const buf2 = Buffer.from(XLSX.write(wb2, { type: 'buffer', bookType: 'xlsx' }));
  const r2 = await parseExcel(buf2, 'stacked.xlsx');
  const groups2 = [...new Set(r2.rows.map((x) => x.groupName))];
  console.log('\nstacked rows', r2.rows.length, 'groups', groups2, 'tablesMerged', r2.headersDetected.tablesMerged);

  // ── Test 3: real Y3 AINT patterns (mixed group-label + course-code cells) ─
  const ws3 = XLSX.utils.aoa_to_sheet(y3AintRealGrid);
  const wb3 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb3, ws3, 'Y3 AINT');
  const buf3 = Buffer.from(XLSX.write(wb3, { type: 'buffer', bookType: 'xlsx' }));
  const r3 = await parseExcel(buf3, 'y3aint_real.xlsx');

  const foundCodes = new Set(r3.rows.map((x) => x.courseName.replace(/-/g, ' ').split(' ').slice(0, 2).join(' ')));
  console.log('\n── Y3 AINT real-pattern test ──');
  console.log('total rows parsed:', r3.rows.length);
  console.log('courses found:', [...new Set(r3.rows.map((x) => x.courseName))].sort());

  let passed = 0;
  let failed = 0;
  for (const expected of EXPECTED_COURSES_Y3_AINT) {
    const prefix = expected.replace(/\s+/g, '-').toUpperCase();
    const ok = r3.rows.some((row) =>
      row.courseCode.startsWith(prefix) || row.courseName.includes(expected),
    );
    if (ok) {
      console.log('  ✓', expected);
      passed++;
    } else {
      console.log('  ✗ MISSING:', expected);
      failed++;
    }
  }
  console.log(`\n${passed} / ${EXPECTED_COURSES_Y3_AINT.length} expected courses found`);
  if (failed > 0) {
    console.error(`FAIL: ${failed} courses missing from Y3 AINT parse`);
    process.exit(1);
  } else {
    console.log('PASS: all expected Y3 AINT courses parsed correctly');
  }

  // ── Test 4: Y4 SWST — in-cell "Y4 ET, Y4 CT" must not truncate before Saturday ─
  const ws4 = XLSX.utils.aoa_to_sheet(y4SwstGrid);
  // FET uses merged cells for multi-row class blocks (column index = day column)
  ws4['!merges'] = [
    { s: { r: 3, c: 4 }, e: { r: 3, c: 4 } }, // Thu ENPR — single row "08:00 - 10:55" in column A
    { s: { r: 6, c: 2 }, e: { r: 8, c: 2 } }, // Tue SWST 44042 10:00–11:55
    { s: { r: 9, c: 2 }, e: { r: 10, c: 2 } }, // Tue CTEC 15:00–16:55
    { s: { r: 11, c: 6 }, e: { r: 14, c: 6 } }, // Sat SWST+CSCI 13:00–16:55
  ];
  const wb4 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb4, ws4, 'CT-Y4-SWST');
  const buf4 = Buffer.from(XLSX.write(wb4, { type: 'buffer', bookType: 'xlsx' }));
  const r4 = await parseExcel(buf4, 'y4swst.xlsx');
  const groups4 = [...new Set(r4.rows.map((x) => x.groupName))];
  console.log('\n── Y4 SWST test ──');
  console.log('rows', r4.rows.length, 'groups', groups4);
  console.log(
    'courses',
    [...new Set(r4.rows.map((x) => x.courseName))].sort(),
  );

  let passed4 = 0;
  let failed4 = 0;
  for (const expected of EXPECTED_COURSES_Y4_SWST) {
    const ok = r4.rows.some(
      (row) => row.courseName.includes(expected) || row.courseCode.includes(expected.replace(/\s+/g, '-')),
    );
    if (ok) {
      console.log('  ✓', expected);
      passed4++;
    } else {
      console.log('  ✗ MISSING:', expected);
      failed4++;
    }
  }
  const satRows = r4.rows.filter((r) => r.dayOfWeek === 'SATURDAY');
  if (satRows.length >= 2) {
    console.log('  ✓ Saturday slots parsed');
    passed4++;
  } else {
    console.log('  ✗ Saturday slots missing (got', satRows.length, ')');
    failed4++;
  }

  const enprThu = r4.rows.find(
    (row) => row.dayOfWeek === 'THURSDAY' && row.courseName.includes('ENPR 44043'),
  );
  if (enprThu?.startTime === '08:00' && enprThu.endTime === '10:55') {
    console.log('  ✓ Thursday ENPR 44043 span 08:00–10:55');
    passed4++;
  } else {
    console.log('  ✗ Thursday ENPR 44043 times wrong:', enprThu?.startTime, enprThu?.endTime);
    failed4++;
  }

  if (failed4 > 0) {
    console.error(`FAIL: Y4 SWST parse — ${failed4} checks failed`);
    process.exit(1);
  }
  console.log('PASS: Y4 SWST timetable parsed correctly');

  // ── Test 5: Y4 ETIA — multi-hour blocks + FT-Y4-FTIA sheet alias ───────────
  const y4EtiaGrid = [
    ['Faculty of Computing and Technology'],
    ['Y4 ETIA'],
    ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    ['08:00 - 08:55', '---', '---', '---', 'Y4 ET, Y4 CT\nENPR 44043 T\nVL_Amila\nAB-LCH-07-1', '---', '---', '---'],
    ['09:00 - 09:55', '---', '---', '---', '', '---', '---', '---'],
    ['10:00 - 10:55', '---', '---', '---', '', '---', '---', '---'],
    ['10:00 - 11:55', 'ETIA 44423 AUTOMATION_LAB SB\nAB-IA-05-1', '---', 'ETIA 44423 T SB\nAB-Seminar-04-03', '---', 'ENPR 44052 SCALE_UP SP\nAB-SCALE-08-01', '---', '---'],
    ['14:00 - 14:55', 'Y4 ET ENPR 41033 T CJ\nAB-LCH-09-2', '---', 'ETIA 44433 T CJ\nAB-LCH-04-1', '---', '---', '---', '---'],
    ['15:00 - 15:55', '', '---', '', '---', '---', '---', '---'],
    ['16:00 - 16:55', '', '---', '', '---', 'ETIA 44413 T CJ\nAB-Seminar-04-09', '---', '---'],
    ['Timetable generated with FET 7.4.1 on 5/1/26 8:04 PM', '', '', '', '', '', '', ''],
  ];
  const ws5 = XLSX.utils.aoa_to_sheet(y4EtiaGrid);
  ws5['!merges'] = [
    { s: { r: 3, c: 4 }, e: { r: 5, c: 4 } },
    { s: { r: 7, c: 1 }, e: { r: 9, c: 1 } },
    { s: { r: 7, c: 3 }, e: { r: 9, c: 3 } },
    { s: { r: 9, c: 5 }, e: { r: 9, c: 5 } },
  ];
  const wb5 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb5, ws5, 'FT-Y4-FTIA');
  const buf5 = Buffer.from(XLSX.write(wb5, { type: 'buffer', bookType: 'xlsx' }));
  const r5 = await parseExcel(buf5, 'y4etia.xlsx');
  const enprEtiaThu = r5.rows.find(
    (row) => row.dayOfWeek === 'THURSDAY' && row.courseName.includes('ENPR 44043'),
  );
  const monEnpr = r5.rows.find(
    (row) => row.dayOfWeek === 'MONDAY' && row.courseName.includes('ENPR 41033'),
  );
  const wedEtia = r5.rows.find(
    (row) => row.dayOfWeek === 'WEDNESDAY' && row.courseName.includes('ETIA 44433'),
  );
  const grid5 = r5.tables?.find((t) => t.groupName === 'ET-Y4-ETIA');
  console.log('\n── Y4 ETIA tests ──');
  let fail5 = 0;
  if (r5.rows.every((row) => row.groupName === 'ET-Y4-ETIA')) {
    console.log('PASS: FT-Y4-FTIA sheet → ET-Y4-ETIA');
  } else {
    console.error('FAIL: groups', [...new Set(r5.rows.map((x) => x.groupName))]);
    fail5++;
  }
  if (enprEtiaThu?.startTime === '08:00' && enprEtiaThu?.endTime === '10:55') {
    console.log('PASS: ENPR 44043 Thursday 08:00–10:55');
  } else {
    console.error('FAIL: ENPR 44043 Thursday got', enprEtiaThu?.startTime, enprEtiaThu?.endTime);
    fail5++;
  }
  if (monEnpr?.startTime === '14:00' && monEnpr?.endTime === '16:55') {
    console.log('PASS: ENPR 41033 Monday 14:00–16:55');
  } else {
    console.error('FAIL: ENPR 41033 Monday got', monEnpr?.startTime, monEnpr?.endTime);
    fail5++;
  }
  if (wedEtia?.startTime === '14:00' && wedEtia?.endTime === '16:55') {
    console.log('PASS: ETIA 44433 Wednesday 14:00–16:55');
  } else {
    console.error('FAIL: ETIA 44433 Wednesday got', wedEtia?.startTime, wedEtia?.endTime);
    fail5++;
  }
  const thuTi = grid5?.timeRows?.findIndex((t) => t.start === '08:00');
  const thuCell = thuTi != null && thuTi >= 0 ? grid5?.cells?.[thuTi]?.[3] : undefined;
  if (thuCell && !thuCell.mergeContinue && (thuCell.rowSpan ?? 1) === 3) {
    console.log('PASS: grid Thu ENPR rowSpan', thuCell.rowSpan);
  } else {
    console.error('FAIL: grid Thu ENPR rowSpan', thuCell?.rowSpan);
    fail5++;
  }
  if (fail5 > 0) process.exit(1);
}

main().catch(console.error);
