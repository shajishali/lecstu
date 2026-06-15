import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { uploadFloorPlan, uploadFloorPlanBulk } from '../middleware/upload';
import {
  listBuildings,
  getBuilding,
  createBuilding,
  updateBuilding,
  deleteBuilding,
  uploadFloorPlan as uploadFloorPlanHandler,
  bulkUploadFloorPlans,
  updateFloorPlanBounds,
  deleteFloorPlan,
  getFloorPlanImportInfo,
  seedFacultyBuildings,
  getFacultySetupStatusHandler,
  analyzeFloorPlanWithAi,
  saveFloorNavigationNotes,
  buildFloorNavigationGuideHandler,
} from '../controllers/buildingController';
import {
  backupWalkingPathsHandler,
  buildFloorNavGraphHandler,
  clearAutoPathPointsHandler,
  restoreWalkingPathsHandler,
  lockFloorLocationsHandler,
  unlockFloorLocationsHandler,
  bulkApproveFloorMarkersHandler,
  createFloorMarkerHandler,
  deleteFloorMarkerHandler,
  getFloorNavGraphValidationHandler,
  getFloorLocationsReviewHandler,
  patchFloorMarkerDetailsHandler,
  patchFloorMarkerPositionHandler,
  patchFloorMarkerReviewHandler,
  patchFloorPlanCalibrationHandler,
  patchFloorPlanPublishHandler,
  placeConnectionMarkerHandler,
  purgeJunkMarkersHandler,
} from '../controllers/floorPlanReviewController';
import {
  autoPairBuildingHandler,
  deleteBuildingEdgeHandler,
  getBuildingConnectorSuggestionsHandler,
  getBuildingConnectorsHandler,
  pairBuildingFloorNodesHandler,
} from '../controllers/buildingConnectorController';
import {
  autoPairVerticalHandler,
  deleteVerticalEdgeHandler,
  getVerticalConnectorsHandler,
  getVerticalSuggestionsHandler,
  pairVerticalNodesHandler,
} from '../controllers/verticalConnectorController';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/floorplans/import-info', getFloorPlanImportInfo);
router.get('/setup-status', getFacultySetupStatusHandler);
router.post('/seed-faculty', seedFacultyBuildings);
router.get('/:id/vertical-connectors/suggestions', getVerticalSuggestionsHandler);
router.get('/:id/vertical-connectors', getVerticalConnectorsHandler);
router.post('/:id/vertical-connectors/auto-pair', autoPairVerticalHandler);
router.post('/:id/vertical-connectors/pair', pairVerticalNodesHandler);
router.delete('/:id/vertical-connectors/:edgeId', deleteVerticalEdgeHandler);
router.get('/:id/building-connectors/suggestions', getBuildingConnectorSuggestionsHandler);
router.get('/:id/building-connectors', getBuildingConnectorsHandler);
router.post('/:id/building-connectors/auto-pair', autoPairBuildingHandler);
router.post('/:id/building-connectors/pair', pairBuildingFloorNodesHandler);
router.delete('/:id/building-connectors/:edgeId', deleteBuildingEdgeHandler);
router.get('/', listBuildings);
router.get('/:id', getBuilding);
router.post('/', createBuilding);
router.patch('/:id', updateBuilding);
router.delete('/:id', deleteBuilding);

router.post('/floorplans/bulk', uploadFloorPlanBulk, bulkUploadFloorPlans);
router.post('/:id/floorplan', uploadFloorPlan, uploadFloorPlanHandler);
router.post('/:id/floorplan/:floor/analyze-ai', analyzeFloorPlanWithAi);
router.patch('/:id/floorplan/:floor/notes', saveFloorNavigationNotes);
router.post('/:id/floorplan/:floor/build-guide', buildFloorNavigationGuideHandler);
router.get('/:id/floorplan/:floor/locations', getFloorLocationsReviewHandler);
router.get('/:id/floorplan/:floor/nav-graph/validate', getFloorNavGraphValidationHandler);
router.post('/:id/floorplan/:floor/nav-graph/build', buildFloorNavGraphHandler);
router.post('/:id/floorplan/:floor/nav-graph/clear-auto', clearAutoPathPointsHandler);
router.post('/:id/floorplan/:floor/nav-graph/backup', backupWalkingPathsHandler);
router.post('/:id/floorplan/:floor/nav-graph/restore', restoreWalkingPathsHandler);
router.post('/:id/floorplan/:floor/locations/lock', lockFloorLocationsHandler);
router.post('/:id/floorplan/:floor/locations/unlock', unlockFloorLocationsHandler);
router.post('/:id/floorplan/:floor/markers', createFloorMarkerHandler);
router.post('/:id/floorplan/:floor/markers/bulk-approve', bulkApproveFloorMarkersHandler);
router.patch('/:id/floorplan/:floor/markers/:markerId/position', patchFloorMarkerPositionHandler);
router.patch('/:id/floorplan/:floor/markers/:markerId/review', patchFloorMarkerReviewHandler);
router.patch('/:id/floorplan/:floor/markers/:markerId', patchFloorMarkerDetailsHandler);
router.delete('/:id/floorplan/:floor/markers/:markerId', deleteFloorMarkerHandler);
router.post('/:id/floorplan/:floor/purge-junk', purgeJunkMarkersHandler);
router.patch('/:id/floorplan/:floor/calibration', patchFloorPlanCalibrationHandler);
router.patch('/:id/floorplan/:floor/publish', patchFloorPlanPublishHandler);
router.post('/:id/floorplan/:floor/connection-point', placeConnectionMarkerHandler);
router.patch('/:id/floorplan/:planId/bounds', updateFloorPlanBounds);
router.delete('/:id/floorplan/:planId', deleteFloorPlan);

export default router;
