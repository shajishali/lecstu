import { Router } from 'express';
import authRoutes from './auth';
import profileRoutes from './profile';

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

export default router;
