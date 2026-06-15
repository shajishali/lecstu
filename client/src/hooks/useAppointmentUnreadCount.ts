import { useState, useEffect, useCallback } from 'react';
import api from '@services/api';

const APPOINTMENT_TYPES =
  'APPOINTMENT_ACCEPTED,APPOINTMENT_REJECTED,APPOINTMENT_RESCHEDULED,APPOINTMENT_CONFIRMED,APPOINTMENT_CANCELLED,APPOINTMENT_REMINDER,APPOINTMENT_ADMIN_APPROVED,APPOINTMENT_ADMIN_REJECTED,HALL_BOOKING_APPROVED,HALL_BOOKING_REJECTED';

export function useAppointmentUnreadCount() {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await api.get('/notifications/unread-count', {
        params: { types: APPOINTMENT_TYPES },
      });
      setCount(res.data.data?.count ?? 0);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    const handleUpdate = () => fetchCount();
    window.addEventListener('appointments-updated', handleUpdate);
    window.addEventListener('appointment-notifications-read', handleUpdate);
    return () => {
      window.removeEventListener('appointments-updated', handleUpdate);
      window.removeEventListener('appointment-notifications-read', handleUpdate);
    };
  }, [fetchCount]);

  return count;
}
