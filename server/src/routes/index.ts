import { Router } from 'express';
import authRoutes from './auth';
import profileRoutes from './profile';
import adminRoutes from './admin';
import adminUserRoutes from './adminUsers';
import timetableRoutes from './timetable';
import groupRoutes from './groups';
import hallRoutes from './halls';
import officeRoutes from './offices';
import buildingRoutes from './buildings';
import markerRoutes from './markers';
import indoorMarkerRoutes from './indoorMarkers';
import navGraphRoutes from './navGraph';
import userTimetableRoutes from './userTimetable';
import hallAvailabilityRoutes from './hallAvailability';
import lecturerRoutes from './lecturers';
import appointmentRoutes from './appointments';
import notificationRoutes from './notifications';
import mapRoutes from './map';
import asrRoutes from './asr';
import chatbotRoutes from './chatbot';
import translationRoutes from './translation';
import navigationRoutes from './navigation';
import indoorNavRoutes from '../modules/indoor-navigation/routes/indoorNavRoutes';
import navigationAdminRoutes from './navigationAdmin';

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
router.use('/admin/users', adminUserRoutes);
router.use('/admin/timetable', timetableRoutes);
router.use('/admin/groups', groupRoutes);
router.use('/admin/halls', hallRoutes);
router.use('/admin/offices', officeRoutes);
router.use('/admin/buildings', buildingRoutes);
router.use('/admin/navigation', navigationAdminRoutes);
router.use('/admin/markers', markerRoutes);
router.use('/admin/map/indoor-markers', indoorMarkerRoutes);
router.use('/admin/map/nav-graph', navGraphRoutes);
router.use('/timetable', userTimetableRoutes);
router.use('/halls', hallAvailabilityRoutes);
router.use('/lecturers', lecturerRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/map', mapRoutes);
router.use('/ai/asr', asrRoutes);
router.use('/ai/chatbot', chatbotRoutes);
router.use('/ai/translation', translationRoutes);
router.use('/navigation', navigationRoutes);
router.use('/indoor-nav', indoorNavRoutes);

export default router;
