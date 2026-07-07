export type HandbookCourseRequirement = 'COMPULSORY' | 'OPTIONAL';

export interface HandbookCatalogLecturer {
  name: string;
  email?: string;
  timetableCode?: string;
}

export interface HandbookCatalogEntry {
  /** Normalized code e.g. SWST-32012 */
  code: string;
  /** Full module title from handbook */
  title: string;
  programCode: string;
  studyYear: number;
  pathwayCode?: string | null;
  requirementType: HandbookCourseRequirement;
  credits?: number;
  semester?: number;
  lecturers?: HandbookCatalogLecturer[];
}

export interface HandbookCatalogFile {
  source: string;
  extractedAt?: string;
  entries: HandbookCatalogEntry[];
}
