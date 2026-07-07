import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getAvailableHalls,
  getAvailableNow,
  getHallSchedule,
  getWeeklySchedule,
  getAllHalls,
  getFilters,
} from '../controllers/hallAvailabilityController';
import {
  createHallBooking,
  listHallBookings,
  getHallBooking,
  approveHallBooking,
  rejectHallBooking,
  cancelHallBooking,
} from '../controllers/hallBookingController';

const router = Router();

router.use(authenticate);

router.get('/available', getAvailableHalls);
router.get('/available-now', getAvailableNow);
router.get('/filters', getFilters);
router.get('/list', getAllHalls);

// Hall bookings (student books, admin approves) - must be before /:id
router.post('/bookings', authorize('STUDENT', 'LECTURER'), createHallBooking);
router.get('/bookings', listHallBookings);
router.get('/bookings/:id', getHallBooking);
router.patch('/bookings/:id/approve', authorize('ADMIN'), approveHallBooking);
router.patch('/bookings/:id/reject', authorize('ADMIN'), rejectHallBooking);
router.patch('/bookings/:id/cancel', authorize('STUDENT'), cancelHallBooking);

router.get('/:id/weekly-schedule', getWeeklySchedule);
router.get('/:id/schedule', getHallSchedule);

export default router;
