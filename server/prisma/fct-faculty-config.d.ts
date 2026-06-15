/**
 * FCT — Faculty of Computing and Technology (University of Kelaniya)
 * Master reference for programs, study years, pathways, and lecture halls.
 * Timetable PDF import expects group names like: CS-Y3-AINT, CT-Y1, BS-Y1
 */
export declare const FACULTY: {
    readonly name: "Faculty of Computing and Technology";
    readonly code: "FCT";
    readonly description: "FCT degree programs: CS, ET, CT, BS. Study years Y1–Y4. Pathways from Y3 (except BS: Y1 only).";
};
/** Study year labels used on timetables */
export declare const STUDY_YEARS: readonly ["Y1", "Y2", "Y3", "Y4"];
export type StudyYear = (typeof STUDY_YEARS)[number];
/** Ordinal stored in student_groups.batchYear (1 = Y1 … 4 = Y4) */
export declare const studyYearToOrdinal: Record<StudyYear, number>;
export type ProgramConfig = {
    name: string;
    code: string;
    description: string;
    departmentCode: string;
    departmentName: string;
    /** Study years offered for this program */
    years: StudyYear[];
    /** Pathway code → display name (Y3 & Y4 only; empty for BS) */
    pathways: {
        code: string;
        name: string;
    }[];
};
export declare const PROGRAMS: ProgramConfig[];
/** Years that have no pathway split (single group per program) */
export declare const YEARS_WITHOUT_PATHWAYS: StudyYear[];
/** Years that use pathway-specific groups (per program that has pathways) */
export declare const YEARS_WITH_PATHWAYS: StudyYear[];
/**
 * Build student group name for timetable matching.
 * Examples: CS-Y1, ET-Y3-ETIA, BS-Y1
 */
export declare function buildGroupName(programCode: string, year: StudyYear, pathwayCode?: string): string;
/** Split PDF labels like "Y3 CTNT, Y3 CSEC" into separate parts */
export declare function splitGroupNameParts(rawName: string): string[];
/**
 * Map PDF / legacy group labels to canonical seed names (CS-Y3-AINT, CT-Y1, …).
 * Returns null when the label cannot be matched.
 */
export declare function resolveCanonicalGroupName(rawName: string): string | null;
/** All canonical names implied by a raw label (handles comma-separated PDF groups) */
export declare function resolveCanonicalGroupNames(rawName: string): string[];
/** Raw hall names from faculty (deduplicated; spaces normalized where noted) */
export declare const LECTURE_HALL_NAMES: string[];
export declare function parseLectureHall(name: string): {
    name: string;
    building: string;
    floor: number;
    capacity: number;
    equipment: string[];
};
//# sourceMappingURL=fct-faculty-config.d.ts.map