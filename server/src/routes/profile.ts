import { Router } from 'express';
import { getProfile, updateProfile, uploadAvatar, getDepartments } from '../controllers/profileController';
import { uploadAvatar as uploadMiddleware } from '../middleware/upload';
import { authenticate } from '../middleware/auth';
import { profileUpdateRules } from '../middleware/validate';

const router = Router();

router.use(authenticate);

router.get('/',           getProfile);
router.patch('/',         profileUpdateRules, updateProfile);
router.post('/avatar',    uploadMiddleware, uploadAvatar);
router.get('/departments', getDepartments);

export default router;
