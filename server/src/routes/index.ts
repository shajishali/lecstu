import { Router } from 'express';
import authRoutes from './auth';
import profileRoutes from './profile';
import adminRoutes from './admin';
import timetableRoutes from './timetable';
import groupRoutes from './groups';
import hallRoutes from './halls';
import officeRoutes from './offices';
import buildingRoutes from './buildings';
import markerRoutes from './markers';

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
router.use('/admin/timetable', timetableRoutes);
router.use('/admin/groups', groupRoutes);
router.use('/admin/halls', hallRoutes);
router.use('/admin/offices', officeRoutes);
router.use('/admin/buildings', buildingRoutes);
router.use('/admin/markers', markerRoutes);

export default router;
