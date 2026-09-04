import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/auth';
import { getDashboardStats } from '../controllers/adminController';
import {
  deleteLoginBackground,
  getAdminSettings,
  sendAdminTestEmail,
  updateAdminEmailSettings,
  updateLoginBackground,
  updateLoginBackgroundAppearance,
} from '../controllers/adminSettingsController';
import { adminEmailSettingsRules } from '../middleware/validate';
import { uploadLoginBackground } from '../middleware/upload';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/stats', getDashboardStats);
router.get('/settings', getAdminSettings);
router.patch('/settings/email', adminEmailSettingsRules, updateAdminEmailSettings);
router.post('/settings/login-background', uploadLoginBackground, updateLoginBackground);
router.patch('/settings/login-background/appearance', updateLoginBackgroundAppearance);
router.delete('/settings/login-background', deleteLoginBackground);
router.post('/settings/test-email', sendAdminTestEmail);

export default router;
