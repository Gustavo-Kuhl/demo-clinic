import { prisma } from '../../config/database';

export async function findOrCreatePatient(phone: string) {
  return prisma.patient.upsert({
    where: { phone },
    update: {},
    create: { phone },
  });
}

export async function updatePatient(
  phone: string,
  data: { name?: string; cpf?: string; email?: string },
) {
  return prisma.patient.update({
    where: { phone },
    data,
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
  return prisma.patient.findUnique({ where: { phone } });
}

export async function findPatientByCpf(cpf: string) {
  // Remove formatação, aceita "123.456.789-00" ou "12345678900"
  const cleanCpf = cpf.replace(/\D/g, '');
  return prisma.patient.findUnique({ where: { cpf: cleanCpf } });
}
