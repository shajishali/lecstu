import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { showApiErrorToast } from '@services/api';
import { useAuthStore } from '@store/authStore';
import { useMarkSectionReadOnVisit } from '@hooks/useMarkSectionReadOnVisit';
import { showToast } from '@components/Toast';
import Modal from '@components/Modal';
import {
  Building,
  Check,
  X,
  Loader2,
  Inbox,
  KeyRound,
  Clock,
  User,
  Calendar,
  CalendarClock,
  AlertCircle,
} from 'lucide-react';

interface HallBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string | null;
  status: string;
  doorPassword?: string | null;
  createdAt: string;
  student: { id: string; firstName: string; lastName: string; email: string };
  hall: { id: string; name: string; building: string; floor: number };
}

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
  };
}

function formatTime(t: string): string {
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  const suffix = hr >= 12 ? 'PM' : 'AM';
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${display}:${m} ${suffix}`;
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatSubmittedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function isBookingDatePast(date: string): boolean {
  const bookingDate = new Date(date);
  bookingDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return bookingDate < today;
}

function statusBadge(s: string) {
  const cls =
    s === 'PENDING' || s === 'PENDING_ADMIN' || s === 'CANCELLATION_REQUESTED'
      ? 'bg-amber-100 text-amber-800'
      : s === 'APPROVED' || s === 'ACCEPTED' || s === 'SCHEDULED'
        ? 'bg-emerald-100 text-emerald-800'
        : s === 'REJECTED' || s === 'CANCELLED'
          ? 'bg-red-100 text-red-800'
          : 'bg-slate-200 text-slate-600';
  const labels: Record<string, string> = {
    PENDING: 'Awaiting approval',
    PENDING_ADMIN: 'Awaiting lecturer',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CANCELLATION_REQUESTED: 'Cancellation requested',
  };
  const label = labels[s] || s.replace(/_/g, ' ');
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-slate-50 py-16 text-slate-500">
      <Inbox size={48} strokeWidth={1.5} />
      <h3 className="text-lg font-medium text-slate-700">{title}</h3>
      <p className="max-w-md text-center">{description}</p>
    </div>
  );
}

function HallBookingCard({
  booking,
  showStudent,
  actions,
}: {
  booking: HallBooking;
  showStudent?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-4">
        <div>
          <p className="font-medium text-slate-800">{booking.hall.name}</p>
          <p className="text-sm text-slate-500">
            {booking.hall.building}, Floor {booking.hall.floor}
          </p>
        </div>
        <div className="border-l border-slate-200 pl-4">
          <p className="text-sm font-medium text-slate-700">
            {new Date(booking.date).toLocaleDateString()} • {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
            <Clock size={12} />
            Submitted {formatSubmittedAt(booking.createdAt)}
          </p>
          {showStudent && (
            <p className="mt-1 text-sm text-slate-500">
              Requested by {booking.student.firstName} {booking.student.lastName}
            </p>
          )}
          {booking.status === 'PENDING' && isBookingDatePast(booking.date) && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              Booking date has passed — review only if access is still needed.
            </p>
          )}
          {booking.reason && <p className="mt-1 text-sm text-slate-600">Reason: {booking.reason}</p>}
          {booking.status === 'APPROVED' && booking.doorPassword && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm">
              <KeyRound size={16} className="text-emerald-600" />
              <span>
                <strong>Door password:</strong>{' '}
                <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono">{booking.doorPassword}</code>
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {statusBadge(booking.status)}
        {actions}
      </div>
    </div>
  );
}

function AdminApprovalsView() {
  const [hallBookings, setHallBookings] = useState<HallBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [approveModal, setApproveModal] = useState<HallBooking | null>(null);
  const [doorPassword, setDoorPassword] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/halls/bookings', { params: { status: 'PENDING' } });
      setHallBookings(res.data.data || []);
    } catch (err) {
      showApiErrorToast(err, 'Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApproveHall = async () => {
    if (!approveModal || !doorPassword.trim()) {
      showToast('error', 'Please enter the door password');
      return;
    }
    setActioning(`hall-${approveModal.id}`);
    try {
      await api.patch(`/halls/bookings/${approveModal.id}/approve`, {
        doorPassword: doorPassword.trim(),
      });
      showToast('success', 'Hall booking approved');
      setApproveModal(null);
      setDoorPassword('');
      fetchData();
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      window.dispatchEvent(new CustomEvent('approvals-updated'));
    } catch (err) {
      showApiErrorToast(err, 'Failed to approve');
    } finally {
      setActioning(null);
    }
  };

  const handleRejectHall = async (id: string) => {
    setActioning(`hall-reject-${id}`);
    try {
      await api.patch(`/halls/bookings/${id}/reject`);
      showToast('success', 'Hall booking rejected');
      fetchData();
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      window.dispatchEvent(new CustomEvent('approvals-updated'));
    } catch (err) {
      showApiErrorToast(err, 'Failed to reject');
    } finally {
      setActioning(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-slate-500">
        <Loader2 size={32} className="animate-spin" />
        <p>Loading pending approvals...</p>
      </div>
    );
  }

  if (hallBookings.length === 0) {
    return (
      <EmptyState
        title="No pending approvals"
        description="Hall booking requests from students will appear here for your review."
      />
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
        <Building size={20} />
        Hall booking requests ({hallBookings.length})
      </h2>
      {hallBookings.map((b) => (
        <HallBookingCard
          key={b.id}
          booking={b}
          showStudent
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  setApproveModal(b);
                  setDoorPassword('');
                }}
                disabled={!!actioning}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Check size={16} />
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleRejectHall(b.id)}
                disabled={!!actioning}
                className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {actioning === `hall-reject-${b.id}` ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                Reject
              </button>
            </>
          }
        />
      ))}

      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setApproveModal(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Approve hall booking</h3>
            <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
              <p><strong>{approveModal.hall.name}</strong> — {approveModal.hall.building}</p>
              <p className="mt-1 text-slate-600">
                {new Date(approveModal.date).toLocaleDateString()} • {formatTime(approveModal.startTime)} - {formatTime(approveModal.endTime)}
              </p>
              <p className="mt-1 text-slate-500">
                Student: {approveModal.student.firstName} {approveModal.student.lastName}
              </p>
            </div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <KeyRound size={16} /> Door password (required)
            </label>
            <input
              type="text"
              value={doorPassword}
              onChange={(e) => setDoorPassword(e.target.value)}
              placeholder="Enter password for automated door"
              className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setApproveModal(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveHall}
                disabled={!doorPassword.trim() || !!actioning}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {actioning ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Approve & send
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StudentApprovalsView() {
  const navigate = useNavigate();
  const [hallBookings, setHallBookings] = useState<HallBooking[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [hallRes, apptRes] = await Promise.all([
        api.get('/halls/bookings'),
        api.get('/appointments', { params: { status: 'PENDING,PENDING_ADMIN' } }),
      ]);
      setHallBookings(hallRes.data.data || []);
      setAppointments(apptRes.data.data || []);
    } catch (err) {
      showApiErrorToast(err, 'Failed to load your approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-slate-500">
        <Loader2 size={32} className="animate-spin" />
        <p>Loading your approval requests...</p>
      </div>
    );
  }

  const pendingHalls = hallBookings.filter((b) => b.status === 'PENDING');
  const approvedHalls = hallBookings.filter((b) => b.status === 'APPROVED');
  const rejectedHalls = hallBookings.filter((b) => b.status === 'REJECTED');
  const hasAny = pendingHalls.length > 0 || approvedHalls.length > 0 || rejectedHalls.length > 0 || appointments.length > 0;

  if (!hasAny) {
    return (
      <EmptyState
        title="No approval requests yet"
        description="Hall bookings and lecturer appointments awaiting approval will appear here with full details."
      />
    );
  }

  return (
    <div className="space-y-8">
      {pendingHalls.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
            <Building size={20} />
            Hall bookings awaiting admin ({pendingHalls.length})
          </h2>
          <div className="space-y-3">
            {pendingHalls.map((b) => (
              <HallBookingCard key={b.id} booking={b} />
            ))}
          </div>
        </section>
      )}

      {approvedHalls.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
            <Check size={20} className="text-emerald-600" />
            Approved hall bookings ({approvedHalls.length})
          </h2>
          <div className="space-y-3">
            {approvedHalls.map((b) => (
              <HallBookingCard key={b.id} booking={b} />
            ))}
          </div>
        </section>
      )}

      {rejectedHalls.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
            <X size={20} className="text-red-500" />
            Rejected hall bookings ({rejectedHalls.length})
          </h2>
          <div className="space-y-3">
            {rejectedHalls.map((b) => (
              <HallBookingCard key={b.id} booking={b} />
            ))}
          </div>
        </section>
      )}

      {appointments.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
            <Calendar size={20} />
            Appointments awaiting lecturer ({appointments.length})
          </h2>
          <div className="space-y-3">
            {appointments.map((a) => (
              <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">
                      {a.lecturer?.firstName} {a.lecturer?.lastName}
                      {a.lecturer?.department && (
                        <span className="font-normal text-slate-500"> · {a.lecturer.department.name}</span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      <Clock size={14} className="inline" /> {formatDateTime(a.dateTime)} ({a.duration} min)
                    </p>
                    {a.reason && <p className="mt-2 text-sm text-slate-600">Reason: {a.reason}</p>}
                    {a.rescheduledAt && (
                      <p className="mt-2 flex items-center gap-1 text-sm font-medium text-amber-700">
                        <AlertCircle size={14} /> Lecturer proposed a new time — confirm on Appointments
                      </p>
                    )}
                  </div>
                  {statusBadge(a.status)}
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/appointments')}
                  className="mt-3 text-sm font-medium text-[var(--color-primary)] hover:underline"
                >
                  View in Appointments →
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function LecturerApprovalsView() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<Appointment | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState('');
  const [rescheduleDuration, setRescheduleDuration] = useState(30);
  const [rescheduling, setRescheduling] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/appointments');
      setAppointments(res.data.data || []);
    } catch (err) {
      showApiErrorToast(err, 'Failed to load approval requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pending = appointments.filter((a) => a.status === 'PENDING' || a.status === 'PENDING_ADMIN');
  const cancellationRequests = appointments.filter((a) => a.status === 'CANCELLATION_REQUESTED');

  const handleAccept = async (a: Appointment) => {
    try {
      await api.patch(`/appointments/${a.id}/accept`);
      showToast('success', 'Appointment accepted');
      window.dispatchEvent(new CustomEvent('appointments-updated'));
      fetchData();
    } catch (err) {
      showApiErrorToast(err, 'Failed to accept');
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await api.patch(`/appointments/${rejectTarget.id}/reject`, { reason: rejectReason });
      showToast('success', 'Appointment rejected');
      setRejectTarget(null);
      setRejectReason('');
      window.dispatchEvent(new CustomEvent('appointments-updated'));
      fetchData();
    } catch (err) {
      showApiErrorToast(err, 'Failed to reject');
    } finally {
      setRejecting(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleTarget || !rescheduleDateTime) return;
    setRescheduling(true);
    try {
      await api.patch(`/appointments/${rescheduleTarget.id}/reschedule`, {
        dateTime: new Date(rescheduleDateTime).toISOString(),
        duration: rescheduleDuration,
      });
      showToast('success', 'Reschedule proposed');
      setRescheduleTarget(null);
      setRescheduleDateTime('');
      window.dispatchEvent(new CustomEvent('appointments-updated'));
      fetchData();
    } catch (err) {
      showApiErrorToast(err, 'Failed to reschedule');
    } finally {
      setRescheduling(false);
    }
  };

  const handleAcceptCancellation = async (a: Appointment) => {
    try {
      await api.patch(`/appointments/${a.id}/accept-cancellation`);
      showToast('success', 'Cancellation approved');
      window.dispatchEvent(new CustomEvent('appointments-updated'));
      fetchData();
    } catch (err) {
      showApiErrorToast(err, 'Failed to approve');
    }
  };

  const handleRejectCancellation = async (a: Appointment) => {
    try {
      await api.patch(`/appointments/${a.id}/reject-cancellation`);
      showToast('success', 'Cancellation rejected');
      window.dispatchEvent(new CustomEvent('appointments-updated'));
      fetchData();
    } catch (err) {
      showApiErrorToast(err, 'Failed to reject');
    }
  };

  const btn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium';
  const btnSuccess = `${btn} bg-emerald-600 text-white hover:bg-emerald-700`;
  const btnDanger = `${btn} border border-red-300 text-red-600 hover:bg-red-50`;
  const btnOutline = `${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-slate-500">
        <Loader2 size={32} className="animate-spin" />
        <p>Loading approval requests...</p>
      </div>
    );
  }

  if (pending.length === 0 && cancellationRequests.length === 0) {
    return (
      <EmptyState
        title="No pending approvals"
        description="Student appointment requests and cancellation requests will appear here for your review."
      />
    );
  }

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
            <User size={20} />
            Appointment requests ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map((a) => (
              <div key={a.id} className="rounded-xl border border-l-4 border-amber-400 border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">
                      {a.student?.firstName} {a.student?.lastName}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      <Clock size={14} className="inline" /> {formatDateTime(a.dateTime)} ({a.duration} min)
                    </p>
                    {a.reason && <p className="mt-2 text-sm text-slate-600">Reason: {a.reason}</p>}
                  </div>
                  {statusBadge(a.status)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={btnSuccess} onClick={() => handleAccept(a)}>
                    <Check size={14} /> Accept
                  </button>
                  <button type="button" className={btnDanger} onClick={() => setRejectTarget(a)}>
                    <X size={14} /> Reject
                  </button>
                  <button
                    type="button"
                    className={btnOutline}
                    onClick={() => {
                      setRescheduleTarget(a);
                      setRescheduleDateTime(a.dateTime.slice(0, 16));
                      setRescheduleDuration(a.duration);
                    }}
                  >
                    <CalendarClock size={14} /> Reschedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {cancellationRequests.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
            <AlertCircle size={20} className="text-amber-600" />
            Cancellation requests ({cancellationRequests.length})
          </h2>
          <div className="space-y-3">
            {cancellationRequests.map((a) => (
              <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">
                      {a.student?.firstName} {a.student?.lastName}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      <Clock size={14} className="inline" /> {formatDateTime(a.dateTime)} ({a.duration} min)
                    </p>
                    {a.cancellationReason && (
                      <p className="mt-2 text-sm text-slate-600"><strong>Reason:</strong> {a.cancellationReason}</p>
                    )}
                  </div>
                  {statusBadge(a.status)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={btnSuccess} onClick={() => handleAcceptCancellation(a)}>
                    <Check size={14} /> Accept cancellation
                  </button>
                  <button type="button" className={btnDanger} onClick={() => handleRejectCancellation(a)}>
                    <X size={14} /> Keep appointment
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject appointment">
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Optional reason for rejection"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          rows={3}
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setRejectTarget(null)} className={btnOutline}>Cancel</button>
          <button type="button" onClick={handleReject} disabled={rejecting} className={btnDanger}>
            {rejecting ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      </Modal>

      <Modal open={!!rescheduleTarget} onClose={() => setRescheduleTarget(null)} title="Propose new time">
        <input
          type="datetime-local"
          value={rescheduleDateTime}
          onChange={(e) => setRescheduleDateTime(e.target.value)}
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          min={15}
          step={15}
          value={rescheduleDuration}
          onChange={(e) => setRescheduleDuration(Number(e.target.value))}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setRescheduleTarget(null)} className={btnOutline}>Cancel</button>
          <button type="button" onClick={handleReschedule} disabled={rescheduling || !rescheduleDateTime} className={btnSuccess}>
            {rescheduling ? 'Saving...' : 'Propose time'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

const roleCopy: Record<string, { subtitle: string }> = {
  ADMIN: { subtitle: 'Review and approve or reject hall booking requests from students.' },
  STUDENT: { subtitle: 'Track hall booking and appointment requests awaiting approval.' },
  LECTURER: { subtitle: 'Review student appointment and cancellation requests.' },
};

export default function Approvals() {
  const { user } = useAuthStore();
  useMarkSectionReadOnVisit(user?.role, '/approvals');

  const subtitle = user?.role ? roleCopy[user.role]?.subtitle : '';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Approvals</h1>
        <p className="mt-1 text-slate-600">{subtitle}</p>
      </div>

      {user?.role === 'ADMIN' && <AdminApprovalsView />}
      {user?.role === 'STUDENT' && <StudentApprovalsView />}
      {user?.role === 'LECTURER' && <LecturerApprovalsView />}
    </div>
  );
}
