import { useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { useAuthStore } from '@store/authStore';

export function usePendingApprovalsCount() {
  const { user } = useAuthStore();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (user?.role !== 'ADMIN') {
      setCount(0);
      return;
    }
    try {
      const res = await api.get('/halls/bookings', {
        params: { status: 'PENDING', limit: 1, page: 1 },
      });
      setCount(res.data.pagination?.total ?? 0);
    } catch {
      setCount(0);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    const handleUpdate = () => fetchCount();
    window.addEventListener('approvals-updated', handleUpdate);
    window.addEventListener('notifications-updated', handleUpdate);
    return () => {
      window.removeEventListener('approvals-updated', handleUpdate);
      window.removeEventListener('notifications-updated', handleUpdate);
    };
  }, [fetchCount]);

  return count;
}
