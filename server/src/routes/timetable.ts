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
  bulkImportPreview,
  bulkImportConfirm,
  bulkImportTemplate,
  listTimetableTables,
  getTimetableTable,
  updateTimetableTable,
  createTimetableTable,
  updateTimetableTableMeta,
  deleteTimetableTable,
  assignLecturer,
  reresolveLecturers,
} from '../controllers/timetableController';
import { uploadTimetableFile } from '../middleware/upload';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', listTimetable);
router.get('/dropdowns', getDropdownData);
router.get('/bulk-import/template', bulkImportTemplate);
router.get('/tables', listTimetableTables);
router.post('/tables', createTimetableTable);
router.get('/tables/:id', getTimetableTable);
router.patch('/tables/:id/meta', updateTimetableTableMeta);
router.patch('/tables/:id', updateTimetableTable);
router.delete('/tables/:id', deleteTimetableTable);
router.get('/:id', getTimetableEntry);

router.post('/', timetableCreateRules, createTimetableEntry);
router.patch('/:id/assign-lecturer', assignLecturer);
router.patch('/:id', timetableUpdateRules, updateTimetableEntry);
router.delete('/:id', deleteTimetableEntry);
router.post('/reresolve-lecturers', reresolveLecturers);
router.post('/bulk-import/preview', uploadTimetableFile, bulkImportPreview);
router.post('/bulk-import/confirm', bulkImportConfirm);
router.post('/bulk-import', uploadTimetableFile, bulkImport);

export default router;
