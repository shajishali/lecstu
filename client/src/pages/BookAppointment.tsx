import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  SATURDAY: 'Sat', SUNDAY: 'Sun',
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

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dayNameFromDateStr(dateStr: string): string {
  const map = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return map[parseLocalDate(dateStr).getDay()] || 'MONDAY';
}

/** Parse chat-style dates; prefer DMY when ambiguous. */
function parseLooseDateToIso(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const dt = parseLocalDate(s);
    if (
      dt.getFullYear() === Number(s.slice(0, 4))
      && dt.getMonth() + 1 === Number(s.slice(5, 7))
      && dt.getDate() === Number(s.slice(8, 10))
    ) {
      return s;
    }
    return null;
  }
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!m) return null;
  let a = parseInt(m[1], 10);
  let b = parseInt(m[2], 10);
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  const valid = (mo: number, day: number) => {
    const dt = new Date(y, mo - 1, day);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === day;
  };
  const dmyOk = b >= 1 && b <= 12 && a >= 1 && a <= 31 && valid(b, a);
  const mdyOk = a >= 1 && a <= 12 && b >= 1 && b <= 31 && valid(a, b);
  if (dmyOk && !mdyOk) return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
  if (mdyOk && !dmyOk) return `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
  if (dmyOk && mdyOk) return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
  return null;
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
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i <= 21; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dayNum = d.getDay();
    if (dayNum >= 1 && dayNum <= 5) {
      const dayName = ['', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'][dayNum];
      result.push({
        date: d,
        dateStr: toLocalDateString(d),
        dayName,
      });
    }
  }
  return result;
}

function ensureDateOption(
  options: { date: Date; dateStr: string; dayName: string }[],
  dateStr: string
): { date: Date; dateStr: string; dayName: string }[] {
  if (options.some((o) => o.dateStr === dateStr)) return options;
  const date = parseLocalDate(dateStr);
  return [
    ...options,
    { date, dateStr, dayName: dayNameFromDateStr(dateStr) },
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export default function BookAppointment() {
  const { lecturerId } = useParams<{ lecturerId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lastDeepLinkKey = useRef('');

  const [step, setStep] = useState(1);
  const [lecturer, setLecturer] = useState<LecturerInfo | null>(null);
  const [dateOptions, setDateOptions] = useState(getNextWeekdays);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availability, setAvailability] = useState<DayAvailability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<FreeSlot | null>(null);
  const [pendingStartTime, setPendingStartTime] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fromChatbot, setFromChatbot] = useState(false);

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

  // Deep link from chatbot: prefill date/time whenever URL query changes
  useEffect(() => {
    let qDate = searchParams.get('date');
    const qFrom = searchParams.get('startTime') || searchParams.get('time') || searchParams.get('from');
    const qTo = searchParams.get('endTime') || searchParams.get('to');
    if (!qDate && !qFrom && !qTo) return;

    const linkKey = `${lecturerId || ''}?${searchParams.toString()}`;
    if (linkKey === lastDeepLinkKey.current) return;
    lastDeepLinkKey.current = linkKey;

    if (qDate && !/^\d{4}-\d{2}-\d{2}$/.test(qDate)) {
      qDate = parseLooseDateToIso(qDate);
    }

    setFromChatbot(true);
    setStep(1);
    setSelectedSlot(null);

    if (qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate)) {
      setDateOptions((prev) => ensureDateOption(prev.length ? prev : getNextWeekdays(), qDate!));
      setSelectedDate(qDate);
    } else {
      setSelectedDate(null);
    }

    setPendingStartTime(qFrom || null);
  }, [searchParams, lecturerId]);

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

  // After free slots load, auto-select the chatbot time if it matches a bookable slot
  useEffect(() => {
    if (!availability || !pendingStartTime) return;
    const slots = splitIntoBookableSlots(availability.freeSlots || []);
    const want = pendingStartTime.slice(0, 5);
    const match =
      slots.find((s) => s.startTime === want)
      || slots.find((s) => timeToMinutes(s.startTime) === timeToMinutes(want));
    if (match) {
      setSelectedSlot(match);
    }
    setPendingStartTime(null);
  }, [availability, pendingStartTime]);

  const handleSubmit = async () => {
    if (!lecturerId || !selectedDate || !selectedSlot) return;
    setSubmitting(true);
    try {
      const [h, m] = selectedSlot.startTime.split(':').map(Number);
      const dateTime = parseLocalDate(selectedDate);
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
        {fromChatbot && (
          <p className="mt-2 text-sm text-slate-600">
            Filled in from chat. Check the date and time, then book.
          </p>
        )}
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
                type="button"
                className={selectedDate === d.dateStr ? btnOutlineActive : btnOutline}
                onClick={() => { setSelectedDate(d.dateStr); setSelectedSlot(null); }}
              >
                {DAY_LABELS[d.dayName] || d.dayName}, {d.date.getDate()}/{d.date.getMonth() + 1}
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
                      type="button"
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
