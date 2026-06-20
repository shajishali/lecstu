import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  getRegistrationOptions,
} from '../controllers/authController';
import {
  forgotPassword,
  verifyResetCodeEndpoint,
  resetPassword,
} from '../controllers/passwordResetController';
import {
  sendRegistrationCode,
  verifyRegistrationCodeEndpoint,
} from '../controllers/registrationVerificationController';
import {
  registerRules,
  loginRules,
  forgotPasswordRules,
  verifyResetCodeRules,
  resetPasswordRules,
  sendRegistrationCodeRules,
  verifyRegistrationCodeRules,
} from '../middleware/validate';
import { validateStudentRegistration } from '../middleware/studentRegister';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { requireHttpsInProduction } from '../middleware/requireHttps';
import {
  authLimiter,
  emailCodeSendIpLimiter,
  emailCodeSendEmailLimiter,
  emailCodeVerifyLimiter,
} from '../middleware/rateLimiter';

const router = Router();

router.use(requireHttpsInProduction);

router.get('/register-options', getRegistrationOptions);
router.post(
  '/registration/send-code',
  emailCodeSendIpLimiter,
  emailCodeSendEmailLimiter,
  sendRegistrationCodeRules,
  sendRegistrationCode,
);
router.post(
  '/registration/verify-code',
  emailCodeVerifyLimiter,
  verifyRegistrationCodeRules,
  verifyRegistrationCodeEndpoint,
);
router.post('/register', authLimiter, emailCodeVerifyLimiter, registerRules, validateStudentRegistration, register);
router.post('/login',    authLimiter, loginRules,    login);
router.post('/forgot-password', emailCodeSendIpLimiter, emailCodeSendEmailLimiter, forgotPasswordRules, forgotPassword);
router.post('/verify-reset-code', emailCodeVerifyLimiter, verifyResetCodeRules, verifyResetCodeEndpoint);
router.post('/reset-password', emailCodeVerifyLimiter, resetPasswordRules, resetPassword);
router.post('/refresh',  authLimiter,                refresh);
router.post('/logout',                               logout);
router.get('/me',        optionalAuthenticate,        getMe);

export default router;
