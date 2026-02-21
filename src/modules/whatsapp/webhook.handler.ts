import type { Request, Response } from 'express';
import { logger } from '../../config/logger';
import * as evolutionService from './evolution.service';
import * as agentService from '../ai/agent.service';
import * as adminBotService from '../admin/admin-bot.service';
import { prisma } from '../../config/database';
import { env } from '../../config/env';

// Evita processar a mesma mensagem duas vezes
const processedMessages = new Set<string>();

// Fila de debounce: agrupa mensagens rápidas do mesmo número antes de processar
const DEBOUNCE_MS = 10000;
const pendingQueues = new Map<string, {
  texts: string[];
  timer: ReturnType<typeof setTimeout>;
}>();

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
      id?: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      imageMessage?: { caption?: string };
      audioMessage?: object;
      stickerMessage?: object;
      documentMessage?: object;
    };
    messageType?: string;
    status?: string;
    pushName?: string;
  };
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  // Responde rapidamente para evitar timeout no Evolution API
  res.status(200).json({ status: 'ok' });

  const payload = req.body as EvolutionWebhookPayload;

  // Filtra apenas eventos de mensagens recebidas
  if (payload.event !== 'messages.upsert') return;
  if (!payload.data?.key) return;
  if (payload.data.key.fromMe) return; // Ignora mensagens enviadas pelo bot

  const remoteJid = payload.data.key.remoteJid || '';
  const messageId = payload.data.key.id || '';

  // Ignora grupos (JID com @g.us)
  if (remoteJid.includes('@g.us')) return;

  // Evita processar duplicatas
  if (processedMessages.has(messageId)) return;
  processedMessages.add(messageId);
  setTimeout(() => processedMessages.delete(messageId), 5 * 60 * 1000);

  // Extrai número do remetente (remove sufixo @s.whatsapp.net ou @c.us)
  const phone = remoteJid.split('@')[0];

  // Extrai o texto da mensagem
  const messageText = extractMessageText(payload.data.message);

  if (!messageText) {
    await evolutionService.sendTextMessage(
      phone,
      'Olá! 😊 No momento só consigo processar mensagens de texto. Por favor, me escreva o que precisa e terei prazer em ajudar!',
    );
    return;
  }

  logger.info(`[Webhook] Mensagem de ${phone}: "${messageText.substring(0, 50)}"`);

  // ─── Admin Bot ───
  const settings = await prisma.systemSettings.findFirst();
  const attendantPhone = settings?.attendantPhone || env.ATTENDANT_WHATSAPP;
  const attendantPhoneClean = attendantPhone?.replace(/\D/g, '') ?? '';
  logger.info(`[AdminBot] phone="${phone}" attendant="${attendantPhoneClean}" match=${phonesMatch(phone, attendantPhoneClean)}`);
  if (attendantPhoneClean && phonesMatch(phone, attendantPhoneClean)) {
    await evolutionService.markAsRead(messageId);
    try {
      const response = await adminBotService.handleAdminCommand(messageText);
      await evolutionService.sendTextMessage(phone, response);
    } catch (error) {
      logger.error('[AdminBot] Erro ao processar comando:', error);
      await evolutionService.sendTextMessage(phone, '❌ Erro ao processar o comando. Tente novamente.');
    }
    return;
  }

  // Verifica se conversa está escalada para humano
  const activeConversation = await prisma.conversation.findFirst({
    where: { patient: { phone }, status: 'ESCALATED' },
  });

  if (activeConversation) {
    logger.info(`[Webhook] Conversa escalada para humano - não responde automaticamente`);
    return;
  }

  // Marca como lida imediatamente (feedback visual ao usuário)
  await evolutionService.markAsRead(messageId);

  // ─── Debounce: acumula mensagens rápidas e processa em lote ───
  const existing = pendingQueues.get(phone);

  if (existing) {
    // Já existe uma fila para este número — cancela o timer anterior e adiciona a mensagem
    clearTimeout(existing.timer);
    existing.texts.push(messageText);
    logger.info(`[Debounce] Mensagem adicionada à fila de ${phone} (${existing.texts.length} mensagens)`);
  }

  const texts = existing ? existing.texts : [messageText];

  const timer = setTimeout(async () => {
    pendingQueues.delete(phone);
    const combined = texts.join('\n');
    logger.info(`[Debounce] Processando ${texts.length} mensagem(s) de ${phone}: "${combined.substring(0, 80)}"`);
    await processAndRespond(phone, combined);
  }, DEBOUNCE_MS);

  pendingQueues.set(phone, { texts, timer });
}

async function processAndRespond(phone: string, messageText: string): Promise<void> {
  await evolutionService.sendTyping(phone, 2000);

  try {
    const response = await agentService.processMessage(phone, messageText);

    // Divide em partes pelo marcador [PAUSA] e envia cada uma separadamente
    const parts = response.split('[PAUSA]').map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const typingMs = Math.min(part.length * 25, 3500);
      await delay(800);
      await evolutionService.sendTyping(phone, typingMs);
      await delay(typingMs);
      await evolutionService.sendTextMessage(phone, part);
    }

    // Verifica se o agente escalou e notifica o atendente
    const escalation = await prisma.humanEscalation.findFirst({
      where: {
        conversation: { patient: { phone } },
        status: 'PENDING',
        createdAt: { gte: new Date(Date.now() - 5000) },
      },
      include: { conversation: { include: { patient: true } } },
    });

    if (escalation) {
      await notifyAttendant(phone, escalation.reason || 'Solicitação do paciente');
    }
  } catch (error) {
    logger.error(`[Webhook] Erro ao processar mensagem de ${phone}:`, error);
    await evolutionService.sendTextMessage(
      phone,
      'Desculpe, tive um problema técnico momentâneo. Por favor, tente novamente em alguns instantes. 😊',
    );
  }
}

function extractMessageText(
  message: EvolutionWebhookPayload['data']['message'],
): string | null {
  if (!message) return null;

  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    null
  );
}

async function notifyAttendant(
  patientPhone: string,
  reason: string,
): Promise<void> {
  const settings = await prisma.systemSettings.findFirst();
  const attendantPhone = settings?.attendantPhone || process.env.ATTENDANT_WHATSAPP;

  if (!attendantPhone) return;

  const message = [
    '🔔 *Nova solicitação de atendimento humano*',
    '',
    `👤 Paciente: ${patientPhone}`,
    `📝 Motivo: ${reason}`,
    '',
    'Por favor, entre em contato com o paciente.',
  ].join('\n');

  await evolutionService.sendTextMessage(attendantPhone, message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Compara dois números de telefone tolerando a migração brasileira de 8→9 dígitos.
 */
function phonesMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const add9 = (p: string) =>
    /^55\d{10}$/.test(p) ? `55${p.slice(2, 4)}9${p.slice(4)}` : p;
  return add9(a) === b || a === add9(b) || add9(a) === add9(b);
}
