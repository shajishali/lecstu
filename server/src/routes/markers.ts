import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listMarkers,
  getMarker,
  createMarker,
  updateMarker,
  deleteMarker,
  getMarkerDropdowns,
} from '../controllers/markerController';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', listMarkers);
router.get('/dropdowns', getMarkerDropdowns);
router.get('/:id', getMarker);
router.post('/', createMarker);
router.patch('/:id', updateMarker);
router.delete('/:id', deleteMarker);

export default router;
