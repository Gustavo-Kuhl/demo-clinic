const BASE = '/api/admin'

function getToken(): string | null {
  return localStorage.getItem('admin_token')
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  if (res.status === 401) {
    localStorage.removeItem('admin_token')
    window.location.href = '/login'
    throw new Error('Não autorizado')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
    throw new Error(err.error ?? `Erro ${res.status}`)
  }

  return res.json() as Promise<T>
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; username: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  dashboard: () => request<DashboardData>('/dashboard'),

  dentists: {
    list: () => request<Dentist[]>('/dentists'),
    create: (data: Partial<Dentist>) =>
      request<Dentist>('/dentists', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Dentist>) =>
      request<Dentist>(`/dentists/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    setHours: (id: string, dayOfWeek: number, startTime: string, endTime: string, active: boolean) =>
      request(`/dentists/${id}/working-hours`, {
        method: 'POST',
        body: JSON.stringify({ dayOfWeek, startTime, endTime, active }),
      }),
    linkProcedure: (id: string, procedureId: string) =>
      request(`/dentists/${id}/procedures/${procedureId}`, { method: 'POST' }),
    unlinkProcedure: (id: string, procedureId: string) =>
      request(`/dentists/${id}/procedures/${procedureId}`, { method: 'DELETE' }),
  },

  procedures: {
    list: () => request<Procedure[]>('/procedures'),
    create: (data: Partial<Procedure>) =>
      request<Procedure>('/procedures', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Procedure>) =>
      request<Procedure>(`/procedures/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  appointments: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<Appointment[]>(`/appointments${qs}`)
    },
    create: (data: { patientId: string; dentistId: string; procedureId: string; startTime: string; notes?: string }) =>
      request<Appointment>('/appointments', { method: 'POST', body: JSON.stringify(data) }),
    cancel: (id: string) =>
      request<Appointment>(`/appointments/${id}/cancel`, { method: 'PATCH' }),
    reschedule: (id: string, newStartTime: string) =>
      request<Appointment>(`/appointments/${id}/reschedule`, { method: 'PATCH', body: JSON.stringify({ newStartTime }) }),
    getSlots: (dentistId: string, procedureId: string, daysAhead = 14) => {
      const qs = new URLSearchParams({ dentistId, procedureId, daysAhead: String(daysAhead) }).toString()
      return request<{ date: string; slots: TimeSlot[] }[]>(`/available-slots?${qs}`)
    },
    updateStatus: (id: string, status: string) =>
      request(`/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },

  escalations: {
    list: () => request<Escalation[]>('/escalations'),
    resolve: (id: string) => request(`/escalations/${id}/resolve`, { method: 'PATCH' }),
  },

  faqs: {
    list: () => request<FAQ[]>('/faqs'),
    create: (data: Partial<FAQ>) =>
      request<FAQ>('/faqs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<FAQ>) =>
      request<FAQ>(`/faqs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/faqs/${id}`, { method: 'DELETE' }),
  },

  settings: {
    get: () => request<Settings>('/settings'),
    update: (data: Partial<Settings>) =>
      request<Settings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },

  patients: {
    list: (search?: string) => {
      const qs = search ? `?search=${encodeURIComponent(search)}` : ''
      return request<Patient[]>(`/patients${qs}`)
    },
    update: (id: string, data: { name?: string; cpf?: string; email?: string; phone?: string }) =>
      request<Patient>(`/patients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    getAppointments: (id: string) =>
      request<Appointment[]>(`/patients/${id}/appointments`),
  },
}

// ---- Types ----

export interface WorkingHour {
  id: string
  dentistId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  active: boolean
}

export interface Procedure {
  id: string
  name: string
  description?: string
  durationMinutes: number
  price?: number
  active: boolean
}

export interface Dentist {
  id: string
  name: string
  specialty?: string
  calendarId: string
  phone?: string
  email?: string
  bio?: string
  active: boolean
  workingHours: WorkingHour[]
  dentistProcedures: { dentistId: string; procedureId: string; procedure: Procedure }[]
}

export interface TimeSlot {
  start: string
  end: string
  displayStart: string
  displayDate: string
}

export interface Patient {
  id: string
  phone: string
  name?: string
  cpf?: string
  email?: string
  createdAt: string
  _count?: { appointments: number }
}

export interface Appointment {
  id: string
  startTime: string
  endTime: string
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED' | 'RESCHEDULED'
  notes?: string
  patient: Patient
  dentist: Dentist
  procedure: Procedure
}

export interface Escalation {
  id: string
  reason?: string
  status: 'PENDING' | 'RESOLVED'
  createdAt: string
  resolvedAt?: string
  conversation: {
    id: string
    patient: Patient
    messages: { id: string; direction: string; content: string; timestamp: string }[]
  }
}

export interface FAQ {
  id: string
  question: string
  answer: string
  category?: string
  active: boolean
  order: number
}

export interface Settings {
  id: string
  clinicName: string
  clinicPhone?: string
  clinicAddress?: string
  attendantPhone?: string
  attendantEmail?: string
  timezone: string
  botName: string
  botWelcomeMessage?: string
  cancellationPolicy?: string
}

export interface DashboardData {
  stats: {
    appointmentsToday: number
    appointmentsMonth: number
    pendingEscalations: number
  }
  upcomingAppointments: Appointment[]
  whatsappStatus: { state: string; connected: boolean }
}
