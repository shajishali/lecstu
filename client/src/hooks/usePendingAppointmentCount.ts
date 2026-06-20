import { useState, useEffect, useCallback } from 'react';
import api from '@services/api';

function pendingStatusesForRole(role?: string): string {
  if (role === 'LECTURER') {
    return 'PENDING,PENDING_ADMIN,CANCELLATION_REQUESTED';
  }
  return 'PENDING,PENDING_ADMIN';
}

export function usePendingAppointmentCount(role?: string) {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await api.get('/appointments', {
        params: { status: pendingStatusesForRole(role), limit: 1, page: 1 },
      });
      const total = res.data.pagination?.total ?? 0;
      setCount(total);
    } catch {
      setCount(0);
    }
  }, [role]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    const handleUpdate = () => fetchCount();
    window.addEventListener('appointments-updated', handleUpdate);
    return () => window.removeEventListener('appointments-updated', handleUpdate);
  }, [fetchCount]);

  return count;
}
