import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/auth';
import { getDashboardStats } from '../controllers/adminController';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/stats', getDashboardStats);

export default router;
