import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getCourseCatalog,
  getMyCourseCatalog,
  updateMyCourseSelections,
  adminImportCatalog,
  adminSyncCatalogFromTimetable,
} from '../controllers/courseCatalogController';

const router = Router();

router.use(authenticate);

router.get('/catalog', getCourseCatalog);
router.get('/my/catalog', authorize('STUDENT'), getMyCourseCatalog);
router.put('/my/course-selections', authorize('STUDENT'), updateMyCourseSelections);

router.post('/admin/import-handbook', authorize('ADMIN'), adminImportCatalog);
router.post('/admin/sync-from-timetable', authorize('ADMIN'), adminSyncCatalogFromTimetable);

export default router;
