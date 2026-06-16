import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  getDepartments,
  getGroups,
  updateStudentEnrollment,
  changePassword,
} from '../controllers/profileController';
import { validateEnrollmentUpdate } from '../middleware/studentRegister';
import { uploadAvatar as uploadMiddleware } from '../middleware/upload';
import { authenticate } from '../middleware/auth';
import { passwordChangeRules, profileUpdateRules } from '../middleware/validate';

const router = Router();

router.use(authenticate);

router.get('/',           getProfile);
router.patch('/',         profileUpdateRules, updateProfile);
router.post('/avatar',    uploadMiddleware, uploadAvatar);
router.get('/departments', getDepartments);
router.get('/groups', getGroups);
router.patch('/enrollment', validateEnrollmentUpdate, updateStudentEnrollment);
router.patch('/password', passwordChangeRules, changePassword);

export default router;
