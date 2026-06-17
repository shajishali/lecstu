import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listLecturers,
  getLecturerProfile,
  getLecturerAvailability,
  getDepartments,
  getMySchedule,
  putMySchedule,
  getMyTimetableCreateOptions,
  createMyTimetableEntries,
  patchMyTimetableSlot,
} from '../controllers/lecturerController';

const router = Router();

router.use(authenticate);

router.get('/departments', getDepartments);
router.get('/me/schedule', authorize('LECTURER'), getMySchedule);
router.put('/me/schedule', authorize('LECTURER'), putMySchedule);
router.get('/me/timetable/options', authorize('LECTURER'), getMyTimetableCreateOptions);
router.post('/me/timetable', authorize('LECTURER'), createMyTimetableEntries);
router.patch('/me/timetable/:slotId', authorize('LECTURER'), patchMyTimetableSlot);
router.get('/', listLecturers);
router.get('/:id', getLecturerProfile);
router.get('/:id/availability', getLecturerAvailability);

export default router;
