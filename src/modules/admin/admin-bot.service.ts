import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = env.TIMEZONE;

function normalizeCmd(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // remove acentos
}

function fmtTime(date: Date | string) {
  return dayjs(date).tz(TZ).format('HH:mm');
}

function fmtDate(date: Date | string) {
  return dayjs(date).tz(TZ).format('DD/MM HH:mm');
}

function formatAppointmentList(appointments: any[], title: string): string {
  if (!appointments.length) {
    return `${title}\n\nNenhum agendamento encontrado.`;
  }
  const lines = appointments.map((a, i) => {
    const patient = a.patient.name || a.patient.phone;
    return `${i + 1}. ${fmtTime(a.startTime)} — ${patient}\n   🦷 ${a.dentist.name} | ${a.procedure.name}`;
  });
  return `${title}\n\n${lines.join('\n\n')}`;
}

export async function handleAdminCommand(text: string): Promise<string> {
  const cmd = normalizeCmd(text);
  logger.info(`[AdminBot] Comando: "${cmd}"`);

  // ─── AJUDA ───
  if (['ajuda', 'help', 'menu', '?', 'oi', 'ola', 'hello'].includes(cmd)) {
    return [
      '🤖 *Painel Admin — Comandos*',
      '',
      '📅 *Agendamentos*',
      '• `hoje` — agendamentos de hoje',
      '• `amanha` — agendamentos de amanhã',
      '• `semana` — próximos 7 dias',
      '',
      '🔔 *Escalações*',
      '• `escalacoes` — escalações pendentes',
      '',
      '📊 *Estatísticas*',
      '• `stats` — resumo do dia',
      '',
      '🔍 *Busca*',
      '• `paciente [nome ou telefone]` — buscar paciente',
    ].join('\n');
  }

  // ─── HOJE ───
  if (cmd === 'hoje' || cmd === 'agendamentos hoje') {
    const now = dayjs().tz(TZ);
    const start = now.startOf('day').toDate();
    const end = now.endOf('day').toDate();
    const appointments = await prisma.appointment.findMany({
      where: { startTime: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
      include: { patient: true, dentist: true, procedure: true },
      orderBy: { startTime: 'asc' },
    });
    const title = `📅 *Hoje (${now.format('DD/MM')})*`;
    return formatAppointmentList(appointments, title);
  }

  // ─── AMANHÃ ───
  if (cmd === 'amanha' || cmd === 'agendamentos amanha') {
    const tomorrow = dayjs().tz(TZ).add(1, 'day');
    const start = tomorrow.startOf('day').toDate();
    const end = tomorrow.endOf('day').toDate();
    const appointments = await prisma.appointment.findMany({
      where: { startTime: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
      include: { patient: true, dentist: true, procedure: true },
      orderBy: { startTime: 'asc' },
    });
    const title = `📅 *Amanhã (${tomorrow.format('DD/MM')})*`;
    return formatAppointmentList(appointments, title);
  }

  // ─── SEMANA ───
  if (cmd === 'semana' || cmd === 'proxima semana' || cmd === 'proximos') {
    const now = dayjs().tz(TZ);
    const end = now.add(7, 'day').endOf('day').toDate();
    const appointments = await prisma.appointment.findMany({
      where: { startTime: { gte: now.toDate(), lte: end }, status: { not: 'CANCELLED' } },
      include: { patient: true, dentist: true, procedure: true },
      orderBy: { startTime: 'asc' },
    });

    if (!appointments.length) {
      return '📅 *Próximos 7 dias*\n\nNenhum agendamento encontrado.';
    }

    // Agrupa por dia
    const byDay = new Map<string, typeof appointments>();
    for (const a of appointments) {
      const day = dayjs(a.startTime).tz(TZ).format('DD/MM (ddd)');
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(a);
    }

    const lines: string[] = [`📅 *Próximos 7 dias — ${appointments.length} agendamento(s)*`];
    for (const [day, appts] of byDay) {
      lines.push(`\n*${day}*`);
      appts.forEach((a, i) => {
        const patient = a.patient.name || a.patient.phone;
        lines.push(`${i + 1}. ${fmtTime(a.startTime)} — ${patient} | ${a.procedure.name}`);
      });
    }
    return lines.join('\n');
  }

  // ─── ESCALAÇÕES ───
  if (['escalacoes', 'escalações', 'pendentes', 'escalados'].includes(cmd)) {
    const escalations = await prisma.humanEscalation.findMany({
      where: { status: 'PENDING' },
      include: { conversation: { include: { patient: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (!escalations.length) {
      return '✅ *Escalações*\n\nNenhuma escalação pendente.';
    }

    const lines = [`🔔 *Escalações Pendentes (${escalations.length})*`, ''];
    escalations.forEach((e, i) => {
      const patient = e.conversation.patient;
      lines.push(`${i + 1}. ${patient.name || '(sem nome)'}`);
      lines.push(`   📞 ${patient.phone}`);
      if (e.reason) lines.push(`   Motivo: ${e.reason}`);
      lines.push(`   Em: ${fmtDate(e.createdAt)}`);
    });
    return lines.join('\n');
  }

  // ─── STATS ───
  if (['stats', 'resumo', 'estatisticas', 'dashboard'].includes(cmd)) {
    const now = dayjs().tz(TZ);
    const startDay = now.startOf('day').toDate();
    const endDay = now.endOf('day').toDate();
    const startMonth = now.startOf('month').toDate();

    const [
      totalHoje,
      agendadosHoje,
      canceladosHoje,
      concluidosHoje,
      totalMes,
      escalacoes,
      totalPacientes,
    ] = await Promise.all([
      prisma.appointment.count({ where: { startTime: { gte: startDay, lte: endDay } } }),
      prisma.appointment.count({ where: { startTime: { gte: startDay, lte: endDay }, status: 'SCHEDULED' } }),
      prisma.appointment.count({ where: { startTime: { gte: startDay, lte: endDay }, status: 'CANCELLED' } }),
      prisma.appointment.count({ where: { startTime: { gte: startDay, lte: endDay }, status: 'COMPLETED' } }),
      prisma.appointment.count({ where: { startTime: { gte: startMonth }, status: { not: 'CANCELLED' } } }),
      prisma.humanEscalation.count({ where: { status: 'PENDING' } }),
      prisma.patient.count(),
    ]);

    return [
      `📊 *Resumo — ${now.format('DD/MM/YYYY')}*`,
      '',
      `📅 *Hoje:* ${totalHoje} consulta(s)`,
      `   ✅ Agendadas: ${agendadosHoje}`,
      `   🏁 Concluídas: ${concluidosHoje}`,
      `   ❌ Canceladas: ${canceladosHoje}`,
      '',
      `📆 *Este mês:* ${totalMes} consulta(s)`,
      `🔔 *Escalações pendentes:* ${escalacoes}`,
      `👥 *Total de pacientes:* ${totalPacientes}`,
    ].join('\n');
  }

  // ─── PACIENTE [busca] ───
  if (cmd.startsWith('paciente ')) {
    const search = text.trim().slice(9).trim();
    if (!search) return '❌ Informe o nome ou telefone.\nEx: `paciente João`';

    const patients = await prisma.patient.findMany({
      where: {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search.replace(/\D/g, '') } },
          { cpf: { contains: search.replace(/\D/g, '') } },
        ],
      },
      include: { _count: { select: { appointments: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (!patients.length) {
      return `🔍 Nenhum paciente encontrado para *"${search}"*.`;
    }

    const lines = [`🔍 *Resultado para "${search}"*`, ''];
    patients.forEach((p, i) => {
      lines.push(`${i + 1}. *${p.name || '(sem nome)'}*`);
      lines.push(`   📞 ${p.phone}`);
      if ((p as any).cpf) lines.push(`   CPF: ${(p as any).cpf}`);
      if (p.email) lines.push(`   ✉️ ${p.email}`);
      lines.push(`   📋 ${p._count.appointments} consulta(s)`);
    });
    return lines.join('\n');
  }

  // ─── COMANDO DESCONHECIDO ───
  return '❓ Comando não reconhecido.\n\nEnvie *ajuda* para ver os comandos disponíveis.';
}
