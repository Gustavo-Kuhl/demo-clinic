import { prisma } from '../../config/database';

/**
 * Encontra o paciente principal do número (mais antigo) ou cria um novo.
 * phone não é único — um número pode ter múltiplos pacientes (familiar, responsável, etc.)
 */
export async function findOrCreatePatient(phone: string) {
  const existing = await prisma.patient.findFirst({
    where: { phone },
    orderBy: { createdAt: 'asc' }, // pega o cadastro mais antigo (paciente principal)
  });
  if (existing) return existing;
  return prisma.patient.create({ data: { phone } });
}

/**
 * Cria um novo paciente com o mesmo número de telefone (para agendamento de terceiros).
 */
export async function createPatientForPhone(
  phone: string,
  data: { name?: string; cpf?: string },
) {
  return prisma.patient.create({
    data: {
      phone,
      name: data.name || null,
      cpf: data.cpf ? data.cpf.replace(/\D/g, '') : null,
    },
  });
}

export async function updatePatientById(
  id: string,
  data: { name?: string; cpf?: string; email?: string },
) {
  return prisma.patient.update({
    where: { id },
    data,
  });
}

export async function findPatientByPhone(phone: string) {
  return prisma.patient.findFirst({
    where: { phone },
    orderBy: { createdAt: 'asc' },
  });
}

export async function findPatientByCpf(cpf: string) {
  const cleanCpf = cpf.replace(/\D/g, '');
  return prisma.patient.findUnique({ where: { cpf: cleanCpf } });
}
