import { google, calendar_v3 } from 'googleapis';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = env.TIMEZONE;

function getAuth() {
  // Prioridade 1: Service Account (produção)
  if (env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    const auth = new google.auth.JWT({
      email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    return auth;
  }

  // Prioridade 2: OAuth2 (desenvolvimento)
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    const oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI,
    );
    if (env.GOOGLE_REFRESH_TOKEN) {
      oauth2Client.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });
    }
    return oauth2Client;
  }

  throw new Error(
    'Nenhuma autenticação do Google configurada. Configure SERVICE_ACCOUNT ou OAUTH2.',
  );
}

export type TimeSlot = {
  start: string; // ISO string
  end: string;   // ISO string
  displayStart: string; // Ex: "14:00"
  displayDate: string;  // Ex: "Seg, 20 Jan"
};

/**
 * Retorna horários disponíveis para um dentista em uma data específica
 */
export async function getAvailableSlots(
  calendarId: string,
  date: string, // 'YYYY-MM-DD'
  durationMinutes: number,
  workingHours: { startTime: string; endTime: string } | null,
): Promise<TimeSlot[]> {
  if (!workingHours) return [];

  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  const startOfDay = dayjs.tz(`${date} ${workingHours.startTime}`, TIMEZONE);
  const endOfDay = dayjs.tz(`${date} ${workingHours.endTime}`, TIMEZONE);

  // Busca eventos ocupados no dia
  let busyPeriods: { start: string; end: string }[] = [];
  try {
    const freeBusyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        timeZone: TIMEZONE,
        items: [{ id: calendarId }],
      },
    });

    busyPeriods =
      (freeBusyResponse.data.calendars?.[calendarId]?.busy as {
        start: string;
        end: string;
      }[]) || [];
  } catch (error) {
    logger.error('Erro ao buscar freebusy do Google Calendar:', error);
    // Propaga o erro para o agent poder informar ao paciente
    throw new Error(`Falha ao consultar disponibilidade no Google Calendar: ${(error as Error).message}`);
  }

  // Gera slots de acordo com a duração
  const slots: TimeSlot[] = [];
  let currentSlot = startOfDay;
  const now = dayjs().tz(TIMEZONE); // referência de "agora" no fuso da clínica

  while (currentSlot.add(durationMinutes, 'minute').isBefore(endOfDay) ||
         currentSlot.add(durationMinutes, 'minute').isSame(endOfDay)) {
    const slotEnd = currentSlot.add(durationMinutes, 'minute');
    const slotStart = currentSlot;

    // Jamais exibe slots no passado (comparação no mesmo fuso da clínica)
    if (!slotStart.isAfter(now)) {
      currentSlot = currentSlot.add(30, 'minute');
      continue;
    }

    // Verifica conflito com períodos ocupados
    const hasConflict = busyPeriods.some((busy) => {
      const busyStart = dayjs(busy.start);
      const busyEnd = dayjs(busy.end);
      return (
        (slotStart.isBefore(busyEnd) && slotEnd.isAfter(busyStart))
      );
    });

    if (!hasConflict) {
      slots.push({
        start: slotStart.format(), // ISO com offset local ex: "2026-02-23T10:00:00-03:00"
        end: slotEnd.format(),
        displayStart: slotStart.format('HH:mm'),
        displayDate: slotStart.locale('pt-br').format('ddd, DD MMM'),
      });
    }

    currentSlot = currentSlot.add(30, 'minute'); // Incremento de 30 min
  }

  return slots;
}

/**
 * Cria um evento no Google Calendar
 */
export async function createCalendarEvent(
  calendarId: string,
  data: {
    summary: string;
    description: string;
    startTime: string; // ISO
    endTime: string;   // ISO
    patientName: string;
    patientPhone: string;
  },
): Promise<string | null> {
  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    // Converte para datetime local (sem Z/offset) para que o Google Calendar
    // interprete corretamente com o timeZone especificado.
    // Exemplo: "2026-02-23T09:00:00" + timeZone "America/Sao_Paulo" = 09h BRT
    const localStart = dayjs(data.startTime).tz(TIMEZONE).format('YYYY-MM-DDTHH:mm:ss');
    const localEnd = dayjs(data.endTime).tz(TIMEZONE).format('YYYY-MM-DDTHH:mm:ss');

    const event: calendar_v3.Schema$Event = {
      summary: `${data.summary} - ${data.patientName}`,
      description: `${data.description}\n\nPaciente: ${data.patientName}\nWhatsApp: ${data.patientPhone}`,
      start: {
        dateTime: localStart,
        timeZone: TIMEZONE,
      },
      end: {
        dateTime: localEnd,
        timeZone: TIMEZONE,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'email', minutes: 60 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    return response.data.id || null;
  } catch (error) {
    logger.error('Erro ao criar evento no Google Calendar:', error);
    return null;
  }
}

/**
 * Atualiza um evento no Google Calendar
 */
export async function updateCalendarEvent(
  calendarId: string,
  eventId: string,
  data: {
    startTime: string;
    endTime: string;
    summary?: string;
    description?: string;
  },
): Promise<boolean> {
  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    const localStart = dayjs(data.startTime).tz(TIMEZONE).format('YYYY-MM-DDTHH:mm:ss');
    const localEnd = dayjs(data.endTime).tz(TIMEZONE).format('YYYY-MM-DDTHH:mm:ss');

    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: {
        ...(data.summary ? { summary: data.summary } : {}),
        ...(data.description ? { description: data.description } : {}),
        start: { dateTime: localStart, timeZone: TIMEZONE },
        end: { dateTime: localEnd, timeZone: TIMEZONE },
      },
    });
    return true;
  } catch (error) {
    logger.error('Erro ao atualizar evento no Google Calendar:', error);
    return false;
  }
}

/**
 * Cancela (deleta) um evento no Google Calendar
 */
export async function deleteCalendarEvent(
  calendarId: string,
  eventId: string,
): Promise<boolean> {
  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    await calendar.events.delete({ calendarId, eventId });
    return true;
  } catch (error) {
    logger.error('Erro ao deletar evento no Google Calendar:', error);
    return false;
  }
}

/**
 * Verifica disponibilidade para próximos X dias e retorna slots disponíveis
 */
export async function getAvailableSlotsForDays(
  calendarId: string,
  durationMinutes: number,
  workingHoursByDay: { dayOfWeek: number; startTime: string; endTime: string }[],
  daysAhead: number = 14,
): Promise<{ date: string; slots: TimeSlot[] }[]> {
  const results: { date: string; slots: TimeSlot[] }[] = [];
  const today = dayjs().tz(TIMEZONE);

  for (let i = 0; i < daysAhead; i++) {
    const date = today.add(i, 'day');
    const dayOfWeek = date.day(); // 0=Dom, 6=Sab

    const wh = workingHoursByDay.find((h) => h.dayOfWeek === dayOfWeek);
    if (!wh || !wh.startTime) continue;

    const slots = await getAvailableSlots(
      calendarId,
      date.format('YYYY-MM-DD'),
      durationMinutes,
      wh,
    );

    if (slots.length > 0) {
      results.push({ date: date.format('YYYY-MM-DD'), slots });
    }

    // Para não sobrecarregar a API, limite a 5 dias com slots
    if (results.length >= 5) break;
  }

  return results;
}
