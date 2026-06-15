import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '@store/notificationStore';
import api from '@services/api';

const APPOINTMENT_NOTIFICATION_TYPES = [
  'APPOINTMENT_ACCEPTED',
  'APPOINTMENT_REJECTED',
  'APPOINTMENT_RESCHEDULED',
  'APPOINTMENT_CONFIRMED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_REMINDER',
  'APPOINTMENT_ADMIN_APPROVED',
  'APPOINTMENT_ADMIN_REJECTED',
  'HALL_BOOKING_APPROVED',
  'HALL_BOOKING_REJECTED',
];

function formatTime(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

interface AppointmentNotificationPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  onNavigate?: () => void;
  onMouseEnter?: () => void;
}

export default function AppointmentNotificationPopover({
  open,
  onClose,
  anchorRef,
  onNavigate,
  onMouseEnter,
}: AppointmentNotificationPopoverProps) {
  const navigate = useNavigate();
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { markAsRead, fetchUnreadCount } = useNotificationStore();

  useEffect(() => {
    if (open) {
      setLoading(true);
      api
        .get('/notifications', { params: { limit: 20 } })
        .then((res) => {
          const all = res.data.data || [];
          const filtered = all.filter((n: any) =>
            APPOINTMENT_NOTIFICATION_TYPES.includes(n.type)
          );
          setRecent(filtered.slice(0, 5));
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        open &&
        panelRef.current &&
        !panelRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose, anchorRef]);

  const handleNotificationClick = (n: any) => {
    if (n.type === 'APPOINTMENT_RESCHEDULED') return;
    markAsRead(n.id);
    onClose();
    onNavigate?.();
    if (n.metadata?.hallBookingId) {
      navigate('/notifications');
    } else {
      navigate('/appointments');
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
      fetchUnreadCount();
      onClose();
      onNavigate?.();
      navigate('/appointments');
    } catch {
      /* ignore */
    } finally {
      setConfirmingId(null);
    }
  };

  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const updatePosition = () => {
      if (anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        setPosition({ top: rect.top, left: rect.right + 4 });
      }
    };
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, anchorRef]);

  if (!open) return null;

  const popoverContent = (
    <div
      ref={panelRef}
      className="fixed z-[9999] flex w-[320px] max-h-[360px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
      style={{ top: position.top, left: position.left }}
      onMouseEnter={onMouseEnter}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="text-[14px] font-semibold text-slate-800">
          Appointment notifications
        </h3>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-primary)]" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : recent.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No appointment notifications
          </div>
        ) : (
          recent.map((n) => (
            <div
              key={n.id}
              className={`flex cursor-pointer flex-col gap-1 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50 ${
                n.isRead ? '' : 'bg-[var(--color-primary-light)]'
              }`}
              onClick={() => handleNotificationClick(n)}
            >
              <div className="font-semibold text-sm">{n.title}</div>
              <div
                className={`text-xs text-slate-600 ${
                  n.type === 'HALL_BOOKING_APPROVED' ? 'whitespace-pre-line' : 'line-clamp-2'
                }`}
              >
                {n.message}
              </div>
              <div className="text-[11px] text-slate-400">{formatTime(n.createdAt)}</div>
              {n.type === 'APPOINTMENT_RESCHEDULED' && n.metadata?.appointmentId && (
                <button
                  type="button"
                  className="mt-2 flex w-fit items-center gap-1 rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
                  onClick={(e) => handleConfirmReschedule(e, n)}
                  disabled={confirmingId === n.id}
                >
                  {confirmingId === n.id ? '...' : 'OK - Confirm'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
      <div className="border-t border-slate-200 py-2 text-center">
        <button
          type="button"
          className="rounded px-2 py-1 text-sm text-[var(--color-primary)] hover:underline"
          onClick={() => {
            onClose();
            onNavigate?.();
            navigate('/appointments');
          }}
        >
          View appointments
        </button>
      </div>
    </div>
  );

  return createPortal(popoverContent, document.body);
}
