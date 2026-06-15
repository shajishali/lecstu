import { useEffect, useState, useCallback } from 'react';
import api, { showApiErrorToast } from '@services/api';
import { showToast } from '@components/Toast';
import {
  Building,
  Check,
  X,
  Loader2,
  Inbox,
  KeyRound,
  Clock,
} from 'lucide-react';

interface HallBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string | null;
  status: string;
  createdAt: string;
  student: { id: string; firstName: string; lastName: string; email: string };
  hall: { id: string; name: string; building: string; floor: number };
}

function formatTime(t: string): string {
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  const suffix = hr >= 12 ? 'PM' : 'AM';
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${display}:${m} ${suffix}`;
}

function isBookingDatePast(date: string): boolean {
  const bookingDate = new Date(date);
  bookingDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return bookingDate < today;
}

function formatSubmittedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function AdminApprovals() {
  const [hallBookings, setHallBookings] = useState<HallBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [approveModal, setApproveModal] = useState<HallBooking | null>(null);
  const [doorPassword, setDoorPassword] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const hbRes = await api.get('/halls/bookings', { params: { status: 'PENDING' } });
      setHallBookings(hbRes.data.data || []);
    } catch (err) {
      showApiErrorToast(err, 'Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openApproveModal = (b: HallBooking) => {
    setApproveModal(b);
    setDoorPassword('');
  };

  const closeApproveModal = () => {
    setApproveModal(null);
    setDoorPassword('');
  };

  const handleApproveHall = async () => {
    if (!approveModal) return;
    if (!doorPassword.trim()) {
      showToast('error', 'Please enter the door password');
      return;
    }
    setActioning(`hall-${approveModal.id}`);
    try {
      await api.patch(`/halls/bookings/${approveModal.id}/approve`, {
        doorPassword: doorPassword.trim(),
      });
      showToast('success', 'Hall booking approved - student will receive door password in notification');
      closeApproveModal();
      fetchData();
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      window.dispatchEvent(new CustomEvent('approvals-updated'));
    } catch (err: any) {
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
    } catch (err: any) {
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Approvals</h1>
        <p className="mt-1 text-slate-600">
          Review and approve or reject hall booking requests.
        </p>
      </div>

      {hallBookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-slate-50 py-16 text-slate-500">
          <Inbox size={48} strokeWidth={1.5} />
          <h3 className="text-lg font-medium text-slate-700">No pending approvals</h3>
          <p>Hall booking requests will appear here for your review.</p>
        </div>
      ) : (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
            <Building size={20} />
            Hall Booking Requests ({hallBookings.length})
          </h2>
          <div className="space-y-3">
            {hallBookings.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap gap-4">
                  <div>
                    <p className="font-medium text-slate-800">{b.hall.name}</p>
                    <p className="text-sm text-slate-500">
                      {b.hall.building}, Floor {b.hall.floor}
                    </p>
                  </div>
                  <div className="border-l border-slate-200 pl-4">
                    <p className="text-sm font-medium text-slate-700">
                      {new Date(b.date).toLocaleDateString()} • {formatTime(b.startTime)} - {formatTime(b.endTime)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                      <Clock size={12} />
                      Submitted {formatSubmittedAt(b.createdAt)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Requested by {b.student.firstName} {b.student.lastName}
                    </p>
                    {isBookingDatePast(b.date) && (
                      <p className="mt-1 text-xs font-medium text-amber-700">
                        Booking date has passed — approve only if you still want to grant access.
                      </p>
                    )}
                    {b.reason && (
                      <p className="mt-1 text-sm text-slate-600">Reason: {b.reason}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openApproveModal(b)}
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
                    {actioning === `hall-reject-${b.id}` ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <X size={16} />
                    )}
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Approve Hall Modal - Door Password */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeApproveModal}>
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Approve Hall Booking</h3>
              <button type="button" onClick={closeApproveModal} className="rounded p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
              <p><strong>{approveModal.hall.name}</strong> - {approveModal.hall.building}, Floor {approveModal.hall.floor}</p>
              <p className="mt-1 text-slate-600">
                {new Date(approveModal.date).toLocaleDateString()} • {formatTime(approveModal.startTime)} - {formatTime(approveModal.endTime)}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <Clock size={12} />
                Submitted {formatSubmittedAt(approveModal.createdAt)}
              </p>
              <p className="mt-1 text-slate-500">
                Student: {approveModal.student.firstName} {approveModal.student.lastName}
              </p>
            </div>
            <div className="mb-4">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <KeyRound size={16} /> Door password (required)
              </label>
              <input
                type="text"
                placeholder="Enter password for automated door"
                value={doorPassword}
                onChange={(e) => setDoorPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                autoFocus
              />
              <p className="mt-1.5 text-xs text-slate-500">
                This password will be sent to the student in the approval notification for door access during their allocated time.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeApproveModal}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveHall}
                disabled={!doorPassword.trim() || !!actioning}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {actioning ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Approve & Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
