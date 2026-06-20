import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Trash2 } from 'lucide-react';
import { useAuthStore } from '@store/authStore';
import { useNotificationStore } from '@store/notificationStore';
import { showToast } from '@components/Toast';
import { useNotificationStream } from '@hooks/useNotificationStream';
import TranslatableText from '@components/TranslatableText';
import api from '@services/api';

interface NotificationCenterProps {
  darkNav?: boolean;
}

export default function NotificationCenter({ darkNav }: NotificationCenterProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { user } = useAuthStore();
  const { unreadCount, fetchUnreadCount, markAsRead, markAllRead } = useNotificationStore();
  useNotificationStream();

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      api.get('/notifications', { params: { limit: 10 } })
        .then((res) => setRecent(res.data.data || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleNotificationClick = (n: any) => {
    if (n.type === 'APPOINTMENT_RESCHEDULED') return;
    markAsRead(n.id);
    setOpen(false);
    if (n.type === 'TIMETABLE_CHANGE' || n.type === 'LECTURE_REMINDER') {
      navigate('/timetable');
    } else if (user?.role === 'ADMIN' && n.type === 'HALL_BOOKING_REQUEST') {
      navigate('/admin/approvals');
    } else if (n.metadata?.hallBookingId) {
      navigate('/notifications');
    } else if (n.metadata?.appointmentId) {
      navigate('/appointments');
    } else {
      navigate('/notifications');
    }
  };

  const handleConfirmReschedule = async (e: React.MouseEvent, n: any) => {
    e.stopPropagation();
    const apptId = n.metadata?.appointmentId;
    if (!apptId) return;
    setConfirmingId(n.id);
    try {
      await api.patch(`/appointments/${apptId}/confirm-reschedule`);
      markAsRead(n.id);
      window.dispatchEvent(new CustomEvent('appointments-updated'));
      setOpen(false);
      navigate('/appointments');
    } catch {
      /* ignore */
    } finally {
      setConfirmingId(null);
    }
  };

  const formatTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setRecent((prev) => prev.filter((n) => n.id !== id));
      fetchUnreadCount();
      showToast('success', 'Notification deleted');
    } catch {
      showToast('error', 'Failed to delete notification');
    }
  };

  const btnClass = darkNav
    ? 'relative flex items-center justify-center rounded-lg p-2 text-slate-300 transition-colors hover:text-white'
    : 'relative flex items-center justify-center rounded-lg p-2 text-slate-600 transition-colors hover:text-[var(--color-primary)]';

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className={btnClass}
        onClick={() => setOpen(!open)}
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 flex w-[360px] max-h-[420px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="text-[15px] font-semibold">Notifications</h3>
            {recent.some((n) => !n.isRead) && (
              <button
                type="button"
                className="rounded px-2 py-1 text-sm text-[var(--color-primary)] hover:underline"
                onClick={() => markAllRead()}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-primary)]" />
                <span>Loading...</span>
              </div>
            ) : recent.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">No notifications yet</div>
            ) : (
              recent.map((n) => (
                <div
                  key={n.id}
                  className={`flex cursor-pointer items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50 ${
                    n.isRead ? '' : 'bg-[var(--color-primary-light)]'
                  }`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">
                      <TranslatableText text={n.title} />
                    </div>
                    <div className={`text-xs text-slate-600 ${n.type === 'HALL_BOOKING_APPROVED' ? 'whitespace-pre-line' : 'truncate'}`}>
                      <TranslatableText text={n.message} />
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">{formatTime(n.createdAt)}</div>
                    {n.type === 'APPOINTMENT_RESCHEDULED' && n.metadata?.appointmentId && (
                    <button
                      type="button"
                      className="mt-2 flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
                      onClick={(e) => handleConfirmReschedule(e, n)}
                      disabled={confirmingId === n.id}
                    >
                      {confirmingId === n.id ? '...' : 'OK - Confirm'}
                    </button>
                  )}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded p-1.5 text-slate-400 hover:text-red-500"
                    onClick={(e) => handleDelete(e, n.id)}
                    title="Delete notification"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-slate-200 py-2 text-center">
            <button
              type="button"
              className="rounded px-2 py-1 text-sm text-[var(--color-primary)] hover:underline"
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
            >
              View all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
