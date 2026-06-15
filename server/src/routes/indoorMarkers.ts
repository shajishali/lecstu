import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createIndoorMarkerHandler,
  deleteIndoorMarker,
  getIndoorEditor,
  listIndoorMarkers,
  updateIndoorMarkerHandler,
  updateIndoorMarkerPosition,
} from '../controllers/indoorMarkerController';
import {
  bulkApproveMarkersHandler,
  patchMarkerReviewHandler,
} from '../controllers/floorPlanReviewController';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/editor', getIndoorEditor);
router.get('/', listIndoorMarkers);
router.post('/bulk-approve', bulkApproveMarkersHandler);
router.post('/', createIndoorMarkerHandler);
router.patch('/:id/position', updateIndoorMarkerPosition);
router.patch('/:id/review', patchMarkerReviewHandler);
router.put('/:id', updateIndoorMarkerHandler);
router.patch('/:id', updateIndoorMarkerHandler);
router.delete('/:id', deleteIndoorMarker);

export default router;
