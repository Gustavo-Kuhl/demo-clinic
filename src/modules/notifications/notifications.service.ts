import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/pt-br';
import * as evolutionService from '../whatsapp/evolution.service';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('pt-br');

const TIMEZONE = env.TIMEZONE;

type AppointmentWithRelations = {
  id: string;
  startTime: Date;
  endTime: Date;
  patient: { phone: string; name: string | null };
  dentist: { name: string; specialty: string | null };
  procedure: { name: string; durationMinutes: number };
};

/**
 * Formata uma data para exibição amigável em PT-BR
 */
function formatDate(date: Date): string {
  const d = dayjs(date).tz(TIMEZONE);
  const days = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${days[d.day()]}, ${d.date()} de ${months[d.month()]} às ${d.format('HH:mm')}`;
}

/**
 * Envia mensagem de confirmação de agendamento
 */
export async function sendBookingConfirmation(
  appointment: AppointmentWithRelations,
  clinicName: string,
  clinicAddress?: string,
): Promise<void> {
  const { patient, dentist, procedure, startTime } = appointment;
  const formattedDate = formatDate(startTime);
  const patientName = patient.name ? patient.name.split(' ')[0] : 'você';

  const message = [
    `✅ *Consulta confirmada, ${patientName}!*`,
    '',
    `📋 *${procedure.name}*`,
    `👨‍⚕️ ${dentist.name}${dentist.specialty ? ` (${dentist.specialty})` : ''}`,
    `📅 ${formattedDate}`,
    `⏱️ Duração aproximada: ${procedure.durationMinutes} minutos`,
    '',
    clinicAddress ? `📍 *Local:* ${clinicAddress}` : '',
    '',
    '💡 *Lembretes importantes:*',
    '• Chegue 10 minutos antes do horário',
    '• Traga um documento com foto',
    '• Informe medicamentos em uso',
    '',
    'Para cancelar ou reagendar, é só me chamar aqui! 😊',
    '',
    `_${clinicName}_`,
  ]
    .filter((line) => line !== null && line !== undefined)
    .join('\n');

  await evolutionService.sendTextMessage(patient.phone, message);
  logger.info(`[Notificação] Confirmação enviada para ${patient.phone}`);
}

/**
 * Envia lembrete 24h antes da consulta
 */
export async function sendReminder24h(
  appointment: AppointmentWithRelations,
  clinicName: string,
  clinicPhone?: string,
): Promise<void> {
  const { patient, dentist, procedure, startTime } = appointment;
  const formattedDate = formatDate(startTime);
  const patientName = patient.name ? patient.name.split(' ')[0] : 'você';

  const message = [
    `⏰ *Lembrete de consulta, ${patientName}!*`,
    '',
    'Sua consulta é *amanhã*! Não esqueça 😊',
    '',
    `📋 *${procedure.name}*`,
    `👨‍⚕️ ${dentist.name}`,
    `📅 ${formattedDate}`,
    '',
    'Precisa cancelar ou reagendar? É só me chamar!',
    clinicPhone ? `📞 Também pode ligar: *${clinicPhone}*` : '',
    '',
    `_${clinicName}_`,
  ]
    .filter(Boolean)
    .join('\n');

  await evolutionService.sendTextMessage(patient.phone, message);
  logger.info(`[Notificação] Lembrete 24h enviado para ${patient.phone}`);
}

/**
 * Envia lembrete 2h antes da consulta
 */
export async function sendReminder2h(
  appointment: AppointmentWithRelations,
  clinicName: string,
  clinicAddress?: string,
): Promise<void> {
  const { patient, dentist, procedure, startTime } = appointment;
  const time = dayjs(startTime).tz(TIMEZONE).format('HH:mm');
  const patientName = patient.name ? patient.name.split(' ')[0] : 'você';

  const message = [
    `🕐 *Sua consulta é em 2 horas, ${patientName}!*`,
    '',
    `📋 ${procedure.name} com ${dentist.name}`,
    `🕐 Hoje às *${time}*`,
    '',
    clinicAddress ? `📍 ${clinicAddress}` : '',
    '',
    'Lembre de chegar 10 minutinhos antes! Até já! 😊',
    '',
    `_${clinicName}_`,
  ]
    .filter(Boolean)
    .join('\n');

  await evolutionService.sendTextMessage(patient.phone, message);
  logger.info(`[Notificação] Lembrete 2h enviado para ${patient.phone}`);
}

/**
 * Envia pesquisa de satisfação pós-consulta
 */
export async function sendSatisfactionSurvey(
  appointment: AppointmentWithRelations,
  clinicName: string,
): Promise<void> {
  const { patient, dentist } = appointment;
  const patientName = patient.name ? patient.name.split(' ')[0] : 'você';

  const message = [
    `💙 *Olá, ${patientName}! Tudo bem com você?*`,
    '',
    `Espero que sua consulta com o ${dentist.name} tenha corrido muito bem! 😊`,
    '',
    'Sua opinião é super importante para nós. Como foi sua experiência hoje?',
    '',
    '⭐ De 1 a 5, como você avalia nosso atendimento?',
    '_(1 = Ruim | 5 = Excelente)_',
    '',
    'Fique à vontade para comentar também! Seu feedback nos ajuda a melhorar cada vez mais. 🙏',
    '',
    `_${clinicName}_`,
  ].join('\n');

  await evolutionService.sendTextMessage(patient.phone, message);
  logger.info(`[Notificação] Pesquisa de satisfação enviada para ${patient.phone}`);
}

/**
 * Envia notificação de cancelamento
 */
export async function sendCancellationNotice(
  appointment: AppointmentWithRelations,
  clinicName: string,
): Promise<void> {
  const { patient, dentist, procedure, startTime } = appointment;
  const formattedDate = formatDate(startTime);
  const patientName = patient.name ? patient.name.split(' ')[0] : 'você';

  const message = [
    `❌ *Consulta cancelada, ${patientName}*`,
    '',
    `A seguinte consulta foi cancelada:`,
    `📋 ${procedure.name}`,
    `👨‍⚕️ ${dentist.name}`,
    `📅 ${formattedDate}`,
    '',
    'Se mudar de ideia, é só me chamar para reagendar! Estamos aqui. 😊',
    '',
    `_${clinicName}_`,
  ].join('\n');

  await evolutionService.sendTextMessage(patient.phone, message);
}
