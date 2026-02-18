import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listHalls,
  getHall,
  createHall,
  updateHall,
  deleteHall,
  getBuildings,
} from '../controllers/hallController';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', listHalls);
router.get('/buildings', getBuildings);
router.get('/:id', getHall);
router.post('/', createHall);
router.patch('/:id', updateHall);
router.delete('/:id', deleteHall);

export default router;
