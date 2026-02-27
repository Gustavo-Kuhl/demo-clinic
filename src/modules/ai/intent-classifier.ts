import type { ConversationStage } from './tools';

export type QuickIntent = 'confirm' | 'deny' | 'unknown';

const YES = /^(sim|pode|ok|quero|confirma|confirmar|pode ser|isso|exato|certo|tá bom|ta bom|manda|faz|vai|yes|s|claro|ótimo|otimo|perfeito|fechado|feito)$/i;
const NO  = /^(não|nao|n|cancela|cancelar|desisto|quero não|quero nao|outro|outra|mudei|mudou|errei|volta|voltar|mudança|errado|não quero|nao quero)$/i;

/**
 * Classifies short user messages deterministically — no LLM needed.
 * Returns 'unknown' for long/ambiguous messages (delegates to LLM).
 */
export function classifyIntent(message: string, stage: ConversationStage): QuickIntent {
  const trimmed = message.trim();
  // Long messages are complex → LLM handles
  if (trimmed.length > 40) return 'unknown';

  const clean = trimmed.toLowerCase().replace(/[!?.…]+$/, '').trim();

  if (YES.test(clean)) return 'confirm';
  if (NO.test(clean))  return 'deny';
  return 'unknown';
}

/**
 * Detects conversation stage from the last assistant message text.
 * Uses regex/keywords — purely deterministic, no LLM.
 */
export function detectStage(lastBotMessage: string): ConversationStage {
  if (!lastBotMessage) return 'initial';
  const m = lastBotMessage.toLowerCase();

  // Pre-confirmation: bot showed booking summary and asked to confirm
  if (/posso confirmar|confirma o agendamento|você confirma|pode confirmar/.test(m)) {
    return 'pre_confirmation';
  }

  // Awaiting time: bot showed days, waiting for patient to pick one
  if (/qual.*horário|que horas|escolha.*horário|prefere.*horário|horários disponíveis/.test(m)) {
    return 'awaiting_time';
  }

  // Awaiting day: bot asked "para que dia"
  if (/para que dia|qual.*dia|que dia|informe o dia/.test(m)) {
    return 'awaiting_day';
  }

  // Cancel flow: bot listed appointments or asked for CPF for cancel/reschedule
  if (/cpf.*cancelar|cpf.*reagendar|cancelar.*cpf|confirmar.*cancelamento|confirme.*cpf/.test(m)) {
    return 'cancel_flow';
  }

  // Registration: bot asked for name/CPF for new patient
  if (/(nome completo|cpf).*(cadastr|informe|preciso|necessário|nos informe)|(informe|preciso).*(nome|cpf)/.test(m)) {
    return 'registration';
  }

  return 'initial';
}
