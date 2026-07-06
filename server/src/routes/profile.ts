import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  getDepartments,
  getGroups,
  updateStudentEnrollment,
  requestPasswordChangeCode,
  verifyPasswordChangeCode,
  changePassword,
  confirmPasswordChange,
} from '../controllers/profileController';
import { validateEnrollmentUpdate } from '../middleware/studentRegister';
import { uploadAvatar as uploadMiddleware } from '../middleware/upload';
import { authenticate } from '../middleware/auth';
import {
  passwordChangeRules,
  profilePasswordChangeWithCodeRules,
  profilePasswordRequestCodeRules,
  profilePasswordVerifyCodeRules,
  profileUpdateRules,
} from '../middleware/validate';

const router = Router();

router.use(authenticate);

router.get('/', getProfile);
router.patch('/', profileUpdateRules, updateProfile);
router.post('/avatar', uploadMiddleware, uploadAvatar);
router.get('/departments', getDepartments);
router.get('/groups', getGroups);
router.patch('/enrollment', validateEnrollmentUpdate, updateStudentEnrollment);
router.post('/password/request-code', profilePasswordRequestCodeRules, requestPasswordChangeCode);
router.post('/password/verify-code', profilePasswordVerifyCodeRules, verifyPasswordChangeCode);
router.patch('/password/confirm', profilePasswordChangeWithCodeRules, confirmPasswordChange);
router.patch('/password', passwordChangeRules, changePassword);

export default router;
