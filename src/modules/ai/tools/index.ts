import type OpenAI from 'openai';

// ── Conversation stage — detected deterministically from last bot message ──
export type ConversationStage =
  | 'initial'          // new conversation or unknown context → all tools
  | 'awaiting_day'     // shown dentist+procedure, waiting for patient to say a day
  | 'awaiting_time'    // shown available days, waiting for patient to pick a time
  | 'pre_confirmation' // shown pre-confirmation summary, waiting for "sim"/"não"
  | 'cancel_flow'      // in cancellation/reschedule flow
  | 'registration';    // waiting for patient name/CPF

/**
 * Returns a reduced subset of tools appropriate for the current conversation stage.
 * Falls back to all tools (initial) when stage is unknown.
 */
export function selectTools(stage: ConversationStage): OpenAI.Chat.ChatCompletionTool[] {
  switch (stage) {
    case 'pre_confirmation':
      // Only need to create the appointment (+ slots as fallback if IDs missing)
      return _tools(['create_appointment', 'get_available_slots', 'escalate_to_human']);
    case 'awaiting_time':
      return _tools(['get_available_slots', 'escalate_to_human', 'register_patient']);
    case 'awaiting_day':
      return _tools(['get_available_slots', 'get_patient_appointments', 'escalate_to_human', 'register_patient']);
    case 'cancel_flow':
      return _tools(['get_patient_appointments', 'cancel_appointment', 'reschedule_appointment', 'get_available_slots', 'escalate_to_human']);
    case 'registration':
      return _tools(['register_patient', 'escalate_to_human']);
    case 'initial':
    default:
      return aiTools;
  }
}

function _tools(names: string[]): OpenAI.Chat.ChatCompletionTool[] {
  return aiTools.filter(t => names.includes(t.function.name));
}

export const aiTools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_dentists',
      description:
        'Lista todos os dentistas disponíveis na clínica, opcionalmente filtrados por especialidade. Use para mostrar opções ao paciente.',
      parameters: {
        type: 'object',
        properties: {
          specialty: {
            type: 'string',
            description:
              'Filtrar por especialidade (ex: "Ortodontia", "Endodontia"). Omita para listar todos.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_procedures',
      description:
        'Lista os procedimentos disponíveis, opcionalmente filtrados por dentista.',
      parameters: {
        type: 'object',
        properties: {
          dentistId: {
            type: 'string',
            description: 'ID do dentista para filtrar procedimentos que ele realiza.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_available_slots',
      description:
        'Busca disponibilidade de um dentista para um procedimento. ' +
        'Sem targetDate: retorna apenas os DIAS disponíveis (use para perguntar ao paciente qual dia prefere). ' +
        'Com targetDate: retorna os HORÁRIOS do dia específico escolhido pelo paciente.',
      parameters: {
        type: 'object',
        properties: {
          dentistId: {
            type: 'string',
            description: 'ID do dentista.',
          },
          procedureId: {
            type: 'string',
            description: 'ID do procedimento (necessário para calcular duração).',
          },
          daysAhead: {
            type: 'number',
            description: 'Quantos dias à frente buscar quando não há targetDate (padrão: 14). Máx: 30.',
          },
          targetDate: {
            type: 'string',
            description:
              'Data específica no formato YYYY-MM-DD (ex: "2026-02-23"). ' +
              'Se omitido, retorna apenas os DIAS disponíveis sem horários. ' +
              'Se informado, retorna os HORÁRIOS disponíveis naquele dia.',
          },
        },
        required: ['dentistId', 'procedureId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_appointment',
      description:
        'Agenda uma nova consulta. Use APENAS após confirmar todos os dados com o paciente (dentista, procedimento, data e hora).',
      parameters: {
        type: 'object',
        properties: {
          dentistId: {
            type: 'string',
            description: 'ID do dentista.',
          },
          procedureId: {
            type: 'string',
            description: 'ID do procedimento.',
          },
          startTime: {
            type: 'string',
            description: 'Data e hora de início no formato ISO 8601 (ex: "2025-01-20T14:00:00-03:00").',
          },
          notes: {
            type: 'string',
            description: 'Observações adicionais do paciente (opcional).',
          },
        },
        required: ['dentistId', 'procedureId', 'startTime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_patient_appointments',
      description:
        'Busca as consultas futuras agendadas do paciente atual. Use para mostrar os agendamentos ou antes de cancelar/reagendar.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description:
        'Cancela uma consulta agendada do paciente. Confirme com o paciente antes de chamar esta função.',
      parameters: {
        type: 'object',
        properties: {
          appointmentId: {
            type: 'string',
            description: 'ID completo da consulta a ser cancelada.',
          },
        },
        required: ['appointmentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_appointment',
      description:
        'Reagenda uma consulta para uma nova data e hora. Use após confirmar o novo horário com o paciente.',
      parameters: {
        type: 'object',
        properties: {
          appointmentId: {
            type: 'string',
            description: 'ID completo da consulta a ser reagendada.',
          },
          newStartTime: {
            type: 'string',
            description:
              'Nova data e hora no formato ISO 8601 (ex: "2025-01-25T10:00:00-03:00").',
          },
        },
        required: ['appointmentId', 'newStartTime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_faq',
      description:
        'Busca respostas na base de FAQ da clínica para dúvidas frequentes sobre preços, horários, procedimentos, etc.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Termos de busca relacionados à dúvida do paciente.',
          },
          category: {
            type: 'string',
            description:
              'Categoria da FAQ: "pagamento", "horarios", "procedimentos", "agendamento", "emergencia".',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalate_to_human',
      description:
        'Transfere o atendimento para um atendente humano. Use quando o paciente solicitar, quando houver situação complexa, ou quando você não conseguir ajudar.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description:
              'Motivo da transferência (ex: "Paciente solicitou atendente", "Dúvida sobre plano odontológico complexa").',
          },
        },
        required: ['reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'register_patient',
      description:
        'Cadastra ou atualiza os dados do paciente (nome e CPF). Use assim que o paciente informar seu nome e/ou CPF. Use createNew=true quando o agendamento for para outra pessoa (familiar, dependente) que usa o mesmo celular.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Nome completo do paciente.',
          },
          cpf: {
            type: 'string',
            description: 'CPF do paciente (apenas números, ex: "12345678900").',
          },
          createNew: {
            type: 'boolean',
            description: 'Se true, cria um novo cadastro (para agendar para outra pessoa no mesmo celular, como familiar ou dependente). O novo paciente ficará ativo para o próximo agendamento.',
          },
        },
        required: [],
      },
    },
  },
];
