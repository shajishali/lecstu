import { useEffect, useState, useCallback } from 'react';
import api, { showApiErrorToast } from '@services/api';
import { formatCourseLabel } from '@utils/courseDisplay';
import { formatTimetableLecturer, isTimetableLecturerUnassigned } from '@utils/timetableLecturerDisplay';
import { showToast } from '@components/Toast';
import DataTable from '@components/DataTable';
import ConfirmDialog from '@components/ConfirmDialog';
import TimetableForm from './TimetableForm';
import TimetableBulkImport from './TimetableBulkImport';
import TimetableSavedTables from './TimetableSavedTables';
import {
  Plus,
  List,
  Upload,
  Edit2,
  Trash2,
  Filter,
  X,
} from 'lucide-react';

interface TimetableEntry {
  id: string;
  year: number;
  month: number;
  week: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  semester: number;
  course: { id: string; name: string; code: string };
  lecturerInitials?: string | null;
  lecturer: { id: string; firstName: string; lastName: string; designation?: string | null; email: string };
  hall: { id: string; name: string; building: string; capacity: number };
  group: { id: string; name: string; batchYear: number; batchLabel?: string | null };
}

export interface DropdownData {
  courses: { id: string; name: string; code: string }[];
  lecturers: { id: string; firstName: string; lastName: string; designation?: string | null; email: string }[];
  halls: { id: string; name: string; building: string; capacity: number }[];
  groups: {
    id: string;
    name: string;
    batchYear: number;
    batchLabel?: string | null;
    memberCount?: number;
    entryCount?: number;
  }[];
}

type ViewMode = 'table' | 'import' | 'tables';

const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function TimetableManagement() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [dropdowns, setDropdowns] = useState<DropdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<TimetableEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimetableEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [assignTarget, setAssignTarget] = useState<TimetableEntry | null>(null);
  const [assigningLecturerId, setAssigningLecturerId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [reresolving, setReresolving] = useState(false);

  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterLecturer, setFilterLecturer] = useState('');
  const [filterHall, setFilterHall] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  const fetchEntries = useCallback(async (pg = 1) => {
    try {
      const params: Record<string, string> = { page: String(pg), limit: '200' };
      if (filterYear) params.year = filterYear;
      if (filterMonth) params.month = filterMonth;
      if (filterLecturer) params.lecturerId = filterLecturer;
      if (filterHall) params.hallId = filterHall;
      if (filterGroup) params.groupId = filterGroup;

      const res = await api.get('/admin/timetable', { params });
      setEntries(res.data?.data ?? []);
      setPagination(res.data?.pagination ?? { page: 1, total: 0, totalPages: 1 });
    } catch (err: any) {
      showApiErrorToast(err, 'Failed to load timetable');
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterMonth, filterLecturer, filterHall, filterGroup]);

  const fetchDropdowns = useCallback(async () => {
    try {
      const res = await api.get('/admin/timetable/dropdowns');
      setDropdowns(res.data?.data ?? null);
    } catch (err: any) {
      showApiErrorToast(err, 'Failed to load form data');
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchDropdowns();
  }, [fetchEntries, fetchDropdowns]);

  const handleCreate = () => { setEditEntry(null); setFormOpen(true); };
  const handleEdit = (e: TimetableEntry) => { setEditEntry(e); setFormOpen(true); };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setEditEntry(null);
    fetchEntries(pagination.page);
    showToast('success', editEntry ? 'Entry updated' : 'Entry created');
  };

  const handleReresolveLecturers = async () => {
    setReresolving(true);
    try {
      const res = await api.post('/admin/timetable/reresolve-lecturers');
      showToast('success', res.data.message || 'Wrong lecturer links cleared');
      fetchEntries(pagination.page);
    } catch (err: unknown) {
      showApiErrorToast(err, 'Could not match lecturer codes');
    } finally {
      setReresolving(false);
    }
  };

  const handleAssignLecturer = async () => {
    if (!assignTarget || !assigningLecturerId) return;
    setAssigning(true);
    try {
      await api.patch(`/admin/timetable/${assignTarget.id}/assign-lecturer`, { lecturerId: assigningLecturerId });
      showToast('success', 'Lecturer assigned');
      setAssignTarget(null);
      setAssigningLecturerId('');
      fetchEntries(pagination.page);
    } catch (err: any) {
      showApiErrorToast(err, 'Failed to assign lecturer');
    } finally {
      setAssigning(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/timetable/${deleteTarget.id}`);
      showToast('success', 'Timetable entry deleted');
      setDeleteTarget(null);
      fetchEntries(pagination.page);
    } catch {
      showToast('error', 'Failed to delete entry');
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setFilterYear('');
    setFilterMonth('');
    setFilterLecturer('');
    setFilterHall('');
    setFilterGroup('');
  };

  const hasFilters = filterYear || filterMonth || filterLecturer || filterHall || filterGroup;

  const columns = [
    { key: 'dayOfWeek', label: 'Day', sortable: true },
    { key: 'startTime', label: 'Start', sortable: true },
    { key: 'endTime', label: 'End', sortable: true },
    {
      key: 'course',
      label: 'Course',
      render: (r: TimetableEntry) => (
        <span title={r.course.name}>
          <strong>{formatCourseLabel(r.course.code, r.course.name)}</strong>
        </span>
      ),
    },
    {
      key: 'lecturer',
      label: 'Lecturer',
      render: (r: TimetableEntry) => {
        const label = formatTimetableLecturer(r);
        const isUnassigned = isTimetableLecturerUnassigned(r);
        return (
          <span className={isUnassigned ? 'text-amber-600 font-medium' : ''}>
            <span title={r.lecturer.email !== 'unassigned@lecstu.edu' ? `${r.lecturer.firstName} ${r.lecturer.lastName}` : undefined}>
              {label}
            </span>
            {isUnassigned && (
              <button
                type="button"
                className="ml-2 text-xs text-[var(--color-primary-hover)] hover:underline"
                onClick={(e) => { e.stopPropagation(); setAssignTarget(r); setAssigningLecturerId(''); }}
              >
                Assign
              </button>
            )}
          </span>
        );
      },
    },
    {
      key: 'hall',
      label: 'Hall',
      render: (r: TimetableEntry) => r.hall.name,
    },
    {
      key: 'group',
      label: 'Group',
      render: (r: TimetableEntry) => r.group.name,
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (r: TimetableEntry) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors [border-color:var(--color-primary)]/30 [background-color:var(--color-primary-light)] [color:var(--color-primary-hover)] hover:bg-[var(--color-primary)]/10"
            onClick={(e) => { e.stopPropagation(); handleEdit(r); }}
            title="Edit this entry"
          >
            <Edit2 size={12} /> Edit
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}
            title="Delete this entry"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-slate-500">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-primary)]" />
        <p>Loading timetable...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Timetable Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            {pagination.total} entries total
            {hasFilters && ' (filtered)'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'table' ? 'text-white [background-color:var(--color-primary)]' : 'text-slate-600 hover:bg-slate-100'
              }`}
              onClick={() => setViewMode('table')}
            >
              <List size={16} /> Table
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'import' ? 'text-white [background-color:var(--color-primary)]' : 'text-slate-600 hover:bg-slate-100'
              }`}
              onClick={() => setViewMode('import')}
            >
              <Upload size={16} /> Import
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'tables' ? 'text-white [background-color:var(--color-primary)]' : 'text-slate-600 hover:bg-slate-100'
              }`}
              onClick={() => setViewMode('tables')}
            >
              <List size={16} /> Batch tables
            </button>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
            onClick={handleCreate}
          >
            <Plus size={16} /> Add Entry
          </button>
        </div>
      </div>

      {viewMode !== 'import' && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={() => void handleReresolveLecturers()}
            disabled={reresolving}
            title="Clear wrong auto-assigned lecturers; sheet codes (ND, MB) stay on each row"
          >
            {reresolving ? 'Clearing…' : 'Clear wrong lecturers'}
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              showFilters
                ? 'border-[var(--color-primary)] text-white [background-color:var(--color-primary)]'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            }`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} /> Filters
            {hasFilters && (
              <span className="ml-1 h-2 w-2 rounded-full bg-amber-500" title="Filters active" />
            )}
          </button>
          {hasFilters && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              onClick={clearFilters}
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      )}

      {showFilters && viewMode !== 'import' && dropdowns && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-sm font-semibold text-slate-700">Filter by period</h4>
          <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-700">Year</span>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              >
                <option value="">All Years</option>
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-700">Month</span>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              >
                <option value="">All Months</option>
                {MONTH_NAMES.slice(1).map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </label>
          </div>
          <h4 className="mb-3 text-sm font-semibold text-slate-700">Filter by entity</h4>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-700">Lecturer</span>
              <select
                value={filterLecturer}
                onChange={(e) => setFilterLecturer(e.target.value)}
                className="rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              >
                <option value="">All Lecturers</option>
                {dropdowns.lecturers.map((l) => (
                  <option key={l.id} value={l.id}>{l.firstName} {l.lastName}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-700">Hall</span>
              <select
                value={filterHall}
                onChange={(e) => setFilterHall(e.target.value)}
                className="rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              >
                <option value="">All Halls</option>
                {dropdowns.halls.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-700">Group</span>
              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              >
                <option value="">All Groups</option>
                {dropdowns.groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {viewMode === 'table' && (
        <DataTable
          columns={columns}
          data={entries}
          pageSize={15}
          searchPlaceholder="Search courses, lecturers, halls..."
          emptyMessage="No timetable entries found"
        />
      )}

      {viewMode === 'import' && dropdowns && (
        <TimetableBulkImport onSuccess={() => { fetchEntries(); setViewMode('tables'); }} />
      )}

      {viewMode === 'tables' && <TimetableSavedTables />}

      {formOpen && dropdowns && (
        <TimetableForm
          entry={editEntry}
          dropdowns={dropdowns}
          onClose={() => { setFormOpen(false); setEditEntry(null); }}
          onSuccess={handleFormSuccess}
        />
      )}

      {assignTarget && dropdowns && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">Assign Lecturer</h3>
            <p className="mt-1 text-sm text-slate-600">
              {assignTarget.course.code} - {assignTarget.dayOfWeek} {assignTarget.startTime}-{assignTarget.endTime}
            </p>
            <select
              value={assigningLecturerId}
              onChange={(e) => setAssigningLecturerId(e.target.value)}
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            >
              <option value="">Select lecturer...</option>
              {dropdowns.lecturers
                .filter((l) => l.email !== 'unassigned@lecstu.edu')
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.firstName} {l.lastName}{l.designation ? ` - ${l.designation}` : ''}
                  </option>
                ))}
            </select>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => { setAssignTarget(null); setAssigningLecturerId(''); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
                onClick={handleAssignLecturer}
                disabled={!assigningLecturerId || assigning}
              >
                {assigning ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Timetable Entry"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.course.code}" on ${deleteTarget.dayOfWeek} ${deleteTarget.startTime}-${deleteTarget.endTime}?`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
