import api from '@services/api';
import { useNotificationStore } from '@store/notificationStore';
import { getSidebarSectionConfig } from '@config/sidebarNotifications';

export async function markSectionNotificationsRead(role: string, path: string): Promise<void> {
  const config = getSidebarSectionConfig(role, path);
  if (!config?.markReadOnVisit || config.types.length === 0) return;

  try {
    await api.post('/notifications/mark-types-read', { types: [...config.types] });
    window.dispatchEvent(new CustomEvent('notifications-updated'));
    window.dispatchEvent(new CustomEvent('appointment-notifications-read'));
    await useNotificationStore.getState().fetchUnreadCount();
  } catch {
    /* ignore */
  }
}
