import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getNavigationHealth } from '../controllers/navigationAdminController';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/health', getNavigationHealth);

export default router;
