import './config/env'; // Valida env vars primeiro
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { google } from 'googleapis';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { env } from './config/env';
import { initReminderJobs } from './jobs/reminders.job';
import webhookRoutes from './routes/webhook.routes';
import adminRoutes from './routes/admin.routes';

const app = express();

// ========================
// Middlewares
// ========================
app.use(helmet({ contentSecurityPolicy: false })); // CSP desabilitado para servir o frontend
app.use(cors({
  origin: env.NODE_ENV === 'production' ? false : '*',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ========================
// Logging de requisições
// ========================
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// ========================
// Rotas da API
// ========================
app.use('/webhook', webhookRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', message: 'DB indisponível' });
  }
});

// ========================
// Google OAuth2 (geração do refresh token)
// ========================
app.get('/auth/google', (_req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query as { code?: string };
  if (!code) {
    res.status(400).send('Código de autorização ausente.');
    return;
  }
  try {
    const oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI,
    );
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    logger.info('Google OAuth2 refresh token gerado com sucesso');

    res.send(`
      <html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px">
        <h2>✅ Token gerado com sucesso!</h2>
        <p>Copie o valor abaixo e cole no seu <code>.env</code> como <code>GOOGLE_REFRESH_TOKEN</code>:</p>
        <textarea style="width:100%;height:100px;font-family:monospace;font-size:13px;padding:10px" onclick="this.select()">${refreshToken}</textarea>
        <p style="margin-top:16px;color:#666">Após salvar no .env, reinicie o servidor com <code>npm run dev</code></p>
      </body></html>
    `);
  } catch (err) {
    logger.error('Erro ao trocar código por token:', err);
    res.status(500).send(`Erro ao obter token: ${(err as Error).message}`);
  }
});

// ========================
// Frontend Admin (produção)
// ========================
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ========================
// Inicialização
// ========================
async function bootstrap() {
  try {
    // Testa conexão com banco
    await prisma.$connect();
    logger.info('✅ Conectado ao banco de dados (Supabase)');

    // Inicia o servidor
    const PORT = parseInt(env.PORT, 10);
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Servidor rodando na porta ${PORT}`);
      logger.info(`📡 Webhook URL: http://seu-servidor:${PORT}/webhook`);
      logger.info(`🔧 API Admin: http://seu-servidor:${PORT}/api/admin`);
      logger.info(`🖥️  Painel: http://seu-servidor:${PORT}`);
    });

    // Inicia cron jobs de lembretes
    initReminderJobs();
    logger.info('⏰ Jobs de lembrete iniciados');

    // Auto-configura o webhook se a URL estiver disponível
    if (env.NODE_ENV === 'production' && process.env.PUBLIC_URL) {
      const { setupWebhook } = await import('./modules/whatsapp/evolution.service');
      await setupWebhook(`${process.env.PUBLIC_URL}/webhook`).catch((err) =>
        logger.warn('Não foi possível configurar webhook automaticamente:', err),
      );
    }
  } catch (error) {
    logger.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM recebido, encerrando...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT recebido, encerrando...');
  await prisma.$disconnect();
  process.exit(0);
});

bootstrap();

export default app;
