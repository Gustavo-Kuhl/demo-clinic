import { prisma } from '../../config/database';

export async function getAllDentists(activeOnly = true) {
  return prisma.dentist.findMany({
    where: activeOnly ? { active: true } : undefined,
    include: {
      workingHours: true,
      dentistProcedures: {
        include: { procedure: true },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getDentistById(id: string) {
  return prisma.dentist.findUnique({
    where: { id },
    include: {
      workingHours: true,
      dentistProcedures: {
        include: { procedure: true },
      },
    },
  });
}

export async function getDentistsBySpecialty(specialty: string) {
  return prisma.dentist.findMany({
    where: {
      active: true,
      specialty: { contains: specialty, mode: 'insensitive' },
    },
    include: {
      workingHours: true,
      dentistProcedures: {
        include: { procedure: true },
      },
    },
  });
}

export async function createDentist(data: {
  name: string;
  specialty?: string;
  calendarId: string;
  phone?: string;
  email?: string;
  bio?: string;
}) {
  return prisma.dentist.create({ data });
}

export async function updateDentist(
  id: string,
  data: {
    name?: string;
    specialty?: string;
    calendarId?: string;
    phone?: string;
    email?: string;
    bio?: string;
    active?: boolean;
  },
) {
  return prisma.dentist.update({ where: { id }, data });
}

export async function upsertWorkingHours(
  dentistId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  active: boolean = true,
) {
  return prisma.workingHours.upsert({
    where: { dentistId_dayOfWeek: { dentistId, dayOfWeek } },
    update: { startTime, endTime, active },
    create: { dentistId, dayOfWeek, startTime, endTime, active },
  });
}

export async function linkDentistProcedure(
  dentistId: string,
  procedureId: string,
) {
  return prisma.dentistProcedure.upsert({
    where: { dentistId_procedureId: { dentistId, procedureId } },
    update: {},
    create: { dentistId, procedureId },
  });
}

export async function unlinkDentistProcedure(
  dentistId: string,
  procedureId: string,
) {
  return prisma.dentistProcedure.delete({
    where: { dentistId_procedureId: { dentistId, procedureId } },
  });
}
