import { useState, useRef, useMemo } from 'react';
import api, { showApiErrorToast } from '@services/api';
import { showToast } from '@components/Toast';
import { Upload, FileText, AlertCircle, CheckCircle, Trash2, Download } from 'lucide-react';
import { durationMinutes, formatDuration } from '@utils/courseDisplay';
import FetTimetableGrid from '@components/FetTimetableGrid';
import type { TimetableGridSnapshot } from '../../types/timetableGrid';

interface Props {
  onSuccess: () => void;
}

interface ImportError {
  row: number;
  message: string;
}

interface ImportConflict {
  row: number;
  conflicts: { type: string; message: string }[];
}

export interface ImportEntry {
  id: string;
  year: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  courseCode: string;
  courseName: string;
  lecturerName: string;
  lecturerEmail: string;
  hallName: string;
  groupName: string;
  semester: number;
  month: number;
  week: number;
}

type EditableField = keyof Omit<ImportEntry, 'id' | 'month' | 'week' | 'semester'>;

const PREVIEW_COLUMNS: { key: EditableField | 'duration'; label: string; width?: string }[] = [
  { key: 'year', label: 'Year', width: '4.5rem' },
  { key: 'dayOfWeek', label: 'Day', width: '6.5rem' },
  { key: 'startTime', label: 'Start', width: '5.5rem' },
  { key: 'endTime', label: 'End', width: '5.5rem' },
  { key: 'duration', label: 'Duration', width: '4.5rem' },
  { key: 'courseCode', label: 'Code', width: '7rem' },
  { key: 'courseName', label: 'Course', width: '9rem' },
  { key: 'lecturerName', label: 'Lecturer', width: '5rem' },
  { key: 'hallName', label: 'Hall', width: '8rem' },
  { key: 'groupName', label: 'Group', width: '7rem' },
];

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const FET_GAP_MINUTES = 90;
const SINGLE_PERIOD_MAX_MINUTES = 70;

function normCourseKey(code: string): string {
  return code.replace(/[\s-]+/g, '').toUpperCase();
}

function isLikelyInitials(name: string): boolean {
  const t = name.trim();
  if (!t || t.length > 12) return false;
  return /^[A-Za-z](?:\s*\.\s*[A-Za-z]){1,4}\.?$/.test(t) || (/^[A-Za-z]{2,4}$/.test(t) && t === t.toUpperCase());
}

export default function TimetableBulkImport({ onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [entries, setEntries] = useState<ImportEntry[]>([]);
  const [tables, setTables] = useState<TimetableGridSnapshot[]>([]);
  const [previewTableIndex, setPreviewTableIndex] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);
  const [replacePeriod, setReplacePeriod] = useState(false);
  const [summary, setSummary] = useState<{
    total: number;
    imported: number;
    autoCreated?: { courses: number; halls: number; groups: number };
    unassignedLecturer?: number;
  } | null>(null);

  const updateEntry = (id: string, field: EditableField, value: string | number) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    );
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const loadPreview = async (f: File) => {
    setPreviewLoading(true);
    setEntries([]);
    setTables([]);
    setPreviewTableIndex(0);
    try {
      const formData = new FormData();
      formData.append('file', f);
      const res = await api.post('/admin/timetable/bulk-import/preview', formData);
      const list = (res.data.entries || []) as ImportEntry[];
      const parsedTables = (res.data.tables || []) as TimetableGridSnapshot[];
      setEntries(list);
      setTables(parsedTables);
      if (res.data.validationErrors?.length) {
        setErrors(res.data.validationErrors);
      }
    } catch (err: unknown) {
      setEntries([]);
      const ax = err as { response?: { data?: { message?: string; validationErrors?: ImportError[] } } };
      const msg = ax.response?.data?.message;
      if (ax.response?.data?.validationErrors?.length) {
        setErrors(ax.response.data.validationErrors);
      }
      showApiErrorToast(err, msg || 'Could not preview file');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setErrors([]);
    setConflicts([]);
    setSummary(null);
    void loadPreview(f);
  };

  const handleUpload = async () => {
    if (entries.length === 0 && tables.length === 0) return;
    setUploading(true);
    setErrors([]);
    setConflicts([]);
    setSummary(null);

    try {
      const res = await api.post('/admin/timetable/bulk-import/confirm', {
        tables,
        replacePeriod,
        ...(tables.length === 0 ? { entries } : {}),
      });
      setSummary(res.data.summary);
      showToast('success', res.data.message);
      onSuccess();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { validationErrors?: ImportError[]; conflicts?: ImportConflict[] } } };
      const data = ax.response?.data;
      if (data?.validationErrors) setErrors(data.validationErrors);
      if (data?.conflicts) setConflicts(data.conflicts);
      if (!data?.validationErrors && !data?.conflicts) {
        showApiErrorToast(err, 'Import failed');
      }
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get('/admin/timetable/bulk-import/template', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'timetable-import-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      showApiErrorToast(err, 'Could not download template');
    }
  };

  const groupSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      counts.set(e.groupName, (counts.get(e.groupName) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries]);

  /** Rows that look like one FET period but same class continues in the next band (merge may have failed). */
  const shortPeriodWarningIds = useMemo(() => {
    const warn = new Set<string>();
    const buckets = new Map<string, ImportEntry[]>();
    for (const e of entries) {
      const key = `${e.groupName}|${e.dayOfWeek}|${normCourseKey(e.courseCode)}`;
      const list = buckets.get(key) || [];
      list.push(e);
      buckets.set(key, list);
    }
    for (const list of buckets.values()) {
      const sorted = [...list].sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        const gap = durationMinutes(a.endTime, b.startTime);
        const aMins = durationMinutes(a.startTime, a.endTime);
        if (aMins > 0 && aMins <= SINGLE_PERIOD_MAX_MINUTES && gap >= 0 && gap <= FET_GAP_MINUTES) {
          warn.add(a.id);
          warn.add(b.id);
        }
      }
    }
    return warn;
  }, [entries]);

  const initialsCount = useMemo(
    () => entries.filter((e) => e.lecturerName && isLikelyInitials(e.lecturerName)).length,
    [entries],
  );

  return (
    <div className="tt-import">
      <div className="import-info-card">
        <h3><FileText size={18} /> Timetable Import (Excel, CSV, or PDF)</h3>
        <p>
          <strong>Recommended:</strong> use an Excel sheet with one row per class — day, times, course, lecturer, hall, and group are read clearly.
        </p>
        <p>
          <strong>Multi-sheet Excel (29 batches):</strong> each tab is one batch timetable — all subjects on that tab
          belong to that group only (CS-Y3-AINT, CS-Y2, …). Shared lectures and duplicate lecturer codes across
          courses are kept exactly as in the table.
        </p>
        <p>Students only see the timetable for their enrolled class. Re-import with Replace period after code updates.</p>
        <p>
          Each <strong>batch table</strong> in the file (e.g. Y4 CSEC, ET-Y4-ETIA) is stored and previewed as a
          whole grid — same layout as your Excel — before slots are saved. Compare each table to your real timetable,
          then import.
        </p>
        <p>Review tables below, then the line list if you need to edit individual slots.</p>
        <p className="import-note text-xs">Month and week are stored internally for conflict checks but are not shown in this preview.</p>
        <button type="button" className="btn-secondary btn-sm mt-2" onClick={() => void downloadTemplate()}>
          <Download size={16} /> Download Excel template
        </button>
      </div>

      <div className="import-upload-area" onClick={() => fileRef.current?.click()}>
        <Upload size={32} />
        <p>{file ? file.name : 'Click or drag to upload Excel, CSV, or PDF'}</p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv,.pdf,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={handleFileChange}
          hidden
        />
      </div>

      {previewLoading && (
        <p className="import-preview-loading text-sm text-slate-600 mt-3">
          <span className="spinner-sm" /> Parsing file…
        </p>
      )}

      {tables.length > 0 && !previewLoading && (
        <div className="import-preview import-tables-preview mb-6">
          <h3>
            Timetable tables — {tables.length} batch{tables.length !== 1 ? 'es' : ''} (compare with your Excel)
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {tables.map((t, i) => (
              <button
                key={`${t.groupName}-${i}`}
                type="button"
                className={`btn btn-sm ${i === previewTableIndex ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPreviewTableIndex(i)}
              >
                {t.tableTitle}
                <span className="ml-1 opacity-75">({t.groupName})</span>
              </button>
            ))}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 max-h-[70vh] overflow-auto">
            <FetTimetableGrid grid={tables[previewTableIndex]} />
          </div>
        </div>
      )}

      {entries.length > 0 && !previewLoading && (
        <div className="import-preview">
          <h3>
            Slot list — {entries.length} entries
            {file && <span className="text-sm font-normal text-slate-500"> ({file.name})</span>}
          </h3>
          {groupSummary.length > 0 && (
            <p className="text-xs text-slate-600 mb-2">
              Groups: {groupSummary.map(([g, n]) => `${g} (${n})`).join(' · ')}
            </p>
          )}
          {shortPeriodWarningIds.size > 0 && (
            <p className="import-period-warn text-xs mb-2">
              <AlertCircle size={14} className="inline mr-1 align-text-bottom" />
              {shortPeriodWarningIds.size} row(s) look like single ~1h FET periods for the same class on the same day.
              Extend end time or remove duplicates if a lecture should be 2h or 3h.
            </p>
          )}
          {initialsCount > 0 && (
            <p className="text-xs text-amber-700 mb-2">
              {initialsCount} row(s) use lecturer initials — matching runs on import; unmatched slots need Assign in Timetable.
            </p>
          )}
          <div className="dt-scroll import-preview-scroll">
            <table className="dt-table import-edit-table">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  {PREVIEW_COLUMNS.map((c) => (
                    <th key={c.key} style={c.width ? { minWidth: c.width } : undefined}>{c.label}</th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {entries.map((row, i) => (
                  <tr key={row.id} className={shortPeriodWarningIds.has(row.id) ? 'import-row-warn' : undefined}>
                    <td>{i + 1}</td>
                    <td>
                      <input
                        type="number"
                        className="import-cell-input"
                        value={row.year}
                        onChange={(e) => updateEntry(row.id, 'year', parseInt(e.target.value, 10) || 2026)}
                      />
                    </td>
                    <td>
                      <select
                        className="import-cell-input"
                        value={row.dayOfWeek}
                        onChange={(e) => updateEntry(row.id, 'dayOfWeek', e.target.value)}
                      >
                        {DAYS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="time"
                        className="import-cell-input"
                        value={row.startTime}
                        onChange={(e) => updateEntry(row.id, 'startTime', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        className="import-cell-input"
                        value={row.endTime}
                        onChange={(e) => updateEntry(row.id, 'endTime', e.target.value)}
                      />
                    </td>
                    <td
                      className={`text-xs whitespace-nowrap ${shortPeriodWarningIds.has(row.id) ? 'text-amber-700 font-medium' : 'text-slate-600'}`}
                      title={shortPeriodWarningIds.has(row.id) ? 'May be part of a longer lecture — check end time' : undefined}
                    >
                      {formatDuration(row.startTime, row.endTime)}
                    </td>
                    <td>
                      <input
                        className="import-cell-input"
                        value={row.courseCode}
                        onChange={(e) => updateEntry(row.id, 'courseCode', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="import-cell-input"
                        value={row.courseName}
                        onChange={(e) => updateEntry(row.id, 'courseName', e.target.value)}
                        title={row.courseName}
                      />
                    </td>
                    <td>
                      <input
                        className="import-cell-input"
                        value={row.lecturerName}
                        onChange={(e) => updateEntry(row.id, 'lecturerName', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="import-cell-input"
                        value={row.hallName}
                        onChange={(e) => updateEntry(row.id, 'hallName', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="import-cell-input"
                        value={row.groupName}
                        onChange={(e) => updateEntry(row.id, 'groupName', e.target.value)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-icon text-red-600"
                        title="Remove row"
                        onClick={() => removeEntry(row.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="import-errors">
          <h3><AlertCircle size={16} /> Validation Errors ({errors.length})</h3>
          <ul>
            {errors.map((e, i) => (
              <li key={i}>Row {e.row}: {e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="import-errors conflicts">
          <h3><AlertCircle size={16} /> Schedule Conflicts ({conflicts.length})</h3>
          <p className="text-sm text-slate-600 mb-2">
            Enable &quot;Replace existing entries for this period&quot; and import again, or edit conflicting rows above.
          </p>
          <ul>
            {conflicts.map((c, i) => (
              <li key={i}>
                Row {c.row}: {c.conflicts.map((cc) => cc.message).join('; ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary && (
        <div className="import-success">
          <CheckCircle size={16} />
          <span>Imported {summary.imported} entries</span>
          {summary.autoCreated && (
            <p className="text-xs mt-1 text-slate-600">
              Auto-created: {summary.autoCreated.courses} courses, {summary.autoCreated.halls} halls,{' '}
              {summary.autoCreated.groups} groups
            </p>
          )}
        </div>
      )}

      {(tables.length > 0 || entries.length > 0) && !summary && (
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={replacePeriod} onChange={(e) => setReplacePeriod(e.target.checked)} />
            <span>Replace existing entries for the same year/month in the database</span>
          </label>
          <button className="btn-primary import-btn" onClick={handleUpload} disabled={uploading}>
            {uploading ? (
              <>
                <span className="spinner-sm" /> Importing…
              </>
            ) : (
              <>
                <Upload size={16} />{' '}
                {tables.length > 0
                  ? `Import ${tables.length} timetable table(s)`
                  : `Import ${entries.length} entries`}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
