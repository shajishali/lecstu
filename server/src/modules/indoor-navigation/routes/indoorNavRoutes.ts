import { Router } from 'express';
import { authenticate, authorize } from '../../../middleware/auth';
import {
  deleteQrCodeHandler,
  getActiveNavigationSession,
  getFloorplans,
  getBuildingsWithGuides,
  getGuidePlaces,
  getNodes,
  postStoryGuide,
  getQrCodes,
  getRouteBySession,
  postCompleteSession,
  postEdgeAlias,
  postFloorplanAlias,
  postNavigation,
  postNodeAlias,
  postQrCode,
  postQrPosition,
  postRoute,
  patchSessionStep,
} from '../controllers/indoorNavController';

const router = Router();

router.use(authenticate);

router.get('/floorplans', getFloorplans);
router.get('/buildings-with-guides', getBuildingsWithGuides);
router.get('/places', getGuidePlaces);
router.get('/nodes', getNodes);
router.post('/story', postStoryGuide);
router.get('/route/:sessionId', getRouteBySession);
router.get('/session/active', getActiveNavigationSession);

router.post('/route', postRoute);
router.post('/navigation', postNavigation);
router.post('/position/qr', postQrPosition);
router.patch('/session/:id/step', patchSessionStep);
router.post('/session/:id/complete', postCompleteSession);

router.post('/floorplans', authorize('ADMIN'), postFloorplanAlias);
router.post('/nodes', authorize('ADMIN'), postNodeAlias);
router.post('/edges', authorize('ADMIN'), postEdgeAlias);

router.get('/qr', authorize('ADMIN'), getQrCodes);
router.post('/qr', authorize('ADMIN'), postQrCode);
router.delete('/qr/:id', authorize('ADMIN'), deleteQrCodeHandler);

export default router;
