import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  appointmentCreateRules,
  appointmentRescheduleRules,
  appointmentRejectRules,
  cancellationRequestRules,
} from '../middleware/validate';
import {
  createAppointment,
  listAppointments,
  getAppointment,
  adminApproveAppointment,
  adminRejectAppointment,
  acceptAppointment,
  rejectAppointment,
  rescheduleAppointment,
  confirmReschedule,
  requestCancellation,
  acceptCancellation,
  rejectCancellation,
  cancelAppointment,
  removeAppointment,
} from '../controllers/appointmentController';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize('STUDENT'),
  appointmentCreateRules,
  createAppointment
);
router.get('/', listAppointments);
router.get('/:id', getAppointment);
router.patch('/:id/admin-approve', authorize('ADMIN'), adminApproveAppointment);
router.patch('/:id/admin-reject', authorize('ADMIN'), adminRejectAppointment);
router.patch('/:id/accept', authorize('LECTURER'), acceptAppointment);
router.patch(
  '/:id/reject',
  authorize('LECTURER'),
  appointmentRejectRules,
  rejectAppointment
);
router.patch(
  '/:id/reschedule',
  authorize('LECTURER'),
  appointmentRescheduleRules,
  rescheduleAppointment
);
router.patch('/:id/confirm-reschedule', authorize('STUDENT'), confirmReschedule);
router.patch(
  '/:id/request-cancellation',
  authorize('STUDENT'),
  cancellationRequestRules,
  requestCancellation
);
router.patch('/:id/accept-cancellation', authorize('LECTURER'), acceptCancellation);
router.patch('/:id/reject-cancellation', authorize('LECTURER'), rejectCancellation);
router.delete('/:id/remove', removeAppointment);
router.delete('/:id', cancelAppointment);

export default router;
