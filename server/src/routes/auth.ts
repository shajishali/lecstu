import { Router } from 'express';
import { register, login, refresh, logout, getMe } from '../controllers/authController';
import { registerRules, loginRules } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/register', authLimiter, registerRules, register);
router.post('/login',    authLimiter, loginRules,    login);
router.post('/refresh',  authLimiter,                refresh);
router.post('/logout',                               logout);
router.get('/me',        authenticate,               getMe);

export default router;
