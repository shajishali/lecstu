import { useCallback, useEffect, useState } from 'react';
import api, { showApiErrorToast } from '@services/api';
import { showToast } from '@components/Toast';
import Modal from '@components/Modal';
import ConfirmDialog from '@components/ConfirmDialog';
import EditableFetTimetableGrid from '@components/EditableFetTimetableGrid';
import type { AutocompleteOption } from '@components/EditableFetTimetableGrid';
import { cloneGrid, prepareGridForEditing } from '@utils/fetGridEdit';
import type { TimetableGridSnapshot } from '../../types/timetableGrid';
import { Plus, Save, RotateCcw, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { formatBatchTableTitle } from '@utils/batchTableMeta';

interface TableMeta {
  id: string;
  tableTitle: string;
  groupName: string;
  year: number;
  month: number;
  week: number;
  slotCount: number;
  importedAt: string;
  sourceFile: string | null;
}

interface BatchForm {
  tableTitle: string;
  groupName: string;
  departmentId: string;
}

interface CourseOptionResponse {
  code?: string;
  name?: string;
}

interface LecturerOptionResponse {
  firstName?: string;
  lastName?: string;
  timetableCode?: string | null;
  email?: string;
}

interface HallOptionResponse {
  name?: string;
  building?: string;
}

const defaultForm = (): BatchForm => ({
  tableTitle: '',
  groupName: '',
  departmentId: '',
});

export default function TimetableSavedTables() {
  const [list, setList] = useState<TableMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [grid, setGrid] = useState<TimetableGridSnapshot | null>(null);
  const [savedGrid, setSavedGrid] = useState<TimetableGridSnapshot | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TableMeta | null>(null);
  const [form, setForm] = useState<BatchForm>(defaultForm);
  const [formSaving, setFormSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TableMeta | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saveConflictSummary, setSaveConflictSummary] = useState<string | null>(null);
  const [courseOptions, setCourseOptions] = useState<AutocompleteOption[]>([]);
  const [lecturerOptions, setLecturerOptions] = useState<AutocompleteOption[]>([]);
  const [hallOptions, setHallOptions] = useState<AutocompleteOption[]>([]);

  const isDirty = grid && savedGrid && JSON.stringify(grid) !== JSON.stringify(savedGrid);

  const fetchList = useCallback(async () => {
    try {
      const res = await api.get('/admin/timetable/tables');
      const data = (res.data?.data ?? []) as TableMeta[];
      setList(data);
      return data;
    } catch (err) {
      showApiErrorToast(err, 'Failed to load saved tables');
      return [];
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchList();
        if (data[0]) setSelectedId(data[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchList]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/profile/departments');
        const data = res.data.data;
        const depts = Array.isArray(data) ? data : data.departments || [];
        setDepartments(depts);
        if (depts[0]?.id) {
          setForm((f) => (f.departmentId ? f : { ...f, departmentId: depts[0].id }));
        }
      } catch {
        /* optional */
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [dropdownRes, lecturerRes, hallRes] = await Promise.all([
          api.get('/admin/timetable/dropdowns'),
          api.get('/lecturers'),
          api.get('/admin/halls', { params: { activeOnly: 'true' } }),
        ]);

        const courses = (dropdownRes.data?.data?.courses ?? []) as CourseOptionResponse[];
        setCourseOptions(
          courses
            .flatMap((course): AutocompleteOption[] => {
              const code = course.code?.trim();
              if (!code) return [];
              const name = course.name?.trim();
              return [{
                value: code,
                label: name ? `${code} - ${name}` : code,
                searchText: `${code} ${name ?? ''}`,
              }];
            }),
        );

        const lecturers = (lecturerRes.data?.data ?? []) as LecturerOptionResponse[];
        setLecturerOptions(
          lecturers
            .flatMap((lecturer): AutocompleteOption[] => {
              const name = `${lecturer.firstName ?? ''} ${lecturer.lastName ?? ''}`.trim();
              const code = lecturer.timetableCode?.trim();
              if (!name && !code) return [];
              return [{
                value: code || name,
                label: name || code || '',
                searchText: `${code ?? ''} ${name}`,
              }];
            }),
        );

        const halls = (hallRes.data?.data ?? []) as HallOptionResponse[];
        setHallOptions([
          { value: 'TBD', label: 'TBD' },
          ...halls
            .flatMap((hall): AutocompleteOption[] => {
              const name = hall.name?.trim();
              if (!name) return [];
              return [{
                value: name,
                label: hall.building ? `${name} - ${hall.building}` : name,
                searchText: `${name} ${hall.building ?? ''}`,
              }];
            }),
        ]);
      } catch {
        /* Dropdown suggestions are optional; manual typing still works. */
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setGrid(null);
      setSavedGrid(null);
      return;
    }
    setGridLoading(true);
    api
      .get(`/admin/timetable/tables/${selectedId}`)
      .then((res) => {
        const loaded = res.data?.data ?? null;
        const prepared = loaded ? prepareGridForEditing(loaded) : null;
        setGrid(prepared);
        setSavedGrid(prepared ? cloneGrid(prepared) : null);
        setSaveConflictSummary(null);
      })
      .catch((err) => showApiErrorToast(err, 'Failed to load table'))
      .finally(() => setGridLoading(false));
  }, [selectedId]);

  const handleSave = async () => {
    if (!selectedId || !grid) return;
    setSaving(true);
    setSaveConflictSummary(null);
    try {
      const res = await api.patch(`/admin/timetable/tables/${selectedId}`, { grid });
      const updated = res.data?.data ? prepareGridForEditing(res.data.data) : grid;
      setGrid(updated);
      setSavedGrid(cloneGrid(updated));
      setSaveConflictSummary(null);
      showToast('success', res.data?.message || 'Timetable saved');
      setList((prev) =>
        prev.map((t) =>
          t.id === selectedId
            ? { ...t, slotCount: res.data?.imported ?? t.slotCount }
            : t,
        ),
      );
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string }; status?: number } };
      const summary = ax.response?.data?.message;
      const isConflict = ax.response?.status === 409;
      if (summary && isConflict) {
        setSaveConflictSummary(summary);
        if (savedGrid) {
          setGrid(cloneGrid(savedGrid));
        }
      } else {
        showApiErrorToast(err, 'Failed to save timetable');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    if (savedGrid) {
      setGrid(cloneGrid(savedGrid));
      setSaveConflictSummary(null);
    }
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm({
      ...defaultForm(),
      departmentId: departments[0]?.id || '',
    });
    setFormOpen(true);
  };

  const openEdit = (t: TableMeta) => {
    setEditTarget(t);
    setForm({
      tableTitle: t.tableTitle,
      groupName: t.groupName,
      departmentId: departments[0]?.id || '',
    });
    setFormOpen(true);
  };

  const handleFormSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const groupName = form.groupName.trim();
    const tableTitle = form.tableTitle.trim() || formatBatchTableTitle(groupName);
    if (!groupName) {
      showToast('error', 'Group code is required (e.g. CS-Y3-AINT)');
      return;
    }
    setFormSaving(true);
    try {
      if (editTarget) {
        const res = await api.patch(`/admin/timetable/tables/${editTarget.id}/meta`, {
          tableTitle,
          groupName,
          departmentId: form.departmentId || undefined,
        });
        const updated = res.data?.data as TableMeta;
        showToast('success', 'Batch table updated');
        const data = await fetchList();
        const nextId = updated?.id ?? editTarget.id;
        if (data.some((t) => t.id === nextId)) setSelectedId(nextId);
        setFormOpen(false);
      } else {
        const res = await api.post('/admin/timetable/tables', {
          tableTitle,
          groupName,
          departmentId: form.departmentId || undefined,
        });
        const created = res.data?.data as TableMeta;
        showToast('success', 'Batch table created');
        const data = await fetchList();
        if (created?.id) setSelectedId(created.id);
        else if (data[0]) setSelectedId(data[0].id);
        setFormOpen(false);
      }
    } catch (err) {
      showApiErrorToast(err, editTarget ? 'Failed to update batch table' : 'Failed to create batch table');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/timetable/tables/${deleteTarget.id}`);
      showToast('success', 'Batch table deleted');
      const remaining = list.filter((t) => t.id !== deleteTarget.id);
      setList(remaining);
      if (selectedId === deleteTarget.id) {
        setSelectedId(remaining[0]?.id ?? null);
      }
      setDeleteTarget(null);
    } catch (err) {
      showApiErrorToast(err, 'Failed to delete batch table');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading saved timetable tables…</p>;
  }

  const selected = list.find((t) => t.id === selectedId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-slate-600 max-w-3xl">
          Manage batch tables here: create a new batch, rename or fix a mixed group code, or delete a wrong table.
          If a room is already used by another batch at the same time, tick <strong>Shared room (admin only)</strong> in the
          cell editor — students still see only the room code (e.g. AB-LCH-09-1).
        </p>
        <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={openCreate}>
          <Plus size={14} /> New batch table
        </button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">
          No timetable tables stored yet. Click <strong>New batch table</strong> to add one manually, or import an Excel
          FET file from the Import tab.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map((t) => (
            <div key={t.id} className="inline-flex items-stretch rounded-lg overflow-hidden border border-slate-200">
              <button
                type="button"
                className={`btn btn-sm rounded-none border-0 ${selectedId === t.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedId(t.id)}
                title={`${t.tableTitle} · ${t.groupName}`}
              >
                <span className="font-medium">{t.tableTitle}</span>
                <span className="ml-1.5 text-[11px] opacity-80">({t.groupName})</span>
              </button>
              <button
                type="button"
                className="px-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 border-l border-slate-200"
                title="Edit batch details"
                onClick={() => openEdit(t)}
              >
                <Edit2 size={14} />
              </button>
              <button
                type="button"
                className="px-2 text-red-500 hover:bg-red-50 border-l border-slate-200"
                title="Delete batch table"
                onClick={() => setDeleteTarget(t)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {selected.sourceFile && <>Source: {selected.sourceFile} · </>}
            {selected.slotCount} slots
            {isDirty && <span className="ml-2 font-medium text-amber-700">Unsaved changes</span>}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => openEdit(selected)}
              disabled={saving}
            >
              <Edit2 size={14} /> Edit batch
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              onClick={handleRevert}
              disabled={!isDirty || saving}
            >
              <RotateCcw size={14} /> Revert
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
              onClick={handleSave}
              disabled={!isDirty || saving}
            >
              <Save size={14} />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {saveConflictSummary && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>
              {saveConflictSummary} Unsaved slots were removed — open each cell, click{' '}
              <strong>Apply</strong>, fix the room or tick <strong>Shared room</strong>, then save
              again.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 max-h-[75vh] overflow-auto">
        {gridLoading ? (
          <p className="text-sm text-slate-500">Loading grid…</p>
        ) : grid ? (
          <EditableFetTimetableGrid
            grid={grid}
            tableId={selectedId ?? undefined}
            courseOptions={courseOptions}
            lecturerOptions={lecturerOptions}
            hallOptions={hallOptions}
            onChange={(next) => {
              setGrid(next);
              setSaveConflictSummary(null);
            }}
          />
        ) : list.length === 0 ? null : (
          <p className="text-sm text-slate-500">Select a batch table above.</p>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editTarget ? 'Edit batch table' : 'New batch table'}
        width="520px"
      >
        <form onSubmit={handleFormSave} className="space-y-4">
          <p className="text-sm text-slate-600">
            Use a unique <strong>group code</strong> (e.g. <code className="text-xs">CS-Y3-AINT</code>) so batches do not
            get mixed. The display title is what students see on the button.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate-700">Display title</span>
            <input
              type="text"
              value={form.tableTitle}
              onChange={(e) => setForm({ ...form, tableTitle: e.target.value })}
              placeholder="Y1 BST Group"
              className="rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate-700">Group code</span>
            <input
              type="text"
              value={form.groupName}
              onChange={(e) => {
                const groupName = e.target.value;
                const autoTitle = formatBatchTableTitle(groupName);
                const tableTitle =
                  !form.tableTitle ||
                  form.tableTitle === formatBatchTableTitle(form.groupName) ||
                  !editTarget
                    ? autoTitle
                    : form.tableTitle;
                setForm({ ...form, groupName, tableTitle });
              }}
              placeholder="CT-Y1"
              required
              className="rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
            <span className="text-xs text-slate-500">
              Use FCT format: <code>CS-Y3-AINT</code>, <code>CT-Y1</code>, <code>BS-Y1</code> (not <code>Y1-CT-23</code>)
            </span>
          </label>
          {!editTarget && departments.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-700">Department (for new group)</span>
              <select
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                className="rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={formSaving}>
              {formSaving ? 'Saving…' : editTarget ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete batch table?"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.tableTitle}" (${deleteTarget.groupName})? This removes the stored grid and all timetable slots for this batch. The student group itself is kept.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
