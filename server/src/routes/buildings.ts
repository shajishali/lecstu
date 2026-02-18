import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { uploadFloorPlan } from '../middleware/upload';
import {
  listBuildings,
  getBuilding,
  createBuilding,
  updateBuilding,
  deleteBuilding,
  uploadFloorPlan as uploadFloorPlanHandler,
  deleteFloorPlan,
} from '../controllers/buildingController';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', listBuildings);
router.get('/:id', getBuilding);
router.post('/', createBuilding);
router.patch('/:id', updateBuilding);
router.delete('/:id', deleteBuilding);

router.post('/:id/floorplan', uploadFloorPlan, uploadFloorPlanHandler);
router.delete('/:id/floorplan/:planId', deleteFloorPlan);

export default router;
