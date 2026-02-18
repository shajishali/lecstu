import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getAvailableHalls,
  getAvailableNow,
  getHallSchedule,
  getFilters,
} from '../controllers/hallAvailabilityController';

const router = Router();

router.use(authenticate);

router.get('/available', getAvailableHalls);
router.get('/available-now', getAvailableNow);
router.get('/filters', getFilters);
router.get('/:id/schedule', getHallSchedule);

export default router;
