import { Router } from 'express';
import { optionalAuthenticate } from '../middleware/auth';
import { trackChat } from '../controllers/chatbotController';

const router = Router();

router.post('/track', optionalAuthenticate, trackChat);

export default router;
