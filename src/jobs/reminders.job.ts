import cron from 'node-cron';
import { logger } from '../config/logger';
import { prisma } from '../config/database';
import * as appointmentsRepo from '../modules/appointments/appointments.repository';
import * as notificationsService from '../modules/notifications/notifications.service';

/**
 * Inicializa todos os cron jobs de lembretes
 */
export function initReminderJobs(): void {
  // A cada 5 minutos: verifica lembretes e completa consultas passadas
  cron.schedule('*/5 * * * *', async () => {
    await runReminderJobs();
  });

  logger.info('[Cron] Jobs de lembrete iniciados (a cada 5 minutos)');
}

async function runReminderJobs(): Promise<void> {
  const settings = await prisma.systemSettings.findFirst();
  const clinicName = settings?.clinicName || 'Clínica Odontológica';
  const clinicPhone = settings?.clinicPhone || undefined;
  const clinicAddress = settings?.clinicAddress || undefined;

  await Promise.allSettled([
    markCompletedAppointments(),
    sendReminders24h(clinicName, clinicPhone),
    sendReminders2h(clinicName, clinicAddress),
    sendSatisfactionSurveys(clinicName),
  ]);
}

async function markCompletedAppointments(): Promise<void> {
  try {
    const updated = await appointmentsRepo.markAppointmentsAsCompleted();
    if (updated.count > 0) {
      logger.info(`[Cron] ${updated.count} consulta(s) marcada(s) como concluída(s)`);
    }
  } catch (error) {
    logger.error('[Cron] Erro ao marcar consultas como concluídas:', error);
  }
}

async function sendReminders24h(
  clinicName: string,
  clinicPhone?: string,
): Promise<void> {
  try {
    const appointments = await appointmentsRepo.getAppointmentsDueForReminder24h();

    for (const appointment of appointments) {
      try {
        await notificationsService.sendReminder24h(
          appointment,
          clinicName,
          clinicPhone,
        );
        await appointmentsRepo.markReminderSent24h(appointment.id);
        logger.info(`[Cron] Lembrete 24h enviado: ${appointment.id}`);
      } catch (err) {
        logger.error(`[Cron] Erro ao enviar lembrete 24h (${appointment.id}):`, err);
      }
    }
  } catch (error) {
    logger.error('[Cron] Erro no job de lembretes 24h:', error);
  }
}

async function sendReminders2h(
  clinicName: string,
  clinicAddress?: string,
): Promise<void> {
  try {
    const appointments = await appointmentsRepo.getAppointmentsDueForReminder2h();

    for (const appointment of appointments) {
      try {
        await notificationsService.sendReminder2h(
          appointment,
          clinicName,
          clinicAddress,
        );
        await appointmentsRepo.markReminderSent2h(appointment.id);
        logger.info(`[Cron] Lembrete 2h enviado: ${appointment.id}`);
      } catch (err) {
        logger.error(`[Cron] Erro ao enviar lembrete 2h (${appointment.id}):`, err);
      }
    }
  } catch (error) {
    logger.error('[Cron] Erro no job de lembretes 2h:', error);
  }
}

async function sendSatisfactionSurveys(clinicName: string): Promise<void> {
  try {
    const appointments = await appointmentsRepo.getAppointmentsDueForSurvey();

    for (const appointment of appointments) {
      try {
        await notificationsService.sendSatisfactionSurvey(appointment, clinicName);
        await appointmentsRepo.markSurveySent(appointment.id);
        logger.info(`[Cron] Pesquisa de satisfação enviada: ${appointment.id}`);
      } catch (err) {
        logger.error(`[Cron] Erro ao enviar pesquisa (${appointment.id}):`, err);
      }
    }
  } catch (error) {
    logger.error('[Cron] Erro no job de pesquisas de satisfação:', error);
  }
}
