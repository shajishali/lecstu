import { create } from 'zustand';
import api from '@services/api';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: { appointmentId?: string };
  createdAt: string;
}

interface NotificationState {
  unreadCount: number;
  recent: Notification[];
  setUnreadCount: (n: number) => void;
  addNotification: (n: Notification) => void;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  recent: [],

  setUnreadCount: (n) => set({ unreadCount: n }),

  addNotification: (n) => {
    set((s) => ({
      unreadCount: s.unreadCount + (n.isRead ? 0 : 1),
      recent: [n, ...s.recent.filter((r) => r.id !== n.id)].slice(0, 10),
    }));
    const appointmentTypes = [
      'APPOINTMENT_REQUEST',
      'APPOINTMENT_ACCEPTED',
      'APPOINTMENT_REJECTED',
      'APPOINTMENT_CANCELLED',
      'APPOINTMENT_RESCHEDULED',
      'APPOINTMENT_CONFIRMED',
      'APPOINTMENT_REMINDER',
      'APPOINTMENT_ADMIN_APPROVED',
      'APPOINTMENT_ADMIN_REJECTED',
      'HALL_BOOKING_APPROVED',
      'HALL_BOOKING_REJECTED',
    ];
    if (appointmentTypes.includes(n.type)) {
      window.dispatchEvent(new CustomEvent('appointments-updated'));
    }
    if (['HALL_BOOKING_REQUEST', 'HALL_BOOKING_APPROVED', 'HALL_BOOKING_REJECTED'].includes(n.type)) {
      window.dispatchEvent(new CustomEvent('approvals-updated'));
    }
    if (n.type === 'TIMETABLE_CHANGE') {
      window.dispatchEvent(new CustomEvent('timetable-updated'));
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      set({ unreadCount: res.data.data?.count ?? 0 });
    } catch {
      /* ignore */
    }
  },

  markAsRead: async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      set((s) => ({
        unreadCount: Math.max(0, s.unreadCount - 1),
        recent: s.recent.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      }));
    } catch {
      /* ignore */
    }
  },

  markAllRead: async () => {
    try {
      await api.post('/notifications/mark-all-read');
      set({ unreadCount: 0, recent: get().recent.map((n) => ({ ...n, isRead: true })) });
    } catch {
      /* ignore */
    }
  },
}));
