import { useState, useRef } from 'react';
import api from '@services/api';
import { showToast } from '@components/Toast';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';

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

export default function TimetableBulkImport({ onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);
  const [summary, setSummary] = useState<{ total: number; imported: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setErrors([]);
    setConflicts([]);
    setSummary(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter((l) => l.trim());
      const rows = lines.map((l) => l.split(',').map((c) => c.trim()));
      setPreview(rows.slice(0, 11)); // header + 10 rows
    };
    reader.readAsText(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setErrors([]);
    setConflicts([]);
    setSummary(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/admin/timetable/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSummary(res.data.summary);
      showToast('success', res.data.message);
      onSuccess();
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.validationErrors) setErrors(data.validationErrors);
      if (data?.conflicts) setConflicts(data.conflicts);
      if (!data?.validationErrors && !data?.conflicts) {
        showToast('error', data?.message || 'Import failed');
      }
    } finally {
      setUploading(false);
    }
  };

  const REQUIRED_HEADERS = ['dayOfWeek', 'startTime', 'endTime', 'courseCode', 'lecturerEmail', 'hallName', 'groupName'];

  return (
    <div className="tt-import">
      <div className="import-info-card">
        <h3><FileText size={18} /> CSV Import</h3>
        <p>Upload a CSV file with the following columns:</p>
        <code>{REQUIRED_HEADERS.join(', ')}</code>
        <p className="import-note">Optional columns: <code>semester</code>, <code>year</code></p>
      </div>

      <div className="import-upload-area" onClick={() => fileRef.current?.click()}>
        <Upload size={32} />
        <p>{file ? file.name : 'Click or drag to upload CSV file'}</p>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} hidden />
      </div>

      {preview.length > 0 && (
        <div className="import-preview">
          <h3>Preview (first 10 rows)</h3>
          <div className="dt-scroll">
            <table className="dt-table">
              <thead>
                <tr>
                  <th>#</th>
                  {preview[0]?.map((h, i) => <th key={i}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.slice(1).map((row, i) => {
                  const rowNum = i + 2;
                  const hasErr = errors.some((e) => e.row === rowNum);
                  const hasCon = conflicts.some((c) => c.row === rowNum);
                  return (
                    <tr key={i} className={hasErr ? 'row-error' : hasCon ? 'row-conflict' : ''}>
                      <td>{rowNum}</td>
                      {row.map((cell, j) => <td key={j}>{cell}</td>)}
                    </tr>
                  );
                })}
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
          <span>Successfully imported {summary.imported} of {summary.total} entries</span>
        </div>
      )}

      {file && !summary && (
        <button className="btn-primary import-btn" onClick={handleUpload} disabled={uploading}>
          {uploading ? <><span className="spinner-sm" /> Importing...</> : <><Upload size={16} /> Import Entries</>}
        </button>
      )}
    </div>
  );
}
