import { prisma } from '../../config/database';

export async function getAllProcedures(activeOnly = true) {
  return prisma.procedure.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { name: 'asc' },
  });
}

export async function getProceduresByDentist(dentistId: string) {
  return prisma.procedure.findMany({
    where: {
      active: true,
      dentistProcedures: {
        some: { dentistId },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getProcedureById(id: string) {
  return prisma.procedure.findUnique({ where: { id } });
}

export async function createProcedure(data: {
  name: string;
  description?: string;
  durationMinutes: number;
  price?: number;
}) {
  return prisma.procedure.create({ data });
}

export async function updateProcedure(
  id: string,
  data: {
    name?: string;
    description?: string;
    durationMinutes?: number;
    price?: number;
    active?: boolean;
  },
) {
  return prisma.procedure.update({ where: { id }, data });
}
