import type OpenAI from 'openai';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/pt-br';
import { openai, OPENAI_MODEL } from '../../config/openai';
import { env } from '../../config/env';

dayjs.extend(utc);
dayjs.extend(timezone);
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { aiTools } from './tools';
import { buildSystemPrompt } from './prompts/system.prompt';
import * as appointmentsService from '../appointments/appointments.service';
import * as appointmentsRepo from '../appointments/appointments.repository';
import * as dentistsRepo from '../dentists/dentists.repository';
import * as proceduresRepo from '../procedures/procedures.repository';
import * as calendarService from '../calendar/google-calendar.service';
import * as patientsRepo from '../patients/patients.repository';

type Message = OpenAI.Chat.ChatCompletionMessageParam;

const MAX_HISTORY_MESSAGES = 20; // Mantém as últimas 20 mensagens para contexto
const MAX_TOOL_ITERATIONS = 10; // Evita loop infinito

/**
 * Processa uma mensagem do paciente e retorna a resposta do agente
 */
export async function processMessage(
  patientPhone: string,
  incomingMessage: string,
): Promise<string> {
  // 1. Busca conversa ativa para este número (respeita troca de paciente via createNew)
  let conversation = await prisma.conversation.findFirst({
    where: {
      patient: { phone: patientPhone },
      status: 'ACTIVE',
    },
    include: {
      patient: true,
      messages: {
        orderBy: { timestamp: 'desc' },
        take: MAX_HISTORY_MESSAGES,
      },
    },
    orderBy: { lastMessageAt: 'desc' },
  });

  // 2. Usa o paciente da conversa ativa ou busca/cria o paciente principal do número
  const patient = conversation?.patient ?? await patientsRepo.findOrCreatePatient(patientPhone);

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        patientId: patient.id,
        status: 'ACTIVE',
      },
      include: { patient: true, messages: true },
    });
  }

  // 3. Salva a mensagem do paciente
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'INBOUND',
      content: incomingMessage,
      role: 'user',
    },
  });

  // 4. Atualiza o lastMessageAt
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  // 5. Busca configurações da clínica
  const settings = await prisma.systemSettings.findFirst();
  const clinicName = settings?.clinicName || 'Clínica Odontológica';
  const botName = settings?.botName || 'Sofia';

  // 6. Monta histórico de mensagens
  const systemPrompt = buildSystemPrompt(clinicName, botName, {
    name: patient.name,
    cpf: (patient as any).cpf ?? null,
  });

  const historyMessages: Message[] = [...conversation.messages]
    .reverse() // Inverte para ordem cronológica (busca foi desc para pegar as mais recentes)
    .map((m) => ({
      role: (m.role as 'user' | 'assistant'),
      content: m.content,
    }));

  // Adiciona a mensagem atual
  historyMessages.push({
    role: 'user',
    content: incomingMessage,
  });

  // 7. Executa o loop do agente com function calling
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
  ];

  let iterations = 0;
  let finalResponse = '';
  // Permite que register_patient(createNew) troque o paciente ativo mid-session
  let activePatientId = patient.id;
  // Rastreia agendamento criado com sucesso nesta sessão (fallback se OpenAI falhar depois)
  let createdAppointmentData: Record<string, unknown> | null = null;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    let response;
    try {
      response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages,
        tools: aiTools,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 1024,
      });
    } catch (openaiError) {
      logger.error('[AI] Erro na API OpenAI durante o loop do agente:', openaiError);
      break;
    }

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    // Adiciona a resposta do assistente ao histórico
    messages.push(assistantMessage);

    // Se não há tool calls, é a resposta final
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      finalResponse = assistantMessage.content || '';
      break;
    }

    // Processa cada tool call
    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      let toolArgs: Record<string, unknown> = {};

      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        logger.error(`Erro ao parsear argumentos da tool ${toolName}`);
      }

      logger.debug(`[AI Tool] ${toolName}:`, toolArgs);

      const toolResult = await executeToolCall(
        toolName,
        toolArgs,
        activePatientId,
        conversation.id,
        (newId) => { activePatientId = newId; },
      );

      // Rastreia agendamento criado com sucesso (proteção contra falha da OpenAI após criação)
      if (toolName === 'create_appointment') {
        const r = toolResult as Record<string, unknown>;
        if (r.success && r.appointment) {
          createdAppointmentData = r.appointment as Record<string, unknown>;
        }
      }

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }
  }

  if (!finalResponse) {
    if (createdAppointmentData) {
      // Appointment criado mas OpenAI não gerou a resposta final — monta confirmação manualmente
      const apt = createdAppointmentData as any;
      const startFormatted = dayjs(apt.startTime)
        .tz(env.TIMEZONE)
        .locale('pt-br')
        .format('dddd, DD [de] MMMM [de] YYYY [às] HH:mm');
      finalResponse = [
        '✅ *Consulta confirmada!*',
        '',
        `👤 *Paciente:* ${apt.patientName}`,
        `🪪 *CPF:* ${apt.patientCpf}`,
        `📋 *Procedimento:* ${apt.procedure}`,
        `👨‍⚕️ *Dentista:* ${apt.dentist}`,
        `📅 *Data e horário:* ${startFormatted}`,
        '',
        '_Chegue 10 minutos antes. Para cancelar ou reagendar, é só me avisar!_',
      ].join('\n');
      logger.warn('[AI] OpenAI falhou após create_appointment — usando confirmação de fallback');
    } else {
      finalResponse =
        'Desculpe, tive um pequeno problema técnico. Pode repetir sua mensagem? 😊';
    }
  }

  // 8. Salva a resposta do assistente
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      content: finalResponse,
      role: 'assistant',
    },
  });

  return finalResponse;
}

/**
 * Executa a chamada de ferramenta e retorna o resultado
 */
async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  patientId: string,
  conversationId: string,
  onPatientSwitch?: (newPatientId: string) => void,
): Promise<unknown> {
  try {
    switch (toolName) {
      case 'get_dentists': {
        const dentists = await dentistsRepo.getAllDentists(true);
        const specialty = args.specialty as string | undefined;

        const filtered = specialty
          ? dentists.filter((d) =>
              d.specialty?.toLowerCase().includes(specialty.toLowerCase()),
            )
          : dentists;

        return filtered.map((d) => ({
          id: d.id,
          name: d.name,
          specialty: d.specialty || 'Clínico Geral',
          bio: d.bio,
          procedures: d.dentistProcedures.map((dp) => ({
            id: dp.procedure.id,
            name: dp.procedure.name,
            durationMinutes: dp.procedure.durationMinutes,
          })),
          workingDays: d.workingHours
            .filter((wh) => wh.active)
            .map((wh) => ({
              dayOfWeek: wh.dayOfWeek,
              dayName: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][wh.dayOfWeek],
              startTime: wh.startTime,
              endTime: wh.endTime,
            })),
        }));
      }

      case 'get_procedures': {
        const dentistId = args.dentistId as string | undefined;
        const procedures = dentistId
          ? await proceduresRepo.getProceduresByDentist(dentistId)
          : await proceduresRepo.getAllProcedures(true);

        return procedures.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          durationMinutes: p.durationMinutes,
          price: p.price,
        }));
      }

      case 'get_available_slots': {
        const { dentistId, procedureId, daysAhead = 14, targetDate } = args as {
          dentistId: string;
          procedureId: string;
          daysAhead?: number;
          targetDate?: string;
        };

        const dentist = await dentistsRepo.getDentistById(dentistId);
        const procedure = await proceduresRepo.getProcedureById(procedureId);

        if (!dentist || !procedure) {
          return { error: 'Dentista ou procedimento não encontrado.' };
        }

        const workingHoursByDay = dentist.workingHours
          .filter((wh) => wh.active)
          .map((wh) => ({
            dayOfWeek: wh.dayOfWeek,
            startTime: wh.startTime,
            endTime: wh.endTime,
          }));

        const dentistInfo = { id: dentist.id, name: dentist.name };
        const procedureInfo = { id: procedure.id, name: procedure.name, durationMinutes: procedure.durationMinutes };

        // Modo 2: paciente já escolheu o dia — retorna horários do dia específico
        if (targetDate) {
          // Valida formato YYYY-MM-DD antes de qualquer coisa
          if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
            return {
              error: `targetDate inválido: "${targetDate}". Use o campo "date" (YYYY-MM-DD) do array availableDates retornado anteriormente, ex: "2026-02-23".`,
            };
          }
          const dayOfWeek = dayjs.tz(targetDate, env.TIMEZONE).day();
          const wh = workingHoursByDay.find((h) => h.dayOfWeek === dayOfWeek);
          if (!wh) {
            return { error: 'O dentista não atende neste dia da semana. Escolha outra data da lista.' };
          }
          const daySlots = await calendarService.getAvailableSlots(
            dentist.calendarId,
            targetDate,
            procedure.durationMinutes,
            wh,
          );
          return {
            dentist: dentistInfo,
            procedure: procedureInfo,
            date: targetDate,
            displayDate: dayjs.tz(targetDate, env.TIMEZONE).locale('pt-br').format('dddd, DD [de] MMMM [de] YYYY'),
            slots: daySlots,
            message: daySlots.length === 0
              ? 'Sem horários disponíveis neste dia. Peça ao paciente que escolha outra data.'
              : null,
          };
        }

        // Modo 1: sem dia definido — retorna apenas lista de dias disponíveis
        const days = await calendarService.getAvailableSlotsForDays(
          dentist.calendarId,
          procedure.durationMinutes,
          workingHoursByDay,
          Math.min(daysAhead, 30),
        );

        return {
          dentist: dentistInfo,
          procedure: procedureInfo,
          availableDates: days.map((day) => ({
            date: day.date,
            displayDate: dayjs.tz(day.date, env.TIMEZONE).locale('pt-br').format('dddd, DD [de] MMMM'),
          })),
          message: days.length === 0
            ? 'Nenhum dia disponível nos próximos dias. Tente outro dentista ou amplie o período.'
            : 'Apresente os dias ao paciente e pergunte qual prefere. Depois chame get_available_slots com targetDate.',
        };
      }

      case 'create_appointment': {
        const { dentistId, procedureId, startTime, notes } = args as {
          dentistId: string;
          procedureId: string;
          startTime: string;
          notes?: string;
        };

        // Rejeita horários no passado
        if (dayjs(startTime).isBefore(dayjs())) {
          return {
            error: 'Não é possível agendar consultas em datas ou horários passados. Por favor, escolha um horário futuro.',
          };
        }

        // Verifica se o paciente está cadastrado
        const patientData = await prisma.patient.findUnique({ where: { id: patientId } });
        if (!patientData?.name || !(patientData as any).cpf) {
          const missing: string[] = [];
          if (!patientData?.name) missing.push('nome completo');
          if (!(patientData as any).cpf) missing.push('CPF');
          return {
            error: `Paciente não cadastrado. Solicite ${missing.join(' e ')} antes de agendar.`,
            requiresRegistration: true,
          };
        }

        const result = await appointmentsService.scheduleAppointment({
          patientId,
          dentistId,
          procedureId,
          startTime,
          notes,
        });

        if (!result.success) {
          return { success: false, error: result.error };
        }

        const cpfRaw = (patientData as any).cpf as string;
        const cpfFormatted = cpfRaw
          ? cpfRaw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
          : '';

        return {
          success: true,
          appointment: {
            id: result.appointment.id,
            patientName: patientData.name,
            patientCpf: cpfFormatted,
            dentist: result.appointment.dentist.name,
            procedure: result.appointment.procedure.name,
            startTime: result.appointment.startTime,
            endTime: result.appointment.endTime,
            summary: appointmentsService.formatAppointmentForDisplay(
              result.appointment,
            ),
          },
        };
      }

      case 'get_patient_appointments': {
        const appointments =
          await appointmentsService.getPatientUpcomingAppointments(patientId);

        if (appointments.length === 0) {
          return { appointments: [], message: 'Nenhuma consulta agendada.' };
        }

        return {
          appointments: appointments.map((a) => ({
            id: a.id,
            dentist: a.dentist.name,
            specialty: a.dentist.specialty,
            procedure: a.procedure.name,
            startTime: a.startTime,
            endTime: a.endTime,
            summary: appointmentsService.formatAppointmentForDisplay(a as any),
          })),
        };
      }

      case 'cancel_appointment': {
        const { appointmentId } = args as { appointmentId: string };
        const result = await appointmentsService.cancelAppointment(
          appointmentId,
          patientId,
        );
        return result;
      }

      case 'reschedule_appointment': {
        const { appointmentId, newStartTime } = args as {
          appointmentId: string;
          newStartTime: string;
        };
        const result = await appointmentsService.rescheduleAppointment(
          appointmentId,
          patientId,
          newStartTime,
        );

        if (!result.success) {
          return { success: false, error: result.error };
        }

        return {
          success: true,
          appointment: {
            id: result.appointment.id,
            dentist: result.appointment.dentist.name,
            procedure: result.appointment.procedure.name,
            startTime: result.appointment.startTime,
            summary: appointmentsService.formatAppointmentForDisplay(
              result.appointment,
            ),
          },
        };
      }

      case 'search_faq': {
        const { query, category } = args as {
          query: string;
          category?: string;
        };

        const faqs = await prisma.fAQ.findMany({
          where: {
            active: true,
            ...(category ? { category } : {}),
            OR: [
              { question: { contains: query, mode: 'insensitive' } },
              { answer: { contains: query, mode: 'insensitive' } },
            ],
          },
          orderBy: { order: 'asc' },
          take: 3,
        });

        if (faqs.length === 0) {
          return {
            found: false,
            message: 'Nenhuma resposta específica encontrada no FAQ.',
          };
        }

        return {
          found: true,
          results: faqs.map((f) => ({
            question: f.question,
            answer: f.answer,
            category: f.category,
          })),
        };
      }

      case 'escalate_to_human': {
        const { reason } = args as { reason: string };

        await prisma.humanEscalation.create({
          data: { conversationId, reason },
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { status: 'ESCALATED' },
        });

        return {
          success: true,
          message:
            'Transferência registrada. Um atendente será notificado.',
        };
      }

      case 'register_patient': {
        const { name, cpf, createNew } = args as {
          name?: string;
          cpf?: string;
          createNew?: boolean;
        };
        if (!name && !cpf) {
          return { error: 'Informe pelo menos o nome ou CPF para cadastrar.' };
        }

        const cleanCpf = cpf ? cpf.replace(/\D/g, '') : undefined;

        // Verifica se CPF já pertence a outro paciente
        if (cleanCpf) {
          const existing = await patientsRepo.findPatientByCpf(cleanCpf);
          if (existing && existing.id !== patientId) {
            return { error: 'Este CPF já está cadastrado para outro paciente.' };
          }
        }

        // createNew: cria um novo paciente com o mesmo telefone (ex: familiar)
        if (createNew) {
          const currentPatient = await prisma.patient.findUnique({ where: { id: patientId } });
          const newPatient = await patientsRepo.createPatientForPhone(
            currentPatient?.phone || '',
            { name, cpf: cleanCpf },
          );
          // Atualiza a conversa para apontar ao novo paciente
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { patientId: newPatient.id },
          });
          // Notifica o loop para usar o novo patientId nas próximas tools
          onPatientSwitch?.(newPatient.id);
          return {
            success: true,
            name: newPatient.name,
            cpf: cleanCpf,
            message: 'Novo paciente cadastrado. Os próximos agendamentos serão para esta pessoa.',
          };
        }

        await patientsRepo.updatePatientById(patientId, {
          ...(name ? { name } : {}),
          ...(cleanCpf ? { cpf: cleanCpf } : {}),
        });

        return {
          success: true,
          ...(name ? { name } : {}),
          ...(cleanCpf ? { cpf: cleanCpf } : {}),
          message: 'Dados cadastrados com sucesso.',
        };
      }

      default:
        logger.warn(`Tool desconhecida: ${toolName}`);
        return { error: `Ferramenta não reconhecida: ${toolName}` };
    }
  } catch (error) {
    logger.error(`Erro ao executar tool ${toolName}:`, error);
    return {
      error: `Erro ao executar ${toolName}. Tente novamente.`,
    };
  }
}
