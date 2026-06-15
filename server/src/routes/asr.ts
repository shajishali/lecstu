import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { uploadAudio } from '../middleware/upload';
import { getStatus, transcribe } from '../controllers/asrController';

const router = Router();

router.get('/status', authenticate, getStatus);
router.post('/transcribe', authenticate, uploadAudio, transcribe);

export default router;
