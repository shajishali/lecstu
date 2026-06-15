import { useState, useEffect, useCallback } from 'react';
import api from '@services/api';

export function usePendingAppointmentCount() {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await api.get('/appointments', {
        params: { status: 'PENDING', limit: 1, page: 1 },
      });
      const total = res.data.pagination?.total ?? 0;
      setCount(total);
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
    return () => window.removeEventListener('appointments-updated', handleUpdate);
  }, [fetchCount]);

  return count;
}
