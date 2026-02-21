import axios from 'axios';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

const evolutionClient = axios.create({
  baseURL: env.EVOLUTION_API_URL,
  headers: {
    apikey: env.EVOLUTION_API_KEY,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

const INSTANCE = env.EVOLUTION_INSTANCE_NAME;

/**
 * Envia uma mensagem de texto via WhatsApp
 */
export async function sendTextMessage(
  to: string, // Número no formato 5511999999999
  text: string,
): Promise<void> {
  try {
    await evolutionClient.post(`/message/sendText/${INSTANCE}`, {
      number: to,
      text,
      delay: 1200, // Simula digitação (1.2s)
    });
    logger.debug(`[WhatsApp] Mensagem enviada para ${to}`);
  } catch (error) {
    logger.error(`[WhatsApp] Erro ao enviar para ${to}:`, error);
    throw error;
  }
}

/**
 * Marca mensagem como "lida"
 */
export async function markAsRead(messageId: string): Promise<void> {
  try {
    await evolutionClient.post(`/chat/markMessageAsRead/${INSTANCE}`, {
      readMessages: [{ id: messageId }],
    });
  } catch (error) {
    logger.warn('[WhatsApp] Erro ao marcar como lido:', error);
  }
}

/**
 * Envia status "digitando..."
 */
export async function sendTyping(to: string, durationMs = 2000): Promise<void> {
  try {
    await evolutionClient.post(`/chat/sendPresence/${INSTANCE}`, {
      number: to,
      options: {
        delay: durationMs,
        presence: 'composing',
      },
    });
  } catch {
    // Não crítico
  }
}

/**
 * Verifica o status da instância
 */
export async function getInstanceStatus(): Promise<{
  state: string;
  connected: boolean;
}> {
  try {
    const response = await evolutionClient.get(
      `/instance/fetchInstances`,
    );
    // Evolution API v2: retorna array com { name, connectionStatus, ... }
    const instances = response.data as Array<{ name: string; connectionStatus: string }>;
    const instance = instances.find((i) => i.name === INSTANCE);

    if (instance) {
      return {
        state: instance.connectionStatus,
        connected: instance.connectionStatus === 'open',
      };
    }
    return { state: 'not_found', connected: false };
  } catch (error) {
    logger.error('[WhatsApp] Erro ao verificar status:', error);
    return { state: 'error', connected: false };
  }
}

/**
 * Configura o webhook da instância Evolution API
 */
export async function setupWebhook(webhookUrl: string): Promise<void> {
  try {
    await evolutionClient.post(`/webhook/set/${INSTANCE}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE',
        ],
      },
    });
    logger.info(`[WhatsApp] Webhook configurado: ${webhookUrl}`);
  } catch (error) {
    logger.error('[WhatsApp] Erro ao configurar webhook:', error);
    throw error;
  }
}
