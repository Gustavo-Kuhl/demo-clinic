import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Admin padrão
  const passwordHash = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || 'admin123',
    12,
  );
  await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: { passwordHash },
    create: {
      username: process.env.ADMIN_USERNAME || 'admin',
      passwordHash,
    },
  });

  // Configurações do sistema
  await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      clinicName: process.env.CLINIC_NAME || 'Clínica Odonto Saúde',
      clinicPhone: process.env.CLINIC_PHONE || '5511999999999',
      clinicAddress:
        process.env.CLINIC_ADDRESS || 'Rua das Flores, 123 - São Paulo/SP',
      attendantPhone: process.env.ATTENDANT_WHATSAPP || '',
      timezone: process.env.TIMEZONE || 'America/Sao_Paulo',
      botName: 'Sofia',
      botWelcomeMessage:
        'Olá! 😊 Sou a Sofia, assistente virtual da *{clinicName}*. Estou aqui para te ajudar com agendamentos e dúvidas. Como posso te ajudar hoje?',
    },
  });

  // Procedimentos base
  const procedures = [
    {
      name: 'Consulta de Avaliação',
      description: 'Avaliação inicial e diagnóstico',
      durationMinutes: 30,
      price: 0,
    },
    {
      name: 'Limpeza Dental (Profilaxia)',
      description: 'Limpeza profissional com remoção de tártaro',
      durationMinutes: 60,
      price: 150,
    },
    {
      name: 'Clareamento Dental',
      description: 'Clareamento dental com gel profissional',
      durationMinutes: 90,
      price: 500,
    },
    {
      name: 'Restauração (Obturação)',
      description: 'Tratamento de cárie com resina composta',
      durationMinutes: 60,
      price: 200,
    },
    {
      name: 'Extração Simples',
      description: 'Extração de dente com anestesia local',
      durationMinutes: 45,
      price: 180,
    },
    {
      name: 'Tratamento de Canal (Endodontia)',
      description: 'Tratamento endodôntico completo',
      durationMinutes: 90,
      price: 800,
    },
    {
      name: 'Ortodontia - Instalação de Aparelho',
      description: 'Instalação de aparelho ortodôntico fixo',
      durationMinutes: 90,
      price: 1200,
    },
    {
      name: 'Ortodontia - Manutenção',
      description: 'Consulta de manutenção do aparelho',
      durationMinutes: 30,
      price: 150,
    },
    {
      name: 'Implante Dental',
      description: 'Implante de titânio para reposição dentária',
      durationMinutes: 120,
      price: 2500,
    },
    {
      name: 'Prótese Dentária',
      description: 'Confecção e instalação de prótese',
      durationMinutes: 60,
      price: 1500,
    },
  ];

  for (const proc of procedures) {
    await prisma.procedure.upsert({
      where: { id: proc.name },
      update: {},
      create: { ...proc, id: proc.name },
    });
  }

  // Exemplo de dentista (o usuário irá cadastrar os seus)
  const dentist = await prisma.dentist.upsert({
    where: { id: 'dentist-exemplo' },
    update: {},
    create: {
      id: 'dentist-exemplo',
      name: 'Dr. João Silva',
      specialty: 'Clínico Geral',
      calendarId: 'primary', // Substituir pelo ID real do Google Calendar
      bio: 'Cirurgião-Dentista formado pela USP, especialista em clínica geral e estética dental.',
    },
  });

  // Horários de trabalho do dentista de exemplo
  const workDays = [1, 2, 3, 4, 5]; // Seg a Sex
  for (const day of workDays) {
    await prisma.workingHours.upsert({
      where: {
        dentistId_dayOfWeek: {
          dentistId: dentist.id,
          dayOfWeek: day,
        },
      },
      update: {},
      create: {
        dentistId: dentist.id,
        dayOfWeek: day,
        startTime: '08:00',
        endTime: '18:00',
      },
    });
  }

  // FAQs base
  const faqs = [
    {
      question: 'Quais formas de pagamento vocês aceitam?',
      answer:
        'Aceitamos dinheiro, cartões de débito e crédito (parcelamos em até 12x), PIX e convênios odontológicos. Para mais informações, entre em contato conosco.',
      category: 'pagamento',
    },
    {
      question: 'Como funciona o cancelamento de consulta?',
      answer:
        'Para cancelar sua consulta sem cobrança, entre em contato com até 24 horas de antecedência. Cancelamentos com menos de 24h podem estar sujeitos a taxa de cancelamento.',
      category: 'agendamento',
    },
    {
      question: 'A clínica atende planos odontológicos?',
      answer:
        'Sim! Trabalhamos com os principais convênios odontológicos. Entre em contato para verificar se atendemos o seu plano.',
      category: 'pagamento',
    },
    {
      question: 'Quais são os horários de funcionamento?',
      answer:
        'Funcionamos de segunda a sexta, das 8h às 18h, e aos sábados das 8h às 12h. Nos domingos e feriados estamos fechados.',
      category: 'horarios',
    },
    {
      question: 'O que fazer em caso de emergência odontológica?',
      answer:
        'Em caso de emergência, entre em contato pelo nosso WhatsApp. Temos horários reservados para atendimentos de urgência.',
      category: 'emergencia',
    },
    {
      question: 'O clareamento dental dói?',
      answer:
        'O clareamento profissional pode causar leve sensibilidade temporária, que desaparece em poucos dias. Nossos dentistas utilizam produtos de alta qualidade para minimizar o desconforto.',
      category: 'procedimentos',
    },
    {
      question: 'Com que frequência devo fazer a limpeza dental?',
      answer:
        'Recomendamos a limpeza dental (profilaxia) a cada 6 meses para manter a saúde bucal. Em alguns casos, pode ser recomendada com maior frequência.',
      category: 'procedimentos',
    },
    {
      question: 'Como me preparar para uma consulta odontológica?',
      answer:
        'Recomendamos escovar os dentes antes da consulta, trazer seus documentos e exames anteriores (se houver), e informar qualquer medicamento que esteja tomando ou condição médica relevante.',
      category: 'procedimentos',
    },
  ];

  for (let i = 0; i < faqs.length; i++) {
    await prisma.fAQ.create({
      data: { ...faqs[i], order: i + 1 },
    }).catch(() => {}); // Ignora se já existe
  }

  console.log('✅ Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
