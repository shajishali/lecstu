"use strict";
/**
 * FCT — Faculty of Computing and Technology (University of Kelaniya)
 * Master reference for programs, study years, pathways, and lecture halls.
 * Timetable PDF import expects group names like: CS-Y3-AINT, CT-Y1, BS-Y1
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LECTURE_HALL_NAMES = exports.YEARS_WITH_PATHWAYS = exports.YEARS_WITHOUT_PATHWAYS = exports.PROGRAMS = exports.studyYearToOrdinal = exports.STUDY_YEARS = exports.FACULTY = void 0;
exports.buildGroupName = buildGroupName;
exports.splitGroupNameParts = splitGroupNameParts;
exports.resolveCanonicalGroupName = resolveCanonicalGroupName;
exports.resolveCanonicalGroupNames = resolveCanonicalGroupNames;
exports.parseLectureHall = parseLectureHall;
exports.FACULTY = {
    name: 'Faculty of Computing and Technology',
    code: 'FCT',
    description: 'FCT degree programs: CS, ET, CT, BS. Study years Y1–Y4. Pathways from Y3 (except BS: Y1 only).',
};
/** Study year labels used on timetables */
exports.STUDY_YEARS = ['Y1', 'Y2', 'Y3', 'Y4'];
/** Ordinal stored in student_groups.batchYear (1 = Y1 … 4 = Y4) */
exports.studyYearToOrdinal = {
    Y1: 1,
    Y2: 2,
    Y3: 3,
    Y4: 4,
};
exports.PROGRAMS = [
    {
        name: 'Computer Science',
        code: 'CS',
        description: 'B.Sc. Computer Science',
        departmentCode: 'CS',
        departmentName: 'Computer Science',
        years: ['Y1', 'Y2', 'Y3', 'Y4'],
        pathways: [
            { code: 'AINT', name: 'Artificial Intelligence' },
            { code: 'DSCI', name: 'Data Science' },
            { code: 'CSEC', name: 'Cyber Security' },
            { code: 'SPCS', name: 'Special Pathway' },
        ],
    },
    {
        name: 'Engineering Technology',
        code: 'ET',
        description: 'B.Sc. Engineering Technology',
        departmentCode: 'ET',
        departmentName: 'Engineering Technology',
        years: ['Y1', 'Y2', 'Y3', 'Y4'],
        pathways: [
            { code: 'ETIA', name: 'Automation' },
            { code: 'ETMP', name: 'Manufacturing' },
            { code: 'ETST', name: 'Sustainable' },
        ],
    },
    {
        name: 'Computing Technology',
        code: 'CT',
        description: 'B.Sc. Computing Technology',
        departmentCode: 'CT',
        departmentName: 'Computing Technology',
        years: ['Y1', 'Y2', 'Y3', 'Y4'],
        pathways: [
            { code: 'SWST', name: 'Software Engineer' },
            { code: 'GANI', name: 'Game and Animation' },
            { code: 'CTNT', name: 'Network' },
        ],
    },
    {
        name: 'Biological System',
        code: 'BS',
        description: 'B.Sc. Biological System (new program — Y1 only)',
        departmentCode: 'BS',
        departmentName: 'Biological System',
        years: ['Y1'],
        pathways: [],
    },
];
/** Years that have no pathway split (single group per program) */
exports.YEARS_WITHOUT_PATHWAYS = ['Y1', 'Y2'];
/** Years that use pathway-specific groups (per program that has pathways) */
exports.YEARS_WITH_PATHWAYS = ['Y3', 'Y4'];
/**
 * Build student group name for timetable matching.
 * Examples: CS-Y1, ET-Y3-ETIA, BS-Y1
 */
function buildGroupName(programCode, year, pathwayCode) {
    if (pathwayCode) {
        return `${programCode}-${year}-${pathwayCode}`;
    }
    return `${programCode}-${year}`;
}
/** FET / legacy typos: faculty code FT or pathway FTIA instead of ET / ETIA */
const PATHWAY_TYPO_TO_CODE = {
    FTIA: 'ETIA',
    FTMP: 'ETMP',
    FTST: 'ETST',
};
function normalizeProgramCode(code) {
    return code.toUpperCase() === 'FT' ? 'ET' : code.toUpperCase();
}
function normalizePathwayCode(code) {
    if (!code)
        return undefined;
    const u = code.toUpperCase();
    return PATHWAY_TYPO_TO_CODE[u] ?? u;
}
/** Split PDF labels like "Y3 CTNT, Y3 CSEC" into separate parts */
function splitGroupNameParts(rawName) {
    return rawName
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}
/**
 * Map PDF / legacy group labels to canonical seed names (CS-Y3-AINT, CT-Y1, …).
 * Returns null when the label cannot be matched.
 */
function resolveCanonicalGroupName(rawName) {
    const trimmed = rawName.trim();
    if (!trimmed)
        return null;
    const direct = trimmed.match(/^(CS|ET|CT|BS|FT)-Y([1-4])(?:-([A-Z0-9]+))?$/i);
    if (direct) {
        return buildGroupName(normalizeProgramCode(direct[1]), `Y${direct[2]}`, normalizePathwayCode(direct[3]));
    }
    const yProg = trimmed.match(/^Y([1-4])\s+(CS|ET|CT|BS|BST)\b/i);
    if (yProg) {
        const code = yProg[2].toUpperCase() === 'BST' ? 'BS' : yProg[2].toUpperCase();
        return buildGroupName(code, `Y${yProg[1]}`);
    }
    const yPath = trimmed.match(/^Y([1-4])\s+([A-Z0-9]{2,6})\b/i);
    if (yPath) {
        const year = `Y${yPath[1]}`;
        const pathway = normalizePathwayCode(yPath[2].toUpperCase()) ?? yPath[2].toUpperCase();
        for (const prog of exports.PROGRAMS) {
            if (prog.pathways.some((p) => p.code === pathway)) {
                return buildGroupName(prog.code, year, pathway);
            }
        }
    }
    return null;
}
/** All canonical names implied by a raw label (handles comma-separated PDF groups) */
function resolveCanonicalGroupNames(rawName) {
    const names = new Set();
    for (const part of splitGroupNameParts(rawName)) {
        const canonical = resolveCanonicalGroupName(part);
        if (canonical)
            names.add(canonical);
    }
    return [...names];
}
/** Raw hall names from faculty (deduplicated; spaces normalized where noted) */
exports.LECTURE_HALL_NAMES = [
    'AB-CMP-02-1',
    'AB-CMP-02-2',
    'AB-CMP-02-3',
    'AB-CMP-02-4',
    'AB-LCH-09-1',
    'AB-LCH-09-2',
    'LB-CMP-01-1',
    'AB-LCH-07-1',
    'AB-LCH-07-2',
    'Language Lab (IoT)',
    'WORKSHOP',
    'LB-ELP-01-1',
    'LB-ELP-02-1',
    'LB-ELEC-01-01',
    'AB-LCH-03-1',
    'AB-LCH-04-2',
    'AB-LCH-04-1',
    'AB-LCH-05-2',
    'AB-LCH-05-1',
    'LB-MECH-G-01',
    'AB-SCALE-08-02',
    'AB-SCALE-08-01',
    'AB-Seminar-04-10',
    'AB-Seminar-04-13',
    'AB-IA-05-1',
    'AB-Seminar-05-12',
    'AB-Seminar-05-06',
    'AB-Seminar-04-14',
    'LB-CMP-10-1',
    'AB-Seminar-04-03',
    'AB-Seminar-04-09',
];
function parseLectureHall(name) {
    const trimmed = name.trim();
    const upper = trimmed.toUpperCase();
    if (upper === 'WORKSHOP') {
        return { name: trimmed, building: 'WORKSHOP', floor: 0, capacity: 40, equipment: ['Workshop'] };
    }
    if (trimmed.toLowerCase().includes('language lab')) {
        return {
            name: trimmed,
            building: 'Language Lab',
            floor: 0,
            capacity: 30,
            equipment: ['IoT', 'Language Lab'],
        };
    }
    const parts = trimmed.split('-').filter(Boolean);
    const building = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : parts[0] ?? 'FCT';
    let floor = 0;
    if (parts.length >= 3) {
        const parsed = parseInt(parts[2], 10);
        if (!Number.isNaN(parsed))
            floor = parsed;
    }
    const equipment = ['Projector', 'Whiteboard'];
    if (upper.includes('LAB'))
        equipment.push('Lab');
    if (upper.includes('SEMINAR'))
        equipment.push('Seminar');
    if (upper.includes('CMP'))
        equipment.push('Computer Lab');
    return {
        name: trimmed,
        building,
        floor,
        capacity: upper.includes('SEMINAR') ? 50 : upper.includes('LAB') || upper.includes('CMP') ? 40 : 35,
        equipment,
    };
}
//# sourceMappingURL=fct-faculty-config.js.map