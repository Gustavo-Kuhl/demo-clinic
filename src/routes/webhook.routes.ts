import { Router } from 'express';
import { handleWebhook } from '../modules/whatsapp/webhook.handler';

const router = Router();

// Evolution API envia mensagens via POST
router.post('/', handleWebhook);

export default router;
