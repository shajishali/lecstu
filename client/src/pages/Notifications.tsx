import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '@components/Toast';
import api from '@services/api';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { useAuthStore } from '@store/authStore';
import { useNotificationStore } from '@store/notificationStore';
import { useNotificationStream } from '@hooks/useNotificationStream';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: { appointmentId?: string; hallBookingId?: string; slotId?: string };
  createdAt: string;
}

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { markAsRead, markAllRead, fetchUnreadCount } = useNotificationStore();
  useNotificationStream();

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications', { params: { page, limit: 20 } });
      setNotifications(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages ?? 1);
    } catch {
      showToast('error', 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => { fetchUnreadCount(); }, [fetchUnreadCount]);

  const handleMarkRead = async (id: string) => {
    await markAsRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleClick = (n: NotificationItem) => {
    if (!n.isRead) handleMarkRead(n.id);
    if (user?.role === 'ADMIN' && n.type === 'HALL_BOOKING_REQUEST') {
      navigate('/admin/approvals');
    } else if (n.type === 'LECTURE_REMINDER' || n.type === 'TIMETABLE_CHANGE') {
      navigate('/timetable');
    } else if (n.metadata?.appointmentId) {
      navigate('/appointments');
    } else if (n.metadata?.hallBookingId) {
      navigate('/notifications');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      fetchUnreadCount();
      showToast('success', 'Notification deleted');
    } catch {
      showToast('error', 'Failed to delete notification');
    }
  };

  const formatTime = (d: string) => {
    const date = new Date(d);
    return date.toLocaleString();
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-0.5 text-slate-500">Your notification history</p>
        </div>
        {unreadCount > 0 && (
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
            onClick={handleMarkAllRead}
          >
            <CheckCheck size={16} /> Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-slate-500">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-primary)]" />
          <p>Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-slate-500">
          <Bell size={48} strokeWidth={1} />
          <h3 className="text-lg font-semibold text-slate-700">No notifications yet</h3>
          <p>Notifications will appear here when you receive them.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-slate-100 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50 ${
                n.isRead ? '' : 'bg-[var(--color-primary-light)]'
              }`}
              onClick={() => handleClick(n)}
            >
              <div>
                <div className="font-semibold text-slate-900">{n.title}</div>
                <div className="mt-0.5 text-sm text-slate-600 whitespace-pre-line">{n.message}</div>
                <div className="mt-1 text-xs text-slate-400">{formatTime(n.createdAt)}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="flex rounded p-1.5 text-slate-400 hover:text-red-500"
                  onClick={(e) => handleDelete(e, n.id)}
                  title="Delete notification"
                >
                  <Trash2 size={16} />
                </button>
                {!n.isRead && (
                  <button
                    type="button"
                    className="flex rounded p-1.5 text-slate-500 hover:text-[var(--color-primary)]"
                    onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                    title="Mark as read"
                  >
                    <Check size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
