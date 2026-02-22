import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import * as appointmentsRepo from './appointments.repository';
import * as dentistsRepo from '../dentists/dentists.repository';
import * as proceduresRepo from '../procedures/procedures.repository';
import * as calendarService from '../calendar/google-calendar.service';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { prisma } from '../../config/database';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = env.TIMEZONE;

export type BookingResult =
  | { success: true; appointment: Awaited<ReturnType<typeof appointmentsRepo.createAppointment>> }
  | { success: false; error: string };

/**
 * Agenda uma nova consulta
 */
export async function scheduleAppointment(data: {
  patientId: string;
  dentistId: string;
  procedureId: string;
  startTime: string; // ISO string
  notes?: string;
}): Promise<BookingResult> {
  const dentist = await dentistsRepo.getDentistById(data.dentistId);
  if (!dentist || !dentist.active) {
    return { success: false, error: 'Dentista não encontrado ou inativo.' };
  }

  const procedure = await proceduresRepo.getProcedureById(data.procedureId);
  if (!procedure || !procedure.active) {
    return { success: false, error: 'Procedimento não encontrado ou inativo.' };
  }

  const startTime = dayjs(data.startTime).tz(TIMEZONE);
  const endTime = startTime.add(procedure.durationMinutes, 'minute');

  if (startTime.isBefore(dayjs())) {
    return { success: false, error: 'A data/hora selecionada já passou.' };
  }

  // Busca dados do paciente para o evento do Calendar
  const patient = await prisma.patient.findUnique({ where: { id: data.patientId } });

  // Criar evento no Google Calendar
  let googleEventId: string | null = null;
  try {
    googleEventId = await calendarService.createCalendarEvent(
      dentist.calendarId,
      {
        summary: procedure.name,
        description: `Procedimento: ${procedure.name}\nDuração: ${procedure.durationMinutes} minutos`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        patientName: patient?.name || 'Paciente via WhatsApp',
        patientPhone: patient?.phone || '',
      },
    );
  } catch (err) {
    logger.warn('Não foi possível criar evento no Calendar, salvando sem evento:', err);
  }

  const appointment = await appointmentsRepo.createAppointment({
    patientId: data.patientId,
    dentistId: data.dentistId,
    procedureId: data.procedureId,
    startTime: startTime.toDate(),
    endTime: endTime.toDate(),
    googleEventId: googleEventId || undefined,
    notes: data.notes,
  });

  return { success: true, appointment };
}

/**
 * Cancela uma consulta
 */
export async function cancelAppointment(
  appointmentId: string,
  patientId: string,
): Promise<{ success: boolean; error?: string }> {
  const appointment = await appointmentsRepo.getAppointmentById(appointmentId);

  if (!appointment) {
    return { success: false, error: 'Agendamento não encontrado.' };
  }

  if (appointment.patientId !== patientId) {
    return { success: false, error: 'Você não tem permissão para cancelar este agendamento.' };
  }

  if (appointment.status === 'COMPLETED') {
    return { success: false, error: 'Não é possível cancelar uma consulta já realizada.' };
  }

  // Remover do Google Calendar
  if (appointment.googleEventId && appointment.dentist.calendarId) {
    await calendarService.deleteCalendarEvent(
      appointment.dentist.calendarId,
      appointment.googleEventId,
    );
  }

  await appointmentsRepo.deleteAppointmentById(appointmentId);

  return { success: true };
}

/**
 * Reagenda uma consulta
 */
export async function rescheduleAppointment(
  appointmentId: string,
  patientId: string,
  newStartTime: string,
): Promise<BookingResult> {
  const appointment = await appointmentsRepo.getAppointmentById(appointmentId);

  if (!appointment) {
    return { success: false, error: 'Agendamento não encontrado.' };
  }

  if (appointment.patientId !== patientId) {
    return { success: false, error: 'Você não tem permissão para reagendar este agendamento.' };
  }

  if (['CANCELLED', 'COMPLETED'].includes(appointment.status)) {
    return {
      success: false,
      error: 'Não é possível reagendar este agendamento.',
    };
  }

  const newStart = dayjs(newStartTime).tz(TIMEZONE);
  const newEnd = newStart.add(appointment.procedure.durationMinutes, 'minute');

  if (newStart.isBefore(dayjs())) {
    return { success: false, error: 'A nova data/hora já passou.' };
  }

  let newGoogleEventId = appointment.googleEventId;

  // Atualizar no Google Calendar
  if (appointment.googleEventId && appointment.dentist.calendarId) {
    const updated = await calendarService.updateCalendarEvent(
      appointment.dentist.calendarId,
      appointment.googleEventId,
      {
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
      },
    );

    if (!updated) {
      // Se falhar a atualização, tenta criar novo e deleta o antigo
      const newEventId = await calendarService.createCalendarEvent(
        appointment.dentist.calendarId,
        {
          summary: appointment.procedure.name,
          description: `Procedimento: ${appointment.procedure.name} (reagendado)`,
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
          patientName: appointment.patient.name || 'Paciente',
          patientPhone: appointment.patient.phone,
        },
      );
      if (newEventId) {
        await calendarService.deleteCalendarEvent(
          appointment.dentist.calendarId,
          appointment.googleEventId,
        );
        newGoogleEventId = newEventId;
      }
    }
  }

  const updated = await appointmentsRepo.rescheduleAppointment(
    appointmentId,
    newStart.toDate(),
    newEnd.toDate(),
    newGoogleEventId || undefined,
  );

  return { success: true, appointment: updated };
}

/**
 * Busca agendamentos futuros de um paciente
 */
export async function getPatientUpcomingAppointments(patientId: string) {
  return appointmentsRepo.getUpcomingAppointmentsByPatient(patientId);
}

/**
 * Formata uma consulta para exibição no WhatsApp
 */
export function formatAppointmentForDisplay(
  appointment: Awaited<ReturnType<typeof appointmentsRepo.getAppointmentById>>,
): string {
  if (!appointment) return '';

  const start = dayjs(appointment.startTime).tz(TIMEZONE);
  const dayOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][start.day()];
  const month = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][start.month()];

  return [
    `📋 *${appointment.procedure.name}*`,
    `👨‍⚕️ ${appointment.dentist.name}${appointment.dentist.specialty ? ` (${appointment.dentist.specialty})` : ''}`,
    `📅 ${dayOfWeek}, ${start.date()} de ${month} de ${start.year()}`,
    `🕐 ${start.format('HH:mm')}`,
    `⏱️ Duração: ${appointment.procedure.durationMinutes} min`,
    `🆔 ID: \`${appointment.id.slice(-8)}\``,
  ].join('\n');
}
