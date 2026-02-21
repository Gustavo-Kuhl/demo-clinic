import { AppointmentStatus } from '@prisma/client';
import { prisma } from '../../config/database';

export async function createAppointment(data: {
  patientId: string;
  dentistId: string;
  procedureId: string;
  startTime: Date;
  endTime: Date;
  googleEventId?: string;
  notes?: string;
}) {
  return prisma.appointment.create({
    data,
    include: {
      patient: true,
      dentist: true,
      procedure: true,
    },
  });
}

export async function getAppointmentsByPatient(
  patientId: string,
  status?: AppointmentStatus,
) {
  return prisma.appointment.findMany({
    where: {
      patientId,
      ...(status ? { status } : {}),
    },
    include: {
      dentist: true,
      procedure: true,
    },
    orderBy: { startTime: 'asc' },
  });
}

export async function getUpcomingAppointmentsByPatient(patientId: string) {
  return prisma.appointment.findMany({
    where: {
      patientId,
      status: 'SCHEDULED',
      startTime: { gte: new Date() },
    },
    include: {
      dentist: true,
      procedure: true,
    },
    orderBy: { startTime: 'asc' },
  });
}

export async function getAppointmentById(id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    include: {
      patient: true,
      dentist: true,
      procedure: true,
    },
  });
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
) {
  return prisma.appointment.update({
    where: { id },
    data: { status },
    include: {
      patient: true,
      dentist: true,
      procedure: true,
    },
  });
}

export async function rescheduleAppointment(
  id: string,
  startTime: Date,
  endTime: Date,
  googleEventId?: string,
) {
  return prisma.appointment.update({
    where: { id },
    data: {
      startTime,
      endTime,
      googleEventId,
      status: 'SCHEDULED',
      reminderSent24h: false,
      reminderSent2h: false,
    },
    include: {
      patient: true,
      dentist: true,
      procedure: true,
    },
  });
}

export async function getAppointmentsDueForReminder24h() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);

  return prisma.appointment.findMany({
    where: {
      status: 'SCHEDULED',
      reminderSent24h: false,
      startTime: { gte: in23h, lte: in24h },
    },
    include: { patient: true, dentist: true, procedure: true },
  });
}

export async function getAppointmentsDueForReminder2h() {
  const now = new Date();
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const in1h30 = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);

  return prisma.appointment.findMany({
    where: {
      status: 'SCHEDULED',
      reminderSent2h: false,
      startTime: { gte: in1h30, lte: in2h },
    },
    include: { patient: true, dentist: true, procedure: true },
  });
}

export async function getAppointmentsDueForSurvey() {
  const now = new Date();
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  return prisma.appointment.findMany({
    where: {
      status: 'COMPLETED',
      surveySent: false,
      endTime: { gte: sixHoursAgo, lte: threeHoursAgo },
    },
    include: { patient: true, dentist: true, procedure: true },
  });
}

export async function markReminderSent24h(id: string) {
  return prisma.appointment.update({
    where: { id },
    data: { reminderSent24h: true },
  });
}

export async function markReminderSent2h(id: string) {
  return prisma.appointment.update({
    where: { id },
    data: { reminderSent2h: true },
  });
}

export async function markSurveySent(id: string) {
  return prisma.appointment.update({
    where: { id },
    data: { surveySent: true },
  });
}

export async function markAppointmentsAsCompleted() {
  const now = new Date();
  return prisma.appointment.updateMany({
    where: {
      status: 'SCHEDULED',
      endTime: { lte: now },
    },
    data: { status: 'COMPLETED' },
  });
}

export async function getAllAppointments(filters?: {
  startDate?: Date;
  endDate?: Date;
  dentistId?: string;
  status?: AppointmentStatus;
}) {
  return prisma.appointment.findMany({
    where: {
      ...(filters?.dentistId ? { dentistId: filters.dentistId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.startDate || filters?.endDate
        ? {
            startTime: {
              ...(filters.startDate ? { gte: filters.startDate } : {}),
              ...(filters.endDate ? { lte: filters.endDate } : {}),
            },
          }
        : {}),
    },
    include: {
      patient: true,
      dentist: true,
      procedure: true,
    },
    orderBy: { startTime: 'desc' },
  });
}
