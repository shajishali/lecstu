import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  markAppointmentNotificationsRead,
  markTypesRead,
  streamNotifications,
  deleteNotification,
} from '../controllers/notificationController';

const router = Router();

router.use(authenticate);

router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.post('/mark-appointment-read', markAppointmentNotificationsRead);
router.post('/mark-types-read', markTypesRead);
router.get('/stream', streamNotifications);
router.patch('/:id/read', markAsRead);
router.post('/mark-all-read', markAllAsRead);
router.delete('/:id', deleteNotification);

export default router;
