# 🦷 Bot WhatsApp — Clínica Odontológica

Automação completa de atendimento WhatsApp com IA para clínicas odontológicas. Inclui agendamento, cancelamento, reagendamento, FAQ e painel administrativo.

## 🚀 Funcionalidades

- **Agente IA humanizado** (GPT-4.1-mini) com nome configurável (padrão: Sofia)
- **Agendamento** de consultas com seleção de dentista e procedimento
- **Cancelamento e reagendamento** de consultas
- **FAQ** com base de conhecimento gerenciável
- **Integração Google Calendar** (múltiplas agendas, uma por dentista)
- **Notificações automáticas**: confirmação, lembrete 24h, lembrete 2h, pesquisa pós-consulta
- **Escalação humana** com notificação ao atendente
- **Painel administrativo** web completo
- **Banco Supabase** (PostgreSQL gerenciado)

---

## 📋 Pré-requisitos

- Node.js 20+
- Conta [Supabase](https://supabase.com) (gratuita)
- Evolution API rodando (WhatsApp)
- Chave API OpenAI
- Conta Google (para o Calendar)

---

## ⚙️ Configuração

### 1. Clone e instale dependências

```bash
# Backend
npm install

# Frontend
cd frontend && npm install && cd ..
```

### 2. Configuração do Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Vá em **Project Settings → Database → Connection string**
3. Copie a URI de conexão (com pooling, porta 6543 e sem pooling, porta 5432)

### 3. Crie o arquivo `.env`

```bash
cp .env.example .env
```

Preencha todas as variáveis. As mais importantes:

```env
# Supabase
DATABASE_URL="postgresql://postgres.[ref]:[senha]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[senha]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"

# OpenAI
OPENAI_API_KEY=sk-...

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua-key
EVOLUTION_INSTANCE_NAME=clinica

# JWT
JWT_SECRET=string-aleatoria-longa-e-segura

# Clínica
CLINIC_NAME=Clínica Odonto Saúde
ATTENDANT_WHATSAPP=5511999999999
```

### 4. Google Calendar — Service Account (Recomendado)

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie um projeto → Ative a **Google Calendar API**
3. Vá em **IAM → Service Accounts → Criar conta de serviço**
4. Baixe a chave JSON
5. No `.env`:
   ```env
   GOOGLE_SERVICE_ACCOUNT_EMAIL=nome@projeto.iam.gserviceaccount.com
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
6. **Compartilhe cada agenda do Google Calendar** com o e-mail da service account (permissão: Fazer alterações em eventos)

### 5. Aplique o schema no banco

```bash
npx prisma migrate deploy
```

### 6. Popule com dados iniciais

```bash
npx prisma db seed
# ou: npx tsx prisma/seed.ts
```

### 7. Build do frontend

```bash
cd frontend && npm run build && cd ..
```

---

## ▶️ Rodando

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm run build
npm start
```

### Com Docker
```bash
docker-compose up -d
```

---

## 📱 Configurando o Webhook da Evolution API

Após o servidor estar rodando, configure o webhook:

```bash
curl -X POST http://localhost:8080/webhook/set/clinica \
  -H "apikey: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "http://SEU_SERVIDOR:3000/webhook",
      "webhookByEvents": false,
      "events": ["MESSAGES_UPSERT"]
    }
  }'
```

Ou acesse a rota de configuração automática em produção definindo a variável:
```env
PUBLIC_URL=https://seu-dominio.com
```

---

## 🖥️ Painel Administrativo

Acesse: `http://localhost:3000`

Credenciais padrão (altere no `.env` antes do seed):
- **Usuário**: `admin`
- **Senha**: `admin123`

### Páginas disponíveis:
| Página | Descrição |
|--------|-----------|
| Dashboard | Resumo do dia, próximas consultas, status WhatsApp |
| Dentistas | Gerenciar dentistas, horários e procedimentos |
| Procedimentos | Cadastrar procedimentos com duração e preço |
| Agendamentos | Visualizar todos os agendamentos com filtros |
| Escalações | Atender solicitações de falar com humano |
| FAQ | Gerenciar base de conhecimento do bot |
| Configurações | Nome da clínica, bot, atendente |

---

## 🦷 Adicionando Dentistas

Pelo painel → Dentistas → Novo Dentista:

| Campo | Descrição |
|-------|-----------|
| Nome | Nome completo do profissional |
| Especialidade | Ex: Ortodontia, Endodontia, Clínico Geral |
| **ID do Google Calendar** | E-mail principal ou ID da agenda (ex: `nome@gmail.com`) |
| Bio | Apresentação que o bot usa ao recomendar o dentista |

Após criar:
1. **Horários**: defina os dias e horários de atendimento
2. **Procedimentos**: vincule quais procedimentos o dentista realiza

---

## 🤖 Comportamento do Bot

O bot (Sofia) responde no WhatsApp com:
- Atendimento 100% em Português brasileiro
- Linguagem calorosa e humanizada
- Confirmação de todos os agendamentos com resumo
- Lembretes automáticos (24h e 2h antes)
- Pesquisa de satisfação após a consulta

### Fluxo típico de agendamento:
1. Paciente: "Quero marcar uma limpeza"
2. Bot: pergunta preferência de dentista e mostra opções
3. Bot: mostra horários disponíveis dos próximos dias
4. Bot: confirma os dados e agenda
5. Bot: envia confirmação com todos os detalhes

---

## 🔧 Variáveis de Ambiente Completas

Veja `.env.example` para todas as opções disponíveis.

---

## 📁 Estrutura do Projeto

```
automacao-claude/
├── src/
│   ├── config/          # Configurações (DB, OpenAI, Logger, Env)
│   ├── modules/
│   │   ├── ai/          # Agente IA + Tools + System Prompt
│   │   ├── appointments/ # Serviço + Repository de agendamentos
│   │   ├── calendar/    # Google Calendar API
│   │   ├── dentists/    # Repository de dentistas
│   │   ├── notifications/ # Mensagens automáticas
│   │   ├── patients/    # Repository de pacientes
│   │   ├── procedures/  # Repository de procedimentos
│   │   └── whatsapp/    # Evolution API + Webhook handler
│   ├── jobs/            # Cron jobs (lembretes, pesquisas)
│   ├── routes/          # Rotas Express (webhook + admin)
│   └── app.ts           # Entry point
├── prisma/
│   ├── schema.prisma    # Schema do banco de dados
│   └── seed.ts          # Dados iniciais
├── frontend/            # Painel admin (React + Vite)
├── docker-compose.yml
├── .env.example
└── Dockerfile
```

---

## 🛠️ Scripts Disponíveis

```bash
npm run dev              # Desenvolvimento com hot-reload
npm run build            # Build TypeScript
npm start                # Produção
npm run prisma:studio    # Interface visual do banco
npm run prisma:migrate:dev  # Nova migration (dev)
npm run prisma:seed      # Popular banco com dados iniciais
```

---

## 📝 Licença

Projeto privado — Clínica Odontológica.
