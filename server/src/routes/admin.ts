import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/auth';
import { getDashboardStats } from '../controllers/adminController';
import { getAdminSettings, sendAdminTestEmail, updateAdminEmailSettings } from '../controllers/adminSettingsController';
import { adminEmailSettingsRules } from '../middleware/validate';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/stats', getDashboardStats);
router.get('/settings', getAdminSettings);
router.patch('/settings/email', adminEmailSettingsRules, updateAdminEmailSettings);
router.post('/settings/test-email', sendAdminTestEmail);

export default router;
