import { useEffect, useState, useCallback } from 'react';
import api from '@services/api';
import { showToast } from '@components/Toast';
import DataTable from '@components/DataTable';
import ConfirmDialog from '@components/ConfirmDialog';
import TimetableForm from './TimetableForm';
import TimetableCalendar from './TimetableCalendar';
import TimetableBulkImport from './TimetableBulkImport';
import {
  Plus,
  Calendar as CalendarIcon,
  List,
  Upload,
  Edit2,
  Trash2,
  Filter,
  X,
} from 'lucide-react';

interface TimetableEntry {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  semester: number;
  year: number;
  course: { id: string; name: string; code: string };
  lecturer: { id: string; firstName: string; lastName: string; email: string };
  hall: { id: string; name: string; building: string; capacity: number };
  group: { id: string; name: string; batchYear: number };
}

export interface DropdownData {
  courses: { id: string; name: string; code: string }[];
  lecturers: { id: string; firstName: string; lastName: string; email: string }[];
  halls: { id: string; name: string; building: string; capacity: number }[];
  groups: { id: string; name: string; batchYear: number }[];
}

type ViewMode = 'table' | 'calendar' | 'import';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default function TimetableManagement() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [dropdowns, setDropdowns] = useState<DropdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<TimetableEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimetableEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [filterDay, setFilterDay] = useState('');
  const [filterLecturer, setFilterLecturer] = useState('');
  const [filterHall, setFilterHall] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  const fetchEntries = useCallback(async (pg = 1) => {
    try {
      const params: Record<string, string> = { page: String(pg), limit: '200' };
      if (filterDay) params.dayOfWeek = filterDay;
      if (filterLecturer) params.lecturerId = filterLecturer;
      if (filterHall) params.hallId = filterHall;
      if (filterGroup) params.groupId = filterGroup;

      const res = await api.get('/admin/timetable', { params });
      setEntries(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      showToast('error', 'Failed to load timetable');
    } finally {
      setLoading(false);
    }
  }, [filterDay, filterLecturer, filterHall, filterGroup]);

  const fetchDropdowns = useCallback(async () => {
    try {
      const res = await api.get('/admin/timetable/dropdowns');
      setDropdowns(res.data.data);
    } catch {
      showToast('error', 'Failed to load form data');
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
    setFilterDay('');
    setFilterLecturer('');
    setFilterHall('');
    setFilterGroup('');
  };

  const hasFilters = filterDay || filterLecturer || filterHall || filterGroup;

  const columns = [
    { key: 'dayOfWeek', label: 'Day', sortable: true },
    { key: 'startTime', label: 'Start', sortable: true },
    { key: 'endTime', label: 'End', sortable: true },
    {
      key: 'course',
      label: 'Course',
      render: (r: TimetableEntry) => (
        <span title={r.course.name}><strong>{r.course.code}</strong> — {r.course.name}</span>
      ),
    },
    {
      key: 'lecturer',
      label: 'Lecturer',
      render: (r: TimetableEntry) => `${r.lecturer.firstName} ${r.lecturer.lastName}`,
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
        <div className="tt-actions">
          <button className="tt-action-btn edit" onClick={(e) => { e.stopPropagation(); handleEdit(r); }} title="Edit">
            <Edit2 size={14} />
          </button>
          <button className="tt-action-btn delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }} title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner" />
        <p>Loading timetable...</p>
      </div>
    );
  }

  return (
    <div className="timetable-mgmt">
      <div className="admin-page-header">
        <div>
          <h1>Timetable Management</h1>
          <p>{pagination.total} entries total</p>
        </div>
        <div className="tt-header-actions">
          <div className="tt-view-toggle">
            <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>
              <List size={16} /> Table
            </button>
            <button className={viewMode === 'calendar' ? 'active' : ''} onClick={() => setViewMode('calendar')}>
              <CalendarIcon size={16} /> Calendar
            </button>
            <button className={viewMode === 'import' ? 'active' : ''} onClick={() => setViewMode('import')}>
              <Upload size={16} /> Import
            </button>
          </div>
          <button className="btn-primary" onClick={handleCreate}>
            <Plus size={16} /> Add Entry
          </button>
        </div>
      </div>

      {viewMode !== 'import' && (
        <div className="tt-filters-bar">
          <button className={`tt-filter-toggle ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
            <Filter size={16} /> Filters
            {hasFilters && <span className="filter-badge" />}
          </button>
          {hasFilters && (
            <button className="tt-clear-filters" onClick={clearFilters}><X size={14} /> Clear</button>
          )}
        </div>
      )}

      {showFilters && viewMode !== 'import' && dropdowns && (
        <div className="tt-filter-panel">
          <div className="tt-filter-row">
            <label>
              Day
              <select value={filterDay} onChange={(e) => setFilterDay(e.target.value)}>
                <option value="">All Days</option>
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label>
              Lecturer
              <select value={filterLecturer} onChange={(e) => setFilterLecturer(e.target.value)}>
                <option value="">All Lecturers</option>
                {dropdowns.lecturers.map((l) => (
                  <option key={l.id} value={l.id}>{l.firstName} {l.lastName}</option>
                ))}
              </select>
            </label>
            <label>
              Hall
              <select value={filterHall} onChange={(e) => setFilterHall(e.target.value)}>
                <option value="">All Halls</option>
                {dropdowns.halls.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </label>
            <label>
              Group
              <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
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

      {viewMode === 'calendar' && (
        <TimetableCalendar entries={entries} onEdit={handleEdit} />
      )}

      {viewMode === 'import' && dropdowns && (
        <TimetableBulkImport onSuccess={() => { fetchEntries(); setViewMode('table'); }} />
      )}

      {formOpen && dropdowns && (
        <TimetableForm
          entry={editEntry}
          dropdowns={dropdowns}
          onClose={() => { setFormOpen(false); setEditEntry(null); }}
          onSuccess={handleFormSuccess}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Timetable Entry"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.course.code}" on ${deleteTarget.dayOfWeek} ${deleteTarget.startTime}–${deleteTarget.endTime}?`
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
