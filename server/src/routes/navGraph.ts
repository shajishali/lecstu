import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createNavEdgeHandler,
  createNavNodeHandler,
  deleteNavEdgeHandler,
  deleteNavNodeHandler,
  getNavEditor,
  syncNavFromMarkers,
  updateNavNodeHandler,
} from '../controllers/navGraphController';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/editor', getNavEditor);
router.get('/', getNavEditor);
router.post('/nodes', createNavNodeHandler);
router.put('/nodes/:id', updateNavNodeHandler);
router.patch('/nodes/:id', updateNavNodeHandler);
router.delete('/nodes/:id', deleteNavNodeHandler);
router.post('/edges', createNavEdgeHandler);
router.delete('/edges/:id', deleteNavEdgeHandler);
router.post('/sync-markers', syncNavFromMarkers);

export default router;
