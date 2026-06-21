import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validateStudentRegistration } from '../middleware/studentRegister';
import {
  adminCreateUserRules,
  adminResetPasswordRules,
  adminUpdateUserRules,
} from '../middleware/validate';
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  resetUserPassword,
  updateUser,
} from '../controllers/adminUserController';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', listUsers);
router.get('/:id', getUser);
router.post('/', ...adminCreateUserRules, validateStudentRegistration, createUser);
router.patch('/:id', ...adminUpdateUserRules, updateUser);
router.delete('/:id', deleteUser);
router.patch('/:id/password', ...adminResetPasswordRules, resetUserPassword);

export default router;
