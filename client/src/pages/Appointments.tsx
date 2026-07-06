import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/authStore';
import { showToast } from '@components/Toast';
import api, { showApiErrorToast } from '@services/api';
import Modal from '@components/Modal';
import { useMarkSectionReadOnVisit } from '@hooks/useMarkSectionReadOnVisit';
import {
  Calendar,
  Plus,
  User,
  Clock,
  Check,
  X,
  CalendarClock,
  MapPin,
  AlertCircle,
  Trash2,
  Building,
  KeyRound,
} from 'lucide-react';

interface Appointment {
  id: string;
  dateTime: string;
  duration: number;
  status: string;
  reason: string | null;
  rescheduledAt?: string | null;
  cancellationReason?: string | null;
  student?: { id: string; firstName: string; lastName: string };
  lecturer?: {
    id: string;
    firstName: string;
    lastName: string;
    department: { name: string } | null;
    lecturerOffice?: { roomNumber: string; building: string; floor: number };
  };
}

interface HallBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string | null;
  status: string;
  createdAt: string;
  doorPassword?: string | null;
  hall: { id: string; name: string; building: string; floor: number };
}

function formatDateTime(d: string): string {
  const dt = new Date(d);
  return dt.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatHallTime(t: string): string {
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  const suffix = hr >= 12 ? 'PM' : 'AM';
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${display}:${m} ${suffix}`;
}

export default function Appointments() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Appointment | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState('');
  const [rescheduleDuration, setRescheduleDuration] = useState(30);
  const [rescheduling, setRescheduling] = useState(false);
  const [hallBookings, setHallBookings] = useState<HallBooking[]>([]);
  const [hallCancelTarget, setHallCancelTarget] = useState<HallBooking | null>(null);
  const [hallCancelReason, setHallCancelReason] = useState('');
  const [hallCancelling, setHallCancelling] = useState(false);

  const isStudent = user?.role === 'STUDENT';
  const isLecturer = user?.role === 'LECTURER';
  useMarkSectionReadOnVisit(user?.role, '/appointments');

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/appointments', { params });
      setAppointments(res.data.data || []);
    } catch (err) {
      showApiErrorToast(err, 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchHallBookings = useCallback(async () => {
    if (!isStudent) return;
    try {
      const res = await api.get('/halls/bookings');
      setHallBookings(res.data.data || []);
    } catch {
      /* ignore */
    }
  }, [isStudent]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);
  useEffect(() => { fetchHallBookings(); }, [fetchHallBookings]);

  const handleAccept = async (a: Appointment) => {
    try {
      await api.patch(`/appointments/${a.id}/accept`);
      showToast('success', 'Appointment accepted');
      window.dispatchEvent(new CustomEvent('appointments-updated'));
      fetchAppointments();
    } catch (err: any) {
      showApiErrorToast(err, 'Failed to accept');
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      await api.patch(`/appointments/${rejectTarget.id}/reject`, { reason: rejectReason });
      showToast('success', 'Appointment rejected');
      setRejectTarget(null);
      setRejectReason('');
      window.dispatchEvent(new CustomEvent('appointments-updated'));
      fetchAppointments();
    } catch (err: any) {
      showApiErrorToast(err, 'Failed to reject');
    } finally {
      setRejecting(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleTarget || !rescheduleDateTime) return;
    try {
      setRescheduling(true);
      await api.patch(`/appointments/${rescheduleTarget.id}/reschedule`, {
        dateTime: new Date(rescheduleDateTime).toISOString(),
        duration: rescheduleDuration,
      });
      showToast('success', 'Reschedule proposed');
      setRescheduleTarget(null);
      setRescheduleDateTime('');
      window.dispatchEvent(new CustomEvent('appointments-updated'));
      fetchAppointments();
    } catch (err: any) {
      showApiErrorToast(err, 'Failed to reschedule');
    } finally {
      setRescheduling(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    const isPending = cancelTarget.status === 'PENDING';
    if (isPending && !cancelReason.trim()) {
      showToast('error', 'Please provide a reason for cancelling');
      return;
    }
    if (!isPending && cancelReason.trim().length < 10) {
      showToast('error', 'Please provide a valid reason (at least 10 characters)');
      return;
    }
    try {
      setCancelling(true);
      if (isPending) {
        await api.delete(`/appointments/${cancelTarget.id}`, { data: { reason: cancelReason.trim() } });
        showToast('success', 'Appointment cancelled');
      } else {
        await api.patch(`/appointments/${cancelTarget.id}/request-cancellation`, { reason: cancelReason.trim() });
        showToast('success', 'Cancellation requested. Waiting for lecturer approval.');
      }
      setCancelTarget(null);
      setCancelReason('');
      window.dispatchEvent(new CustomEvent('appointments-updated'));
      fetchAppointments();
    } catch (err: any) {
      showApiErrorToast(err, 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  const handleAcceptCancellation = async (a: Appointment) => {
    try {
      await api.patch(`/appointments/${a.id}/accept-cancellation`);
      showToast('success', 'Cancellation approved');
      window.dispatchEvent(new CustomEvent('appointments-updated'));
      fetchAppointments();
    } catch (err: any) {
      showApiErrorToast(err, 'Failed to approve');
    }
  };

  const handleRejectCancellation = async (a: Appointment) => {
    try {
      await api.patch(`/appointments/${a.id}/reject-cancellation`);
      showToast('success', 'Cancellation rejected. Appointment remains confirmed.');
      window.dispatchEvent(new CustomEvent('appointments-updated'));
      fetchAppointments();
    } catch (err: any) {
      showApiErrorToast(err, 'Failed to reject');
    }
  };

  const handleRemove = async (a: Appointment) => {
    try {
      await api.delete(`/appointments/${a.id}/remove`);
      showToast('success', 'Appointment removed');
      window.dispatchEvent(new CustomEvent('appointments-updated'));
      fetchAppointments();
    } catch (err: any) {
      showApiErrorToast(err, 'Failed to remove');
    }
  };

  const pending = appointments.filter((a) => a.status === 'PENDING' || a.status === 'PENDING_ADMIN');
  const cancellationRequests = appointments.filter((a) => a.status === 'CANCELLATION_REQUESTED');
  const rescheduledCount = appointments.filter(
    (a) => a.rescheduledAt && a.status === 'PENDING'
  ).length;
  const upcomingAccepted = appointments.filter(
    (a) => ['ACCEPTED', 'SCHEDULED'].includes(a.status) && new Date(a.dateTime) >= new Date()
  );
  const studentMyAppointments = appointments.filter((a) =>
    ['PENDING', 'PENDING_ADMIN', 'ACCEPTED', 'SCHEDULED', 'CANCELLATION_REQUESTED'].includes(a.status)
  );
  const otherAppointments = appointments.filter(
    (a) => !['PENDING', 'PENDING_ADMIN', 'ACCEPTED', 'SCHEDULED', 'CANCELLATION_REQUESTED'].includes(a.status) ||
      (['ACCEPTED', 'SCHEDULED'].includes(a.status) && new Date(a.dateTime) < new Date())
  );

  const handleConfirmReschedule = async (a: Appointment) => {
    try {
      await api.patch(`/appointments/${a.id}/confirm-reschedule`);
      showToast('success', 'You confirmed the new time. Lecturer has been notified.');
      window.dispatchEvent(new CustomEvent('appointments-updated'));
      fetchAppointments();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to confirm');
    }
  };

  const handleCancelHall = async () => {
    if (!hallCancelTarget) return;
    try {
      setHallCancelling(true);
      await api.patch(`/halls/bookings/${hallCancelTarget.id}/cancel`, {
        reason: hallCancelReason.trim() || undefined,
      });
      showToast('success', 'Hall booking cancelled');
      setHallCancelTarget(null);
      setHallCancelReason('');
      window.dispatchEvent(new CustomEvent('appointments-updated'));
      fetchHallBookings();
    } catch (err: any) {
      showApiErrorToast(err, 'Failed to cancel');
    } finally {
      setHallCancelling(false);
    }
  };

  const statusBadge = (s: string) => {
    const cls =
      s === 'PENDING' || s === 'PENDING_ADMIN' || s === 'CANCELLATION_REQUESTED'
        ? 'bg-amber-100 text-amber-800'
        : s === 'ACCEPTED' || s === 'SCHEDULED'
          ? 'bg-emerald-100 text-emerald-800'
          : s === 'REJECTED' || s === 'CANCELLED'
            ? 'bg-red-100 text-red-800'
            : 'bg-slate-200 text-slate-600';
    const label = s === 'PENDING_ADMIN' ? 'Awaiting lecturer' : s.replace(/_/g, ' ');
    return (
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${cls}`}>
        {label}
      </span>
    );
  };

  const btn = 'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors';
  const btnPrimary = `${btn} text-white [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]`;
  const btnSuccess = `${btn} bg-emerald-500 text-white hover:bg-emerald-600`;
  const btnDanger = `${btn} bg-red-500 text-white hover:bg-red-600`;
  const btnOutline = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
  const btnSecondary = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Appointments</h1>
          <p className="mt-0.5 w-full text-slate-500">
            {isStudent ? 'Manage your appointments and book new ones' : 'Manage incoming requests and your schedule'}
          </p>
        </div>
        {isStudent && (
          <div className="flex flex-wrap gap-2">
            <button className={btnPrimary} onClick={() => navigate('/lecturers')}>
              <Plus size={18} /> Book new appointment
            </button>
            <button className={btnOutline} onClick={() => navigate('/halls/availability')}>
              <Building size={18} /> Book halls
            </button>
          </div>
        )}
      </div>

      {isStudent && rescheduledCount > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-amber-400 bg-amber-50 px-5 py-4 text-amber-800">
          <AlertCircle size={20} />
          <span>
            <strong>{rescheduledCount} appointment{rescheduledCount !== 1 ? 's' : ''} rescheduled.</strong>{' '}
            The lecturer proposed a new time - please check the dates below.
          </span>
        </div>
      )}

      <div className="mb-5">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Awaiting lecturer</option>
          <option value="PENDING">Pending</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLATION_REQUESTED">Cancellation requested</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-slate-500">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-primary)]" />
          <p>Loading appointments...</p>
        </div>
      ) : appointments.length === 0 && (!isStudent || hallBookings.length === 0) ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-slate-500">
          <Calendar size={48} strokeWidth={1} />
          <h3 className="text-lg font-semibold text-slate-700">No appointments yet</h3>
          {isStudent ? (
            <p>Browse lecturers and book your first appointment.</p>
          ) : (
            <p>Incoming requests will appear here.</p>
          )}
        </div>
      ) : (
        <div>
          {isStudent && hallBookings.filter((h) => ['PENDING', 'APPROVED'].includes(h.status)).length > 0 && (
            <section className="mb-8">
              <h3 className="mb-3 text-base font-semibold text-slate-700">My hall bookings</h3>
              <p className="mb-3 text-sm text-slate-500">
                Hall booking confirmations appear here. When admin approves, you will see the door password.
              </p>
              {hallBookings
                .filter((h) => ['PENDING', 'APPROVED'].includes(h.status))
                .map((h) => (
                  <div
                    key={h.id}
                    className={`mb-3 rounded-lg border bg-white p-4 shadow-sm ${
                      h.status === 'APPROVED' ? 'border-l-4 border-emerald-500' : 'border-l-4 border-amber-500 border-slate-100'
                    }`}
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <Building size={16} />
                          {h.hall.name}
                        </span>
                        <span className="mt-1 block text-sm text-slate-600">
                          <MapPin size={14} className="inline" /> {h.hall.building}, Floor {h.hall.floor}
                        </span>
                        <span className="mt-1 block text-sm text-slate-600">
                          <Clock size={14} className="inline" />{' '}
                          {new Date(h.date).toLocaleDateString()} • {formatHallTime(h.startTime)} - {formatHallTime(h.endTime)}
                        </span>
                        <span className="mt-1 block text-xs text-slate-400">
                          Submitted {formatDateTime(h.createdAt)}
                        </span>
                        {h.reason && <p className="mt-2 text-sm text-slate-600">{h.reason}</p>}
                        {h.status === 'APPROVED' && h.doorPassword && (
                          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm">
                            <KeyRound size={16} className="text-emerald-600" />
                            <span>
                              <strong>Door password:</strong> <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono">{h.doorPassword}</code>
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="shrink-0">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                            h.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {h.status === 'PENDING' ? 'Awaiting approval' : 'Approved'}
                        </span>
                      </div>
                    </div>
                    {['PENDING', 'APPROVED'].includes(h.status) && (
                      <div className="mt-3">
                        <button className={btnDanger} onClick={() => setHallCancelTarget(h)}>
                          <X size={14} /> Cancel hall booking
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </section>
          )}

          {isLecturer && cancellationRequests.length > 0 && (
            <section className="mb-8">
              <h3 className="mb-1 text-base font-semibold text-slate-700">Cancellation requests</h3>
              <p className="mb-3 text-sm text-slate-500">Students requested to cancel. Approve or reject.</p>
              {cancellationRequests.map((a) => (
                <div key={a.id} className="mb-3 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <User size={16} />
                        {a.student?.firstName} {a.student?.lastName}
                      </span>
                      <span className="mt-1 block text-sm text-slate-600">
                        <Clock size={14} className="inline" /> {formatDateTime(a.dateTime)} ({a.duration} min)
                      </span>
                      {a.cancellationReason && (
                        <p className="mt-2 text-sm text-slate-600"><strong>Reason:</strong> {a.cancellationReason}</p>
                      )}
                    </div>
                    <div className="shrink-0">{statusBadge(a.status)}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className={btnSuccess} onClick={() => handleAcceptCancellation(a)}>
                      <Check size={14} /> Accept cancellation
                    </button>
                    <button className={btnOutline} onClick={() => handleRejectCancellation(a)}>
                      <X size={14} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {isLecturer && pending.length > 0 && (
            <section className="mb-8">
              <h3 className="mb-3 text-base font-semibold text-slate-700">Incoming requests</h3>
              {pending.map((a) => (
                <div key={a.id} className="mb-3 rounded-lg border-l-4 border-amber-500 border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <User size={16} />
                        {a.student?.firstName} {a.student?.lastName}
                      </span>
                      <span className="mt-1 block text-sm text-slate-600">
                        <Clock size={14} className="inline" /> {formatDateTime(a.dateTime)}
                      </span>
                      {a.reason && <p className="mt-2 text-sm text-slate-600">{a.reason}</p>}
                    </div>
                    <div className="shrink-0">{statusBadge(a.status)}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!a.rescheduledAt && (
                      <>
                        <button className={btnSuccess} onClick={() => handleAccept(a)}>
                          <Check size={14} /> Accept
                        </button>
                        <button className={btnDanger} onClick={() => setRejectTarget(a)}>
                          <X size={14} /> Reject
                        </button>
                      </>
                    )}
                    <button className={btnOutline} onClick={() => setRescheduleTarget(a)}>
                      <CalendarClock size={14} /> {a.rescheduledAt ? 'Propose another time' : 'Reschedule'}
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="mb-8">
            <h3 className="mb-3 text-base font-semibold text-slate-700">{isLecturer ? 'Upcoming accepted' : 'My appointments'}</h3>
            {(isLecturer ? upcomingAccepted : studentMyAppointments).map((a) => (
              <div key={a.id} className={`mb-3 rounded-lg border bg-white p-4 shadow-sm ${a.rescheduledAt ? 'border-l-4 border-amber-500' : 'border-slate-100'}`}>
                {isStudent && a.rescheduledAt && a.status === 'PENDING' && (
                  <div className="mb-2 inline-flex items-center gap-1.5 rounded bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-800">
                    <AlertCircle size={14} /> Rescheduled - new time below. Please confirm.
                  </div>
                )}
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <User size={16} />
                      {isStudent ? `${a.lecturer?.firstName} ${a.lecturer?.lastName}` : `${a.student?.firstName} ${a.student?.lastName}`}
                      {a.lecturer?.department && (
                        <span className="font-normal text-slate-500"> ({a.lecturer.department.name})</span>
                      )}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600">
                      <Clock size={14} className="inline" /> {formatDateTime(a.dateTime)} ({a.duration} min)
                    </span>
                    {isStudent && a.lecturer?.lecturerOffice && (
                      <span className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-primary)]">
                        <MapPin size={14} /> Meet at {a.lecturer.lecturerOffice.building}, Room {a.lecturer.lecturerOffice.roomNumber}
                      </span>
                    )}
                    {a.reason && <p className="mt-2 text-sm text-slate-600">{a.reason}</p>}
                    {isStudent && a.cancellationReason && a.status === 'CANCELLATION_REQUESTED' && (
                      <p className="mt-2 text-sm text-slate-600"><strong>Your reason:</strong> {a.cancellationReason}</p>
                    )}
                  </div>
                  <div className="shrink-0">{statusBadge(a.status)}</div>
                </div>
                {['PENDING', 'ACCEPTED', 'SCHEDULED', 'CANCELLATION_REQUESTED'].includes(a.status) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isStudent && a.rescheduledAt && a.status === 'PENDING' && (
                      <button className={btnSuccess} onClick={() => handleConfirmReschedule(a)}>
                        <Check size={14} /> OK - Confirm new time
                      </button>
                    )}
                    {isStudent && a.status === 'CANCELLATION_REQUESTED' && (
                      <span className="text-sm text-slate-500">Waiting for lecturer to approve cancellation</span>
                    )}
                    {isStudent && ['PENDING', 'PENDING_ADMIN', 'ACCEPTED', 'SCHEDULED'].includes(a.status) && (
                      <button className={btnDanger} onClick={() => setCancelTarget(a)}>
                        {a.status === 'PENDING' ? 'Cancel' : 'Request cancellation'}
                      </button>
                    )}
                    {isLecturer && (a.status === 'ACCEPTED' || a.status === 'SCHEDULED') && (
                      <button className={btnOutline} onClick={() => setRescheduleTarget(a)}>Reschedule</button>
                    )}
                    {isLecturer && a.status === 'PENDING' && (
                      <>
                        {!a.rescheduledAt && (
                          <>
                            <button className={btnSuccess} onClick={() => handleAccept(a)}>Accept</button>
                            <button className={btnDanger} onClick={() => setRejectTarget(a)}>Reject</button>
                          </>
                        )}
                        <button className={btnOutline} onClick={() => setRescheduleTarget(a)}>
                          {a.rescheduledAt ? 'Propose another time' : 'Reschedule'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </section>

          {otherAppointments.length > 0 && (
            <section className="mb-8">
              <h3 className="mb-3 text-base font-semibold text-slate-700">Past / Other</h3>
              {otherAppointments.map((a) => (
                <div key={a.id} className="mb-3 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <User size={16} />
                        {isStudent ? `${a.lecturer?.firstName} ${a.lecturer?.lastName}` : `${a.student?.firstName} ${a.student?.lastName}`}
                        {a.lecturer?.department && (
                          <span className="font-normal text-slate-500"> ({a.lecturer.department.name})</span>
                        )}
                      </span>
                      <span className="mt-1 block text-sm text-slate-600">
                        <Clock size={14} className="inline" /> {formatDateTime(a.dateTime)}
                      </span>
                      {isStudent && a.lecturer?.lecturerOffice && (
                        <span className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                          <MapPin size={14} /> {a.lecturer.lecturerOffice.building}, Room {a.lecturer.lecturerOffice.roomNumber}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {statusBadge(a.status)}
                      {['CANCELLED', 'REJECTED', 'COMPLETED'].includes(a.status) && (
                        <button
                          type="button"
                          onClick={() => handleRemove(a)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-red-600"
                          title="Remove from list"
                        >
                          <Trash2 size={14} /> Close
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject appointment" width="400px">
        <p className="mb-2">Add a reason (optional):</p>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Reason for rejection..."
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
        <div className="mt-4 flex justify-end gap-3">
          <button className={btnSecondary} onClick={() => setRejectTarget(null)}>Cancel</button>
          <button className={btnDanger} onClick={() => { setRejecting(true); handleReject(); }}>
            {rejecting ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'Reject'}
          </button>
        </div>
      </Modal>

      <Modal open={!!rescheduleTarget} onClose={() => setRescheduleTarget(null)} title="Propose reschedule" width="400px">
        <label className="mb-2 block text-sm font-semibold text-slate-700">New date & time</label>
        <input
          type="datetime-local"
          value={rescheduleDateTime}
          onChange={(e) => setRescheduleDateTime(e.target.value)}
          min={new Date().toISOString().slice(0, 16)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
        <label className="mb-2 block text-sm font-semibold text-slate-700">Duration (minutes)</label>
        <input
          type="number"
          min={15}
          max={120}
          value={rescheduleDuration}
          onChange={(e) => setRescheduleDuration(parseInt(e.target.value) || 30)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
        <div className="flex justify-end gap-3">
          <button className={btnSecondary} onClick={() => setRescheduleTarget(null)}>Cancel</button>
          <button className={btnPrimary} onClick={handleReschedule} disabled={!rescheduleDateTime}>
            {rescheduling ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'Propose'}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!hallCancelTarget}
        onClose={() => { setHallCancelTarget(null); setHallCancelReason(''); }}
        title="Cancel hall booking"
        width="420px"
      >
        {hallCancelTarget && (
          <>
            <p className="mb-4">
              Cancel your hall booking of {hallCancelTarget.hall.name} on{' '}
              {new Date(hallCancelTarget.date).toLocaleDateString()} at{' '}
              {formatHallTime(hallCancelTarget.startTime)}-{formatHallTime(hallCancelTarget.endTime)}?
            </p>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Reason (optional)</label>
            <textarea
              value={hallCancelReason}
              onChange={(e) => setHallCancelReason(e.target.value)}
              placeholder="e.g. No longer needed for the meeting..."
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button className={btnSecondary} onClick={() => { setHallCancelTarget(null); setHallCancelReason(''); }}>
                Keep booking
              </button>
              <button className={btnDanger} onClick={handleCancelHall} disabled={hallCancelling}>
                {hallCancelling ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'Cancel hall booking'}
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={!!cancelTarget}
        onClose={() => { setCancelTarget(null); setCancelReason(''); }}
        title={cancelTarget?.status === 'PENDING' ? 'Cancel appointment' : 'Request cancellation'}
        width="420px"
      >
        {cancelTarget && (
          <>
            <p className="mb-4">
              {cancelTarget.status === 'PENDING'
                ? `Cancel your appointment on ${formatDateTime(cancelTarget.dateTime)}? Please provide a reason (required).`
                : `Request to cancel your appointment on ${formatDateTime(cancelTarget.dateTime)}. Your reason will be sent to the lecturer, who must approve.`}
            </p>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Reason for cancellation (required)</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={
                cancelTarget.status === 'PENDING'
                  ? 'e.g. Schedule conflict, no longer needed...'
                  : 'Provide a valid reason for the lecturer (min 10 characters)...'
              }
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-3">
              <button className={btnSecondary} onClick={() => { setCancelTarget(null); setCancelReason(''); }}>
                Keep appointment
              </button>
              <button
                className={btnDanger}
                onClick={handleCancel}
                disabled={
                  cancelling ||
                  !cancelReason.trim() ||
                  (cancelTarget.status !== 'PENDING' && cancelReason.trim().length < 10)
                }
              >
                {cancelling ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : cancelTarget.status === 'PENDING' ? 'Cancel appointment' : 'Request cancellation'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
