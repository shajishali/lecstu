import { useState } from 'react';
import Modal from '@components/Modal';
import api from '@services/api';
import { showToast } from '@components/Toast';
import { AlertTriangle } from 'lucide-react';
import type { DropdownData } from './TimetableManagement';

interface Entry {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  semester: number;
  year: number;
  course: { id: string };
  lecturer: { id: string };
  hall: { id: string };
  group: { id: string };
}

interface Props {
  entry: Entry | null;
  dropdowns: DropdownData;
  onClose: () => void;
  onSuccess: () => void;
}

interface Conflict {
  type: string;
  message: string;
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default function TimetableForm({ entry, dropdowns, onClose, onSuccess }: Props) {
  const isEdit = !!entry;

  const [form, setForm] = useState({
    dayOfWeek: entry?.dayOfWeek || 'MONDAY',
    startTime: entry?.startTime || '08:00',
    endTime: entry?.endTime || '09:00',
    semester: entry?.semester || 1,
    year: entry?.year || 2026,
    courseId: entry?.course.id || '',
    lecturerId: entry?.lecturer.id || '',
    hallId: entry?.hall.id || '',
    groupId: entry?.group.id || '',
  });

  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setConflicts([]);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setConflicts([]);

    if (!form.courseId || !form.lecturerId || !form.hallId || !form.groupId) {
      setError('All fields are required');
      return;
    }
    if (form.startTime >= form.endTime) {
      setError('Start time must be before end time');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/admin/timetable/${entry!.id}`, form);
      } else {
        await api.post('/admin/timetable', form);
      }
      onSuccess();
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.conflicts) {
        setConflicts(data.conflicts);
      } else {
        setError(data?.message || 'Failed to save entry');
        showToast('error', data?.message || 'Failed to save entry');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={isEdit ? 'Edit Timetable Entry' : 'Create Timetable Entry'}
      width="600px"
    >
      {conflicts.length > 0 && (
        <div className="tt-conflicts">
          <div className="conflict-header">
            <AlertTriangle size={16} /> Schedule Conflicts Detected
          </div>
          {conflicts.map((c, i) => (
            <div key={i} className="conflict-item">{c.message}</div>
          ))}
        </div>
      )}

      {error && <div className="form-error-msg">{error}</div>}

      <form onSubmit={handleSubmit} className="tt-form">
        <div className="form-row-2">
          <label>
            Day of Week
            <select value={form.dayOfWeek} onChange={(e) => handleChange('dayOfWeek', e.target.value)}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label>
            Semester / Year
            <div className="form-inline">
              <select value={form.semester} onChange={(e) => handleChange('semester', parseInt(e.target.value))}>
                <option value={1}>Semester 1</option>
                <option value={2}>Semester 2</option>
              </select>
              <input
                type="number"
                value={form.year}
                onChange={(e) => handleChange('year', parseInt(e.target.value))}
                min={2020}
                max={2100}
              />
            </div>
          </label>
        </div>

        <div className="form-row-2">
          <label>
            Start Time
            <input type="time" value={form.startTime} onChange={(e) => handleChange('startTime', e.target.value)} />
          </label>
          <label>
            End Time
            <input type="time" value={form.endTime} onChange={(e) => handleChange('endTime', e.target.value)} />
          </label>
        </div>

        <label>
          Course
          <select value={form.courseId} onChange={(e) => handleChange('courseId', e.target.value)}>
            <option value="">— Select Course —</option>
            {dropdowns.courses.map((c) => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </select>
        </label>

        <label>
          Lecturer
          <select value={form.lecturerId} onChange={(e) => handleChange('lecturerId', e.target.value)}>
            <option value="">— Select Lecturer —</option>
            {dropdowns.lecturers.map((l) => (
              <option key={l.id} value={l.id}>{l.firstName} {l.lastName}</option>
            ))}
          </select>
        </label>

        <label>
          Lecture Hall
          <select value={form.hallId} onChange={(e) => handleChange('hallId', e.target.value)}>
            <option value="">— Select Hall —</option>
            {dropdowns.halls.map((h) => (
              <option key={h.id} value={h.id}>{h.name} ({h.building}, cap: {h.capacity})</option>
            ))}
          </select>
        </label>

        <label>
          Student Group
          <select value={form.groupId} onChange={(e) => handleChange('groupId', e.target.value)}>
            <option value="">— Select Group —</option>
            {dropdowns.groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name} (batch {g.batchYear})</option>
            ))}
          </select>
        </label>

        <div className="tt-form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <span className="spinner-sm" /> : (isEdit ? 'Update' : 'Create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
