import { Router } from 'express';
import { getPublicSettings } from '../controllers/adminSettingsController';

const router = Router();

router.get('/public', getPublicSettings);

export default router;
