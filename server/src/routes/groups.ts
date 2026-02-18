import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { uploadCsv } from '../middleware/upload';
import {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  assignStudents,
  removeStudent,
  bulkAssignStudents,
  getAvailableStudents,
} from '../controllers/groupController';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', listGroups);
router.get('/:id', getGroup);
router.post('/', createGroup);
router.patch('/:id', updateGroup);
router.delete('/:id', deleteGroup);

router.get('/:id/available-students', getAvailableStudents);
router.post('/:id/students', assignStudents);
router.post('/:id/students/bulk', uploadCsv, bulkAssignStudents);
router.delete('/:id/students/:studentId', removeStudent);

export default router;
