import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getMyTimetable,
  getMyTodayNext,
  getMyTodayOnCampus,
  getStudentTimetableById,
  getLecturerTimetableById,
  invalidateCache,
} from '../controllers/userTimetableController';

const router = Router();

router.use(authenticate);

router.get('/my/today/next', getMyTodayNext);
router.get('/my/today', getMyTodayOnCampus);
router.get('/my', getMyTimetable);
router.get('/student/:id', authorize('ADMIN'), getStudentTimetableById);
router.get('/lecturer/:id', getLecturerTimetableById);
router.post('/cache/invalidate', authorize('ADMIN'), invalidateCache);

export default router;
