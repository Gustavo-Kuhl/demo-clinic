import type OpenAI from 'openai';

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
        'Busca horários disponíveis para agendamento de um dentista com um procedimento específico nos próximos 14 dias.',
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
            description: 'Quantos dias à frente buscar (padrão: 14). Máx: 30.',
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
        'Cadastra ou atualiza os dados do paciente (nome e CPF). Use assim que o paciente informar seu nome e/ou CPF durante a conversa.',
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
        },
        required: [],
      },
    },
  },
];
