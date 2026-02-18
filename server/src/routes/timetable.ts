import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/auth';
import { timetableCreateRules, timetableUpdateRules } from '../middleware/validate';
import {
  listTimetable,
  getTimetableEntry,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  getDropdownData,
  bulkImport,
} from '../controllers/timetableController';
import { uploadCsv } from '../middleware/upload';

const router = Router();

router.use(authenticate);

router.get('/', listTimetable);
router.get('/dropdowns', authorize('ADMIN'), getDropdownData);
router.get('/:id', getTimetableEntry);

router.use(authorize('ADMIN'));

router.post('/', timetableCreateRules, createTimetableEntry);
router.patch('/:id', timetableUpdateRules, updateTimetableEntry);
router.delete('/:id', deleteTimetableEntry);
router.post('/bulk-import', uploadCsv, bulkImport);

export default router;
