import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuthStore } from '@store/authStore';
import api from '@services/api';
import { showToast } from '@components/Toast';
import { Plus, Save, Trash2, Calendar } from 'lucide-react';

type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

type SlotType = 'TEACHING' | 'BUSY' | 'OFFICE_HOUR';

interface ScheduleSlot {
  id?: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slotType: SlotType;
  label: string;
  location: string;
}

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

const emptySlot = (): ScheduleSlot => ({
  dayOfWeek: 'MONDAY',
  startTime: '09:00',
  endTime: '10:00',
  slotType: 'TEACHING',
  label: '',
  location: '',
});

export default function LecturerMySchedule() {
  const { user } = useAuthStore();
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/lecturers/me/schedule');
      const data = (res.data.data || []) as ScheduleSlot[];
      setSlots(
        data.map((s) => ({
          ...s,
          label: s.label || '',
          location: s.location || '',
        })),
      );
    } catch {
      showToast('error', 'Failed to load your schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const updateSlot = (index: number, patch: Partial<ScheduleSlot>) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = slots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        slotType: s.slotType,
        label: s.label.trim() || null,
        location: s.location.trim() || null,
      }));
      const res = await api.put('/lecturers/me/schedule', { slots: payload });
      const saved = (res.data.data || []) as ScheduleSlot[];
      setSlots(
        saved.map((s) => ({
          ...s,
          label: s.label || '',
          location: s.location || '',
        })),
      );
      showToast('success', 'Your weekly schedule was saved. Students see updated availability.');
      window.dispatchEvent(new Event('timetable-updated'));
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      showToast('error', ax.response?.data?.message || 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'LECTURER') {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Only lecturers can edit a personal schedule here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
          <Calendar size={24} />
          My weekly schedule
        </h1>
        <p className="text-slate-600 mt-2 text-sm leading-relaxed">
          Set your own teaching and busy times here. This is separate from the faculty student
          timetable import — students use this schedule to see when you are free and to book
          appointments.
        </p>
      </div>

      {loading ? (
        <div className="ha-loading">
          <div className="spinner" />
          <p>Loading schedule...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {slots.length === 0 ? (
            <p className="text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg p-6 text-center">
              No blocks yet. Add teaching or busy times so students know when you are unavailable.
            </p>
          ) : (
            slots.map((slot, index) => (
              <div
                key={slot.id ?? `new-${index}`}
                className="grid gap-3 p-4 bg-white border border-slate-200 rounded-lg shadow-sm md:grid-cols-12 items-end"
              >
                <label className="md:col-span-2 block text-sm">
                  <span className="text-slate-600">Day</span>
                  <select
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                    value={slot.dayOfWeek}
                    onChange={(e) =>
                      updateSlot(index, { dayOfWeek: e.target.value as DayOfWeek })
                    }
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {DAY_LABELS[d]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-2 block text-sm">
                  <span className="text-slate-600">From</span>
                  <input
                    type="time"
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                    value={slot.startTime}
                    onChange={(e) => updateSlot(index, { startTime: e.target.value })}
                  />
                </label>
                <label className="md:col-span-2 block text-sm">
                  <span className="text-slate-600">To</span>
                  <input
                    type="time"
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                    value={slot.endTime}
                    onChange={(e) => updateSlot(index, { endTime: e.target.value })}
                  />
                </label>
                <label className="md:col-span-2 block text-sm">
                  <span className="text-slate-600">Type</span>
                  <select
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                    value={slot.slotType}
                    onChange={(e) =>
                      updateSlot(index, { slotType: e.target.value as SlotType })
                    }
                  >
                    <option value="TEACHING">Teaching</option>
                    <option value="BUSY">Busy</option>
                    <option value="OFFICE_HOUR">Office hour (shown, not blocking)</option>
                  </select>
                </label>
                <label className="md:col-span-2 block text-sm">
                  <span className="text-slate-600">Label</span>
                  <input
                    type="text"
                    placeholder="e.g. CS lecture"
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                    value={slot.label}
                    onChange={(e) => updateSlot(index, { label: e.target.value })}
                  />
                </label>
                <label className="md:col-span-1 block text-sm">
                  <span className="text-slate-600">Place</span>
                  <input
                    type="text"
                    placeholder="Room"
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                    value={slot.location}
                    onChange={(e) => updateSlot(index, { location: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  className="md:col-span-1 btn btn-secondary btn-sm flex items-center justify-center gap-1"
                  onClick={() => removeSlot(index)}
                  aria-label="Remove slot"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              className="btn btn-secondary flex items-center gap-2"
              onClick={() => setSlots((prev) => [...prev, emptySlot()])}
            >
              <Plus size={16} /> Add time block
            </button>
            <button type="submit" className="btn btn-primary flex items-center gap-2" disabled={saving}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save schedule'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
