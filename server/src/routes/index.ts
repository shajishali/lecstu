import { Router } from 'express';
import authRoutes from './auth';
import profileRoutes from './profile';
import adminRoutes from './admin';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'LECSTU API is running',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/admin', adminRoutes);

export default router;
