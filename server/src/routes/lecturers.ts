import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listLecturers,
  getLecturerProfile,
  getLecturerAvailability,
  getDepartments,
} from '../controllers/lecturerController';

const router = Router();

router.use(authenticate);

router.get('/', listLecturers);
router.get('/departments', getDepartments);
router.get('/:id', getLecturerProfile);
router.get('/:id/availability', getLecturerAvailability);

export default router;
