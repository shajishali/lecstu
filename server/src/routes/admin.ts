import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/auth';
import { getDashboardStats } from '../controllers/adminController';
import { getAdminSettings } from '../controllers/adminSettingsController';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/stats', getDashboardStats);
router.get('/settings', getAdminSettings);

export default router;
