/**
 * Calls the Python pdfplumber timetable extraction service when configured.
 * Set TIMETABLE_EXTRACT_URL=http://localhost:8002 in server/.env
 */
import FormData from 'form-data';
import axios from 'axios';
import type { ParseResult, ParsedTimetableRow } from './timetableParserService';
import { finalizeParsedRows } from './timetableParserService';

const EXTRACT_URL = process.env.TIMETABLE_EXTRACT_URL || '';
const TIMEOUT_MS = 120_000;

export function isAdvancedExtractEnabled(): boolean {
  return Boolean(EXTRACT_URL.trim());
}

export async function parsePdfWithExtractService(
  buffer: Buffer,
  fileName: string,
): Promise<ParseResult | null> {
  const base = EXTRACT_URL.replace(/\/$/, '');
  if (!base) return null;

  try {
    const form = new FormData();
    form.append('file', buffer, { filename: fileName || 'timetable.pdf', contentType: 'application/pdf' });

    const res = await axios.post(`${base}/extract`, form, {
      headers: form.getHeaders(),
      timeout: TIMEOUT_MS,
      maxContentLength: 50 * 1024 * 1024,
    });

    if (!res.data?.success || !Array.isArray(res.data.rows)) {
      return null;
    }

    const rows = res.data.rows as ParsedTimetableRow[];
    const finalized = finalizeParsedRows(rows);

    return {
      rows: finalized,
      tables: [],
      errors: res.data.errors || [],
      headersDetected: {
        engine: res.data.engine || 'pdfplumber-position',
        source: 'TIMETABLE_EXTRACT_URL',
      },
    };
  } catch (err) {
    console.warn('[LECSTU] Advanced timetable extract failed, falling back to built-in parser:', err);
    return null;
  }
}
