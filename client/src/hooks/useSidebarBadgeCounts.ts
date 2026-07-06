import { useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { useAuthStore } from '@store/authStore';
import { SIDEBAR_NOTIFICATION_SECTIONS } from '@config/sidebarNotifications';

async function fetchPendingAppointmentsCount(role: string): Promise<number> {
  const status =
    role === 'LECTURER'
      ? 'PENDING,PENDING_ADMIN,CANCELLATION_REQUESTED'
      : 'PENDING,PENDING_ADMIN';
  const res = await api.get('/appointments', {
    params: { status, limit: 1, page: 1 },
  });
  return res.data.pagination?.total ?? 0;
}

export function useSidebarBadgeCounts(): Record<string, number> {
  const { user } = useAuthStore();
  const [counts, setCounts] = useState<Record<string, number>>({});

  const fetchCounts = useCallback(async () => {
    if (!user?.role) {
      setCounts({});
      return;
    }

    const sections = SIDEBAR_NOTIFICATION_SECTIONS[user.role];
    if (!sections) {
      setCounts({});
      return;
    }

    const entries = await Promise.all(
      Object.entries(sections).map(async ([path, config]) => {
        try {
          const totals: number[] = [];

          if (config.usePendingHallBookings) {
            const bookingRes = await api.get('/halls/bookings', {
              params: { status: 'PENDING', limit: 1, page: 1 },
            });
            totals.push(bookingRes.data.pagination?.total ?? 0);
          }

          if (config.usePendingAppointments) {
            totals.push(await fetchPendingAppointmentsCount(user.role));
          }

          if (config.types.length > 0) {
            const notifRes = await api.get('/notifications/unread-count', {
              params: { types: config.types.join(',') },
            });
            totals.push(notifRes.data.data?.count ?? 0);
          }

          return [path, totals.length > 0 ? Math.max(...totals) : 0] as const;
        } catch {
          return [path, 0] as const;
        }
      }),
    );

    setCounts(Object.fromEntries(entries));
  }, [user?.role]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    const refresh = () => fetchCounts();
    window.addEventListener('notifications-updated', refresh);
    window.addEventListener('appointment-notifications-read', refresh);
    window.addEventListener('appointments-updated', refresh);
    window.addEventListener('approvals-updated', refresh);
    window.addEventListener('timetable-updated', refresh);
    return () => {
      window.removeEventListener('notifications-updated', refresh);
      window.removeEventListener('appointment-notifications-read', refresh);
      window.removeEventListener('appointments-updated', refresh);
      window.removeEventListener('approvals-updated', refresh);
      window.removeEventListener('timetable-updated', refresh);
    };
  }, [fetchCounts]);

  return counts;
}
