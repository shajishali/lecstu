import { useEffect, useState } from 'react';
import api, { showApiErrorToast } from '@services/api';
import { showToast } from '@components/Toast';
import EditableFetTimetableGrid from '@components/EditableFetTimetableGrid';
import { cloneGrid, prepareGridForEditing } from '@utils/fetGridEdit';
import type { TimetableGridSnapshot } from '../../types/timetableGrid';
import { Save, RotateCcw } from 'lucide-react';

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

export default function TimetableSavedTables() {
  const [list, setList] = useState<TableMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [grid, setGrid] = useState<TimetableGridSnapshot | null>(null);
  const [savedGrid, setSavedGrid] = useState<TimetableGridSnapshot | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty = grid && savedGrid && JSON.stringify(grid) !== JSON.stringify(savedGrid);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/admin/timetable/tables');
        const data = (res.data?.data ?? []) as TableMeta[];
        setList(data);
        if (data[0]) setSelectedId(data[0].id);
      } catch (err) {
        showApiErrorToast(err, 'Failed to load saved tables');
      } finally {
        setLoading(false);
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
      })
      .catch((err) => showApiErrorToast(err, 'Failed to load table'))
      .finally(() => setGridLoading(false));
  }, [selectedId]);

  const handleSave = async () => {
    if (!selectedId || !grid) return;
    setSaving(true);
    try {
      const res = await api.patch(`/admin/timetable/tables/${selectedId}`, { grid });
      const updated = res.data?.data ? prepareGridForEditing(res.data.data) : grid;
      setGrid(updated);
      setSavedGrid(cloneGrid(updated));
      showToast('success', res.data?.message || 'Timetable saved');
      setList((prev) =>
        prev.map((t) =>
          t.id === selectedId
            ? { ...t, slotCount: res.data?.imported ?? t.slotCount }
            : t,
        ),
      );
    } catch (err) {
      showApiErrorToast(err, 'Failed to save timetable');
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    if (savedGrid) setGrid(cloneGrid(savedGrid));
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading saved timetable tables…</p>;
  }

  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">
        No timetable tables stored yet. Import an Excel FET file from the Import tab — each batch (Y4 CSEC, ET-Y4-ETIA, …)
        is saved as one table you can review here.
      </div>
    );
  }

  const selected = list.find((t) => t.id === selectedId);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Edit batch tables here: drag time row borders to adjust slot times, or use the edit button on each cell to add,
        change, or remove a class. Click Save changes when done.
      </p>
      <div className="flex flex-wrap gap-2">
        {list.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn btn-sm ${selectedId === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedId(t.id)}
          >
            {t.tableTitle}
            <span className="ml-1 opacity-75">({t.groupName})</span>
          </button>
        ))}
      </div>
      {selected && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {selected.sourceFile && <>Source: {selected.sourceFile} · </>}
            Period: {selected.year} / month {selected.month} / week {selected.week} · {selected.slotCount} slots
            {isDirty && <span className="ml-2 font-medium text-amber-700">Unsaved changes</span>}
          </p>
          <div className="flex gap-2">
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
      <div className="rounded-xl border border-slate-200 bg-white p-4 max-h-[75vh] overflow-auto">
        {gridLoading ? (
          <p className="text-sm text-slate-500">Loading grid…</p>
        ) : grid ? (
          <EditableFetTimetableGrid grid={grid} onChange={setGrid} />
        ) : null}
      </div>
    </div>
  );
}
