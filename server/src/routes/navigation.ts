import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getEngineHealth,
  postDetectIntent,
  postGenerateDirections,
  postNavigationQuery,
} from '../controllers/navigationController';

const router = Router();

router.get('/health', getEngineHealth);
router.post('/intent', authenticate, postDetectIntent);
router.post('/query', authenticate, postNavigationQuery);
router.post('/directions/generate', authenticate, postGenerateDirections);

export default router;
