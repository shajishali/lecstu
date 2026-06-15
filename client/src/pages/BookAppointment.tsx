import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { showToast } from '@components/Toast';
import api, { showApiErrorToast } from '@services/api';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';

interface LecturerInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: { id: string; name: string } | null;
  office?: { roomNumber: string; building: string; floor: number };
}

interface FreeSlot {
  startTime: string;
  endTime: string;
}

interface DayAvailability {
  day: string;
  freeSlots: FreeSlot[];
}

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri',
};

const SLOT_DURATION_MINUTES = 30;

function formatTime(t: string): string {
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  const suffix = hr >= 12 ? 'PM' : 'AM';
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${display}:${m} ${suffix}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Split contiguous free slots into bookable 30-min sub-slots */
function splitIntoBookableSlots(freeSlots: FreeSlot[]): FreeSlot[] {
  const result: FreeSlot[] = [];
  for (const slot of freeSlots) {
    const startMin = timeToMinutes(slot.startTime);
    const endMin = timeToMinutes(slot.endTime);
    for (let m = startMin; m + SLOT_DURATION_MINUTES <= endMin; m += SLOT_DURATION_MINUTES) {
      result.push({
        startTime: minutesToTime(m),
        endTime: minutesToTime(m + SLOT_DURATION_MINUTES),
      });
    }
  }
  return result;
}

function getNextWeekdays(): { date: Date; dateStr: string; dayName: string }[] {
  const result: { date: Date; dateStr: string; dayName: string }[] = [];
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dayNum = d.getDay();
    if (dayNum >= 1 && dayNum <= 5) {
      const dayName = ['', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'][dayNum];
      result.push({
        date: d,
        dateStr: d.toISOString().split('T')[0],
        dayName,
      });
    }
  }
  return result;
}

export default function BookAppointment() {
  const { lecturerId } = useParams<{ lecturerId: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [lecturer, setLecturer] = useState<LecturerInfo | null>(null);
  const [dateOptions, setDateOptions] = useState<{ date: Date; dateStr: string; dayName: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availability, setAvailability] = useState<DayAvailability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<FreeSlot | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchLecturer = useCallback(async () => {
    if (!lecturerId) return;
    if (lecturerId.startsWith('fet:')) {
      showToast('error', 'This lecturer is not available for booking yet.');
      navigate('/lecturers');
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/lecturers/${lecturerId}`);
      if (res.data.data?.bookable === false) {
        showToast('info', 'This lecturer is not available for booking yet.');
        navigate(`/lecturers/${lecturerId}`);
        return;
      }
      setLecturer(res.data.data);
    } catch {
      showToast('error', 'Lecturer not found');
      navigate('/lecturers');
    } finally {
      setLoading(false);
    }
  }, [lecturerId, navigate]);

  useEffect(() => { fetchLecturer(); }, [fetchLecturer]);
  useEffect(() => { setDateOptions(getNextWeekdays()); }, []);

  const fetchAvailability = useCallback(async (dateStr: string) => {
    if (!lecturerId) return;
    try {
      const res = await api.get(`/lecturers/${lecturerId}/availability`, { params: { date: dateStr } });
      setAvailability(res.data.data);
    } catch {
      showToast('error', 'Failed to load availability');
    }
  }, [lecturerId]);

  useEffect(() => {
    if (selectedDate) fetchAvailability(selectedDate);
    else setAvailability(null);
  }, [selectedDate, fetchAvailability]);

  const handleSubmit = async () => {
    if (!lecturerId || !selectedDate || !selectedSlot) return;
    setSubmitting(true);
    try {
      const [h, m] = selectedSlot.startTime.split(':').map(Number);
      const dateTime = new Date(selectedDate);
      dateTime.setHours(h, m, 0, 0);

      const duration = (() => {
        const [sh, sm] = selectedSlot.startTime.split(':').map(Number);
        const [eh, em] = selectedSlot.endTime.split(':').map(Number);
        return (eh * 60 + em) - (sh * 60 + sm);
      })();

      await api.post('/appointments', {
        lecturerId,
        dateTime: dateTime.toISOString(),
        duration: duration || 30,
        reason: reason || undefined,
        notes: notes || undefined,
      });
      showToast('success', 'Appointment request sent successfully');
      window.dispatchEvent(new CustomEvent('appointments-updated'));
      navigate('/appointments');
    } catch (err: any) {
      showApiErrorToast(err, 'Failed to book appointment');
    } finally {
      setSubmitting(false);
    }
  };

  const btnOutline = 'rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm transition-colors hover:bg-slate-50 hover:border-slate-400';
  const btnOutlineActive = 'rounded-lg border px-3.5 py-2 text-sm text-white [border-color:var(--color-primary)] [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]';
  const btnPrimary = 'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]';
  const btnSecondary = 'inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50';

  if (loading || !lecturer) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-slate-500">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-primary)]" />
        <p>Loading...</p>
      </div>
    );
  }

  const selectedDateOption = dateOptions.find((d) => d.dateStr === selectedDate);

  return (
    <div>
      <button className={`${btnSecondary} mb-4`} onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Book Appointment</h1>
        <p className="mt-1 text-slate-600">
          with {lecturer.firstName} {lecturer.lastName}
          {lecturer.department && ` - ${lecturer.department.name}`}
        </p>
      </div>

      <div className="mb-6 flex gap-6 text-sm text-slate-500">
        <span className={step >= 1 ? 'font-semibold text-[var(--color-primary)]' : ''}>1. Pick date & time</span>
        <span className={step >= 2 ? 'font-semibold text-[var(--color-primary)]' : ''}>2. Confirm</span>
      </div>

      {step === 1 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800">
            <Calendar size={18} /> Select date
          </h3>
          <div className="mb-6 flex flex-wrap gap-2">
            {dateOptions.map((d) => (
              <button
                key={d.dateStr}
                className={selectedDate === d.dateStr ? btnOutlineActive : btnOutline}
                onClick={() => { setSelectedDate(d.dateStr); setSelectedSlot(null); }}
              >
                {DAY_LABELS[d.dayName]}, {d.date.getDate()}/{d.date.getMonth() + 1}
              </button>
            ))}
          </div>

          {selectedDate && availability && (
            <>
              <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800">
                <Clock size={18} /> Select time slot ({SLOT_DURATION_MINUTES} min each)
              </h3>
              <div className="mb-6 flex flex-wrap gap-2">
                {availability.freeSlots.length === 0 ? (
                  <p className="text-sm text-slate-500">No free slots on this day</p>
                ) : (
                  splitIntoBookableSlots(availability.freeSlots).map((slot, i) => (
                    <button
                      key={i}
                      className={selectedSlot?.startTime === slot.startTime && selectedSlot?.endTime === slot.endTime ? btnOutlineActive : btnOutline}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button className={btnPrimary} disabled={!selectedSlot} onClick={() => setStep(2)}>
              Next: Add details
            </button>
          </div>
        </div>
      )}

      {step === 2 && selectedDateOption && selectedSlot && (
        <div>
          <div className="mb-6 rounded-lg bg-slate-50 p-4">
            <p className="text-sm"><strong>Date:</strong> {selectedDateOption.date.toLocaleDateString()}</p>
            <p className="mt-1 text-sm"><strong>Time:</strong> {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}</p>
            <p className="mt-1 text-sm"><strong>Lecturer:</strong> {lecturer.firstName} {lecturer.lastName}</p>
            {lecturer.office && (
              <p className="mt-1 text-sm"><strong>Meeting place:</strong> {lecturer.office.building}, Room {lecturer.office.roomNumber}</p>
            )}
          </div>
          <div className="mb-6">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Reason for meeting (optional)</label>
            <input
              type="text"
              placeholder="e.g. Course consultation, project discussion"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
            <label className="mb-2 block text-sm font-semibold text-slate-700">Additional notes (optional)</label>
            <textarea
              placeholder="Any specific topics or questions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div className="flex gap-3">
            <button className={btnSecondary} onClick={() => setStep(1)}>Back</button>
            <button className={btnPrimary} onClick={handleSubmit} disabled={submitting}>
              {submitting ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'Confirm booking'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
