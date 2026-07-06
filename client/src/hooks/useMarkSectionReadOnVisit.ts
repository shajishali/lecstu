import { useEffect } from 'react';
import { markSectionNotificationsRead } from '@utils/sectionNotifications';

export function useMarkSectionReadOnVisit(role: string | undefined, path: string) {
  useEffect(() => {
    if (!role) return;
    void markSectionNotificationsRead(role, path);
  }, [role, path]);
}
