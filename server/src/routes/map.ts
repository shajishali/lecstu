import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listMapBuildings,
  listMapMarkers,
  searchMap,
  getMapLiveStatus,
} from '../controllers/mapController';
import { getPublicNavGraph } from '../controllers/navGraphController';
import { getIndoorRoute, getIndoorRouteToday } from '../controllers/indoorRouteController';
import { getNavRoute } from '../controllers/navGraphController';

const router = Router();

router.use(authenticate);

router.get('/buildings', listMapBuildings);
router.get('/markers', listMapMarkers);
router.get('/search', searchMap);
router.get('/live-status', getMapLiveStatus);
router.get('/nav-graph', getPublicNavGraph);
router.get('/indoor-route/today', getIndoorRouteToday);
router.get('/indoor-route', getIndoorRoute);
router.get('/nav-route', getNavRoute);

export default router;
