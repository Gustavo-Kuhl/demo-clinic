import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { adminAuth } from '../modules/admin/admin.middleware';
import * as dentistsRepo from '../modules/dentists/dentists.repository';
import * as proceduresRepo from '../modules/procedures/procedures.repository';
import * as appointmentsRepo from '../modules/appointments/appointments.repository';
import * as appointmentsService from '../modules/appointments/appointments.service';
import * as calendarService from '../modules/calendar/google-calendar.service';
import { getInstanceStatus } from '../modules/whatsapp/evolution.service';
import { isValidCpf } from '../utils/cpf';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const router = Router();

// ========================
// AUTH
// ========================
router.post('/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };

  const user = await prisma.adminUser.findUnique({ where: { username } });
  if (!user) {
    res.status(401).json({ error: 'Credenciais inválidas.' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Credenciais inválidas.' });
    return;
  }

  const token = jwt.sign(
    { username: user.username },
    env.JWT_SECRET,
    { expiresIn: '7d' },
  );

  res.json({ token, username: user.username });
});

// ========================
// DASHBOARD
// ========================
router.get('/dashboard', adminAuth, async (_req: Request, res: Response) => {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    totalAppointmentsToday,
    totalAppointmentsMonth,
    pendingEscalations,
    upcomingAppointments,
    whatsappStatus,
  ] = await Promise.all([
    prisma.appointment.count({
      where: { startTime: { gte: startOfDay, lte: endOfDay }, status: 'SCHEDULED' },
    }),
    prisma.appointment.count({
      where: { startTime: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
    }),
    prisma.humanEscalation.count({ where: { status: 'PENDING' } }),
    prisma.appointment.findMany({
      where: {
        startTime: { gte: new Date() },
        status: 'SCHEDULED',
      },
      include: { patient: true, dentist: true, procedure: true },
      orderBy: { startTime: 'asc' },
      take: 10,
    }),
    getInstanceStatus(),
  ]);

  res.json({
    stats: {
      appointmentsToday: totalAppointmentsToday,
      appointmentsMonth: totalAppointmentsMonth,
      pendingEscalations,
    },
    upcomingAppointments,
    whatsappStatus,
  });
});

// ========================
// DENTISTAS
// ========================
router.get('/dentists', adminAuth, async (_req: Request, res: Response) => {
  const dentists = await dentistsRepo.getAllDentists(false);
  res.json(dentists);
});

router.post('/dentists', adminAuth, async (req: Request, res: Response) => {
  const { name, specialty, calendarId, phone, email, bio } = req.body as {
    name: string;
    specialty?: string;
    calendarId: string;
    phone?: string;
    email?: string;
    bio?: string;
  };

  if (!name || !calendarId) {
    res.status(400).json({ error: 'Nome e calendarId são obrigatórios.' });
    return;
  }

  const dentist = await dentistsRepo.createDentist({
    name, specialty, calendarId, phone, email, bio,
  });
  res.status(201).json(dentist);
});

router.put('/dentists/:id', adminAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const dentist = await dentistsRepo.updateDentist(id, req.body);
  res.json(dentist);
});

router.post('/dentists/:id/working-hours', adminAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { dayOfWeek, startTime, endTime, active } = req.body as {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    active?: boolean;
  };

  const wh = await dentistsRepo.upsertWorkingHours(id, dayOfWeek, startTime, endTime, active ?? true);
  res.json(wh);
});

router.post('/dentists/:id/procedures/:procedureId', adminAuth, async (req: Request, res: Response) => {
  const { id, procedureId } = req.params;
  await dentistsRepo.linkDentistProcedure(id, procedureId);
  res.json({ success: true });
});

router.delete('/dentists/:id/procedures/:procedureId', adminAuth, async (req: Request, res: Response) => {
  const { id, procedureId } = req.params;
  await dentistsRepo.unlinkDentistProcedure(id, procedureId);
  res.json({ success: true });
});

// ========================
// PROCEDIMENTOS
// ========================
router.get('/procedures', adminAuth, async (_req: Request, res: Response) => {
  const procedures = await proceduresRepo.getAllProcedures(false);
  res.json(procedures);
});

router.post('/procedures', adminAuth, async (req: Request, res: Response) => {
  const { name, description, durationMinutes, price } = req.body as {
    name: string;
    description?: string;
    durationMinutes: number;
    price?: number;
  };

  if (!name || !durationMinutes) {
    res.status(400).json({ error: 'Nome e duração são obrigatórios.' });
    return;
  }

  const procedure = await proceduresRepo.createProcedure({
    name, description, durationMinutes, price,
  });
  res.status(201).json(procedure);
});

router.put('/procedures/:id', adminAuth, async (req: Request, res: Response) => {
  const procedure = await proceduresRepo.updateProcedure(req.params.id, req.body);
  res.json(procedure);
});

// ========================
// AGENDAMENTOS
// ========================
router.get('/appointments', adminAuth, async (req: Request, res: Response) => {
  const { startDate, endDate, dentistId, status } = req.query as {
    startDate?: string;
    endDate?: string;
    dentistId?: string;
    status?: string;
  };

  const appointments = await appointmentsRepo.getAllAppointments({
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    dentistId,
    status: status as any,
  });

  res.json(appointments);
});

router.patch('/appointments/:id/status', adminAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body as { status: string };
  const updated = await appointmentsRepo.updateAppointmentStatus(id, status as any);
  res.json(updated);
});

router.post('/appointments', adminAuth, async (req: Request, res: Response) => {
  const { patientId, dentistId, procedureId, startTime, notes } = req.body as {
    patientId: string;
    dentistId: string;
    procedureId: string;
    startTime: string;
    notes?: string;
  };

  if (!patientId || !dentistId || !procedureId || !startTime) {
    res.status(400).json({ error: 'patientId, dentistId, procedureId e startTime são obrigatórios.' });
    return;
  }

  const result = await appointmentsService.scheduleAppointment({ patientId, dentistId, procedureId, startTime, notes });
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json(result.appointment);
});

router.patch('/appointments/:id/cancel', adminAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const appointment = await appointmentsRepo.getAppointmentById(id);

  if (!appointment) { res.status(404).json({ error: 'Agendamento não encontrado.' }); return; }
  if (appointment.status === 'COMPLETED') { res.status(400).json({ error: 'Não é possível cancelar uma consulta concluída.' }); return; }

  if (appointment.googleEventId && appointment.dentist.calendarId) {
    await calendarService.deleteCalendarEvent(appointment.dentist.calendarId, appointment.googleEventId);
  }

  await appointmentsRepo.deleteAppointmentById(id);
  res.json({ success: true });
});

router.patch('/appointments/:id/reschedule', adminAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newStartTime } = req.body as { newStartTime: string };

  if (!newStartTime) { res.status(400).json({ error: 'newStartTime é obrigatório.' }); return; }

  const appointment = await appointmentsRepo.getAppointmentById(id);
  if (!appointment) { res.status(404).json({ error: 'Agendamento não encontrado.' }); return; }
  if (['CANCELLED', 'COMPLETED'].includes(appointment.status)) {
    res.status(400).json({ error: 'Não é possível reagendar este agendamento.' }); return;
  }

  const TIMEZONE = env.TIMEZONE;
  const newStart = dayjs(newStartTime).tz(TIMEZONE);
  const newEnd = newStart.add(appointment.procedure.durationMinutes, 'minute');

  if (newStart.isBefore(dayjs())) { res.status(400).json({ error: 'A nova data/hora já passou.' }); return; }

  let newGoogleEventId = appointment.googleEventId;

  if (appointment.dentist.calendarId) {
    if (appointment.googleEventId) {
      const ok = await calendarService.updateCalendarEvent(appointment.dentist.calendarId, appointment.googleEventId, {
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
      });
      if (!ok) {
        const newId = await calendarService.createCalendarEvent(appointment.dentist.calendarId, {
          summary: appointment.procedure.name,
          description: `Procedimento: ${appointment.procedure.name} (reagendado pelo admin)`,
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
          patientName: appointment.patient.name || 'Paciente',
          patientPhone: appointment.patient.phone,
        });
        if (newId) {
          await calendarService.deleteCalendarEvent(appointment.dentist.calendarId, appointment.googleEventId);
          newGoogleEventId = newId;
        }
      }
    } else {
      const newId = await calendarService.createCalendarEvent(appointment.dentist.calendarId, {
        summary: appointment.procedure.name,
        description: `Procedimento: ${appointment.procedure.name}`,
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
        patientName: appointment.patient.name || 'Paciente',
        patientPhone: appointment.patient.phone,
      });
      newGoogleEventId = newId;
    }
  }

  const updated = await appointmentsRepo.rescheduleAppointment(id, newStart.toDate(), newEnd.toDate(), newGoogleEventId || undefined);
  res.json(updated);
});

router.get('/available-slots', adminAuth, async (req: Request, res: Response) => {
  const { dentistId, procedureId, daysAhead } = req.query as {
    dentistId?: string;
    procedureId?: string;
    daysAhead?: string;
  };

  if (!dentistId || !procedureId) {
    res.status(400).json({ error: 'dentistId e procedureId são obrigatórios.' });
    return;
  }

  const dentist = await dentistsRepo.getDentistById(dentistId);
  const procedure = await proceduresRepo.getProcedureById(procedureId);

  if (!dentist || !procedure) { res.status(404).json({ error: 'Dentista ou procedimento não encontrado.' }); return; }

  const workingHoursByDay = dentist.workingHours
    .filter((wh) => wh.active)
    .map((wh) => ({ dayOfWeek: wh.dayOfWeek, startTime: wh.startTime, endTime: wh.endTime }));

  const slots = await calendarService.getAvailableSlotsForDays(
    dentist.calendarId,
    procedure.durationMinutes,
    workingHoursByDay,
    Math.min(parseInt(daysAhead || '14'), 30),
  );

  res.json(slots);
});

// ========================
// ESCALAÇÕES
// ========================
router.get('/escalations', adminAuth, async (_req: Request, res: Response) => {
  const escalations = await prisma.humanEscalation.findMany({
    where: { status: 'PENDING' },
    include: {
      conversation: {
        include: {
          patient: true,
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 5,
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(escalations);
});

router.patch('/escalations/:id/resolve', adminAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const escalation = await prisma.humanEscalation.update({
    where: { id },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
  });

  // Reativa a conversa para o bot
  await prisma.conversation.update({
    where: { id: escalation.conversationId },
    data: { status: 'ACTIVE' },
  });

  res.json(escalation);
});

// ========================
// FAQ
// ========================
router.get('/faqs', adminAuth, async (_req: Request, res: Response) => {
  const faqs = await prisma.fAQ.findMany({ orderBy: [{ category: 'asc' }, { order: 'asc' }] });
  res.json(faqs);
});

router.post('/faqs', adminAuth, async (req: Request, res: Response) => {
  const faq = await prisma.fAQ.create({ data: req.body });
  res.status(201).json(faq);
});

router.put('/faqs/:id', adminAuth, async (req: Request, res: Response) => {
  const faq = await prisma.fAQ.update({ where: { id: req.params.id }, data: req.body });
  res.json(faq);
});

router.delete('/faqs/:id', adminAuth, async (req: Request, res: Response) => {
  await prisma.fAQ.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ========================
// CONFIGURAÇÕES
// ========================
router.get('/settings', adminAuth, async (_req: Request, res: Response) => {
  const settings = await prisma.systemSettings.findFirst();
  res.json(settings);
});

router.put('/settings', adminAuth, async (req: Request, res: Response) => {
  const settings = await prisma.systemSettings.findFirst();

  if (settings) {
    const updated = await prisma.systemSettings.update({
      where: { id: settings.id },
      data: req.body,
    });
    res.json(updated);
  } else {
    const created = await prisma.systemSettings.create({ data: req.body });
    res.json(created);
  }
});

// ========================
// PACIENTES
// ========================
router.get('/patients', adminAuth, async (req: Request, res: Response) => {
  const { search } = req.query as { search?: string };
  const patients = await prisma.patient.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }
      : undefined,
    include: {
      _count: { select: { appointments: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(patients);
});

router.get('/patients/:id/appointments', adminAuth, async (req: Request, res: Response) => {
  const appointments = await appointmentsRepo.getAppointmentsByPatient(req.params.id);
  res.json(appointments);
});

router.patch('/patients/:id', adminAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, cpf, email, phone } = req.body as {
    name?: string;
    cpf?: string;
    email?: string;
    phone?: string;
  };

  const data: Record<string, string | null | undefined> = {};
  if (name !== undefined) data.name = name || null;
  if (email !== undefined) data.email = email || null;
  if (phone !== undefined) data.phone = phone;
  if (cpf !== undefined) {
    const cleanCpf = cpf ? cpf.replace(/\D/g, '') : '';
    if (cleanCpf) {
      if (!isValidCpf(cleanCpf)) {
        res.status(400).json({ error: 'CPF inválido. Verifique o número informado (deve ter 11 dígitos).' });
        return;
      }
      const existing = await prisma.patient.findFirst({ where: { cpf: cleanCpf, NOT: { id } } });
      if (existing) {
        res.status(400).json({ error: 'Este CPF já está cadastrado para outro paciente.' });
        return;
      }
      data.cpf = cleanCpf;
    } else {
      data.cpf = null;
    }
  }

  const patient = await prisma.patient.update({ where: { id }, data });
  res.json(patient);
});

router.delete('/patients/:id', adminAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) {
    res.status(404).json({ error: 'Paciente não encontrado.' });
    return;
  }

  const convs = await prisma.conversation.findMany({ where: { patientId: id }, select: { id: true } });
  const convIds = convs.map(c => c.id);

  await prisma.$transaction([
    prisma.appointment.deleteMany({ where: { patientId: id } }),
    prisma.humanEscalation.deleteMany({ where: { conversationId: { in: convIds } } }),
    prisma.conversation.deleteMany({ where: { patientId: id } }),
    prisma.patient.delete({ where: { id } }),
  ]);

  res.json({ success: true });
});

export default router;
