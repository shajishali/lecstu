import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  getRegistrationOptions,
} from '../controllers/authController';
import { registerRules, loginRules } from '../middleware/validate';
import { validateStudentRegistration } from '../middleware/studentRegister';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/register-options', getRegistrationOptions);
router.post('/register', authLimiter, registerRules, validateStudentRegistration, register);
router.post('/login',    authLimiter, loginRules,    login);
router.post('/refresh',  authLimiter,                refresh);
router.post('/logout',                               logout);
router.get('/me',        optionalAuthenticate,        getMe);

export default router;
