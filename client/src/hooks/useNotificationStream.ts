import { useEffect, useRef } from 'react';
import { useAuthStore } from '@store/authStore';
import { useNotificationStore } from '@store/notificationStore';

const API_BASE = import.meta.env.DEV ? '' : '';

export function useNotificationStream() {
  const { isAuthenticated } = useAuthStore();
  const { addNotification, fetchUnreadCount } = useNotificationStore();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const token = document.cookie
      .split('; ')
      .find((r) => r.startsWith('access_token='))
      ?.split('=')[1];

    if (!token) return;

    const url = `${API_BASE}/api/notifications/stream`;
    const es = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = es;

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'connected') return;
        addNotification(data);
        fetchUnreadCount();
      } catch {
        /* ignore parse errors */
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setTimeout(fetchUnreadCount, 2000);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [isAuthenticated, addNotification, fetchUnreadCount]);
}
