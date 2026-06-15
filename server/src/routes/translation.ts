import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { translate } from '../controllers/translationController';

const router = Router();

router.post('/translate', authenticate, translate);

export default router;
