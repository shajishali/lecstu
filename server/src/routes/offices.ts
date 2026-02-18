import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listOffices,
  getOffice,
  createOffice,
  updateOffice,
  deleteOffice,
  getAvailableLecturers,
} from '../controllers/officeController';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', listOffices);
router.get('/available-lecturers', getAvailableLecturers);
router.get('/:id', getOffice);
router.post('/', createOffice);
router.patch('/:id', updateOffice);
router.delete('/:id', deleteOffice);

export default router;
