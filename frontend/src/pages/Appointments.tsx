import { useEffect, useRef, useState } from 'react'
import { api, type Appointment, type Dentist, type Patient, type Procedure, type TimeSlot } from '../api/client'
import Modal from '../components/Modal'

const statusColors: Record<string, string> = {
  SCHEDULED: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  CANCELLED: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  RESCHEDULED: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
}
const statusLabels: Record<string, string> = {
  SCHEDULED: 'Agendado', CANCELLED: 'Cancelado', COMPLETED: 'Concluído', RESCHEDULED: 'Reagendado',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} · ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

function capitalize(str: string) {
  return str.replace(/\b\w/g, c => c.toUpperCase())
}

// ── Loading overlay ──────────────────────────────────────────────────────────
function LoadingOverlay({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <div className="w-8 h-8 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}

// ── Slot grid ────────────────────────────────────────────────────────────────
function SlotGrid({
  days,
  selected,
  onSelect,
  loading,
}: {
  days: { date: string; slots: TimeSlot[] }[]
  selected: TimeSlot | null
  onSelect: (slot: TimeSlot) => void
  loading: boolean
}) {
  if (loading) return <LoadingOverlay label="Buscando horários disponíveis…" />
  if (days.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-6">
        Nenhum horário disponível nos próximos 14 dias.
      </p>
    )
  }
  return (
    <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
      {days.map(day => (
        <div key={day.date}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            {capitalize(day.slots[0]?.displayDate || day.date)}
          </p>
          <div className="flex flex-wrap gap-2">
            {day.slots.map(slot => {
              const isSelected = selected?.start === slot.start
              return (
                <button
                  key={slot.start}
                  type="button"
                  onClick={() => onSelect(slot)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {slot.displayStart}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Spinner inline ────────────────────────────────────────────────────────────
function Spinner() {
  return <span className="inline-block w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Appointment | null>(null)

  // Filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [filterDentistId, setFilterDentistId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // ── Create modal ────────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [createPatientSearch, setCreatePatientSearch] = useState('')
  const [createPatientResults, setCreatePatientResults] = useState<Patient[]>([])
  const [createPatientLoading, setCreatePatientLoading] = useState(false)
  const [createPatient, setCreatePatient] = useState<Patient | null>(null)
  const [createDentistId, setCreateDentistId] = useState('')
  const [createProcedureId, setCreateProcedureId] = useState('')
  const [createSlots, setCreateSlots] = useState<{ date: string; slots: TimeSlot[] }[]>([])
  const [createSlotsLoading, setCreateSlotsLoading] = useState(false)
  const [createSelectedSlot, setCreateSelectedSlot] = useState<TimeSlot | null>(null)
  const [createNotes, setCreateNotes] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  // ── Detail modal ────────────────────────────────────────────────────────────
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  // ── Reschedule modal ────────────────────────────────────────────────────────
  const [showReschedule, setShowReschedule] = useState(false)
  const [rescheduleSlots, setRescheduleSlots] = useState<{ date: string; slots: TimeSlot[] }[]>([])
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false)
  const [rescheduleSelectedSlot, setRescheduleSelectedSlot] = useState<TimeSlot | null>(null)
  const [rescheduling, setRescheduling] = useState(false)
  const [rescheduleError, setRescheduleError] = useState('')

  // ── Load ────────────────────────────────────────────────────────────────────
  async function load() {
    setLoading(true)
    const params: Record<string, string> = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    if (filterDentistId) params.dentistId = filterDentistId
    if (filterStatus) params.status = filterStatus
    const [apts, dens] = await Promise.all([api.appointments.list(params), api.dentists.list()])
    setAppointments(apts)
    setDentists(dens)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Patient search (debounced) ──────────────────────────────────────────────
  function handlePatientSearchChange(val: string) {
    setCreatePatientSearch(val)
    setCreatePatient(null)
    clearTimeout(searchTimer.current)
    if (val.length < 2) { setCreatePatientResults([]); return }
    setCreatePatientLoading(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await api.patients.list(val)
        setCreatePatientResults(results)
      } finally {
        setCreatePatientLoading(false)
      }
    }, 300)
  }

  // ── Slots loader ────────────────────────────────────────────────────────────
  async function loadCreateSlots(dentistId: string, procedureId: string) {
    if (!dentistId || !procedureId) { setCreateSlots([]); return }
    setCreateSlotsLoading(true)
    setCreateSelectedSlot(null)
    try {
      const slots = await api.appointments.getSlots(dentistId, procedureId)
      setCreateSlots(slots)
    } catch {
      setCreateSlots([])
    } finally {
      setCreateSlotsLoading(false)
    }
  }

  function handleCreateDentistChange(id: string) {
    setCreateDentistId(id)
    setCreateProcedureId('')
    setCreateSlots([])
    setCreateSelectedSlot(null)
  }

  function handleCreateProcedureChange(id: string) {
    setCreateProcedureId(id)
    loadCreateSlots(createDentistId, id)
  }

  // ── Create appointment ──────────────────────────────────────────────────────
  async function handleCreate() {
    if (!createPatient || !createDentistId || !createProcedureId || !createSelectedSlot) {
      setCreateError('Preencha todos os campos e selecione um horário.')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      await api.appointments.create({
        patientId: createPatient.id,
        dentistId: createDentistId,
        procedureId: createProcedureId,
        startTime: createSelectedSlot.start,
        notes: createNotes || undefined,
      })
      setShowCreate(false)
      resetCreate()
      await load()
    } catch (e: any) {
      setCreateError(e.message || 'Erro ao criar agendamento.')
    } finally {
      setCreating(false)
    }
  }

  function resetCreate() {
    setCreatePatientSearch(''); setCreatePatientResults([]); setCreatePatient(null)
    setCreateDentistId(''); setCreateProcedureId(''); setCreateSlots([])
    setCreateSelectedSlot(null); setCreateNotes(''); setCreateError('')
  }

  // ── Cancel ──────────────────────────────────────────────────────────────────
  async function handleCancel() {
    if (!selected) return
    setCancelling(true)
    setCancelError('')
    try {
      const updated = await api.appointments.cancel(selected.id)
      setSelected(updated)
      await load()
    } catch (e: any) {
      setCancelError(e.message || 'Erro ao cancelar.')
    } finally {
      setCancelling(false)
    }
  }

  // ── Open reschedule ─────────────────────────────────────────────────────────
  async function openReschedule(apt: Appointment) {
    setShowReschedule(true)
    setRescheduleSelectedSlot(null)
    setRescheduleError('')
    setRescheduleSlotsLoading(true)
    try {
      const slots = await api.appointments.getSlots(apt.dentist.id, apt.procedure.id)
      setRescheduleSlots(slots)
    } catch {
      setRescheduleSlots([])
    } finally {
      setRescheduleSlotsLoading(false)
    }
  }

  // ── Reschedule submit ───────────────────────────────────────────────────────
  async function handleReschedule() {
    if (!selected || !rescheduleSelectedSlot) {
      setRescheduleError('Selecione um novo horário.')
      return
    }
    setRescheduling(true)
    setRescheduleError('')
    try {
      const updated = await api.appointments.reschedule(selected.id, rescheduleSelectedSlot.start)
      setShowReschedule(false)
      setSelected(updated)
      await load()
    } catch (e: any) {
      setRescheduleError(e.message || 'Erro ao reagendar.')
    } finally {
      setRescheduling(false)
    }
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const selectedDentist = dentists.find(d => d.id === createDentistId)
  const availableProcedures: Procedure[] = selectedDentist
    ? selectedDentist.dentistProcedures.map(dp => dp.procedure)
    : []

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Agendamentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">{appointments.length} resultado(s)</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors shadow-sm shadow-brand-600/25"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
          </svg>
          Novo Agendamento
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Filtros</p>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Data inicial', type: 'date', value: startDate, onChange: setStartDate },
            { label: 'Data final', type: 'date', value: endDate, onChange: setEndDate },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
              <input type={f.type} value={f.value} onChange={e => f.onChange(e.target.value)}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Dentista</label>
            <select value={filterDentistId} onChange={e => setFilterDentistId(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-600/30 bg-white"
            >
              <option value="">Todos</option>
              {dentists.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-600/30 bg-white"
            >
              <option value="">Todos</option>
              {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={load}
              className="px-4 py-2 bg-navy-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors">
              Buscar
            </button>
            {(startDate || endDate || filterDentistId || filterStatus) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); setFilterDentistId(''); setFilterStatus(''); setTimeout(load, 0) }}
                className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingOverlay label="Carregando agendamentos…" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/>
            </svg>
            Nenhum agendamento encontrado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  {['Paciente', 'Dentista', 'Procedimento', 'Data/Hora', 'Status', ''].map((col, i) => (
                    <th key={i} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((apt, i) => (
                  <tr
                    key={apt.id}
                    className="hover:bg-slate-50/70 transition-colors animate-fade-in"
                    style={{ animationDelay: `${i * 25}ms` }}
                  >
                    <td className="px-5 py-3.5 cursor-pointer" onClick={() => { setSelected(apt); setCancelError('') }}>
                      <p className="font-medium text-slate-900">{apt.patient.name || '—'}</p>
                      <p className="text-xs text-slate-400">{apt.patient.phone}</p>
                    </td>
                    <td className="px-5 py-3.5 cursor-pointer" onClick={() => { setSelected(apt); setCancelError('') }}>
                      <p className="text-slate-800">{apt.dentist.name}</p>
                      {apt.dentist.specialty && <p className="text-xs text-slate-400">{apt.dentist.specialty}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 cursor-pointer" onClick={() => { setSelected(apt); setCancelError('') }}>
                      {apt.procedure.name}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs font-medium whitespace-nowrap cursor-pointer" onClick={() => { setSelected(apt); setCancelError('') }}>
                      {formatDate(apt.startTime)}
                    </td>
                    <td className="px-5 py-3.5 cursor-pointer" onClick={() => { setSelected(apt); setCancelError('') }}>
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[apt.status]}`}>
                        {statusLabels[apt.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {apt.status === 'SCHEDULED' && (
                        <div className="flex gap-1">
                          <button
                            title="Reagendar"
                            onClick={() => { setSelected(apt); openReschedule(apt) }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            title="Cancelar"
                            onClick={() => { setSelected(apt); setCancelError('') }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"/>
                              <path d="M15 9l-6 6M9 9l6 6"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Detalhes da Consulta ────────────────────────────────────── */}
      <Modal
        open={!!selected && !showReschedule}
        onClose={() => { setSelected(null); setCancelError('') }}
        title="Detalhes da Consulta"
        size="sm"
      >
        {selected && (
          <div className="space-y-5">
            <div className="space-y-3">
              {[
                { label: 'Status', value: <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[selected.status]}`}>{statusLabels[selected.status]}</span> },
                { label: 'Paciente', value: selected.patient.name || '—' },
                { label: 'WhatsApp', value: selected.patient.phone },
                { label: 'Dentista', value: `${selected.dentist.name}${selected.dentist.specialty ? ` · ${selected.dentist.specialty}` : ''}` },
                { label: 'Procedimento', value: selected.procedure.name },
                { label: 'Duração', value: `${selected.procedure.durationMinutes} min` },
                { label: 'Data/Hora', value: formatDate(selected.startTime) },
                { label: 'Observações', value: selected.notes || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-24 flex-shrink-0 pt-0.5">{label}</span>
                  <span className="text-sm text-slate-800">{value}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-400 mb-4">
                ID: <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{selected.id.slice(-12)}</code>
              </p>

              {selected.status === 'SCHEDULED' && (
                <div className="space-y-3">
                  {cancelError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{cancelError}</p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => openReschedule(selected)}
                      className="flex-1 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-colors"
                    >
                      Reagendar
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="flex-1 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {cancelling ? <><Spinner /> Cancelando…</> : 'Cancelar Consulta'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Reagendar ───────────────────────────────────────────────── */}
      <Modal
        open={showReschedule}
        onClose={() => { setShowReschedule(false); setRescheduleSelectedSlot(null); setRescheduleError('') }}
        title="Reagendar Consulta"
        size="md"
      >
        {selected && (
          <div className="space-y-5">
            <div className="bg-slate-50 rounded-xl p-3 space-y-1">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Consulta atual</p>
              <p className="text-sm font-semibold text-slate-800">{selected.procedure.name} · {selected.dentist.name}</p>
              <p className="text-sm text-slate-500">{formatDate(selected.startTime)}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">
                Novo horário
                {rescheduleSelectedSlot && (
                  <span className="ml-2 text-brand-600 font-semibold">
                    — {capitalize(rescheduleSelectedSlot.displayDate)} às {rescheduleSelectedSlot.displayStart}
                  </span>
                )}
              </p>
              <SlotGrid
                days={rescheduleSlots}
                selected={rescheduleSelectedSlot}
                onSelect={setRescheduleSelectedSlot}
                loading={rescheduleSlotsLoading}
              />
            </div>

            {rescheduleError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{rescheduleError}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowReschedule(false); setRescheduleSelectedSlot(null) }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleReschedule}
                disabled={rescheduling || !rescheduleSelectedSlot}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {rescheduling ? <><Spinner /> Reagendando…</> : 'Confirmar Reagendamento'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Novo Agendamento ─────────────────────────────────────────── */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); resetCreate() }}
        title="Novo Agendamento"
        size="lg"
      >
        <div className="space-y-5">

          {/* Patient search */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Paciente</label>
            {createPatient ? (
              <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {(createPatient.name || createPatient.phone)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{createPatient.name || '—'}</p>
                  <p className="text-xs text-slate-500">{createPatient.phone}</p>
                </div>
                <button type="button" onClick={() => { setCreatePatient(null); setCreatePatientSearch('') }} className="text-slate-400 hover:text-slate-600">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar por nome ou telefone…"
                    value={createPatientSearch}
                    onChange={e => handlePatientSearchChange(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 pr-9 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
                  />
                  {createPatientLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="block w-4 h-4 rounded-full border-2 border-slate-300 border-t-brand-600 animate-spin" />
                    </span>
                  )}
                </div>
                {createPatientResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    {createPatientResults.map(p => (
                      <button key={p.id} type="button"
                        onClick={() => { setCreatePatient(p); setCreatePatientResults([]) }}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center gap-3"
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {(p.name || p.phone)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{p.name || '—'}</p>
                          <p className="text-xs text-slate-400">{p.phone}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {createPatientSearch.length >= 2 && !createPatientLoading && createPatientResults.length === 0 && (
                  <p className="mt-1 text-xs text-slate-400">Nenhum paciente encontrado.</p>
                )}
              </>
            )}
          </div>

          {/* Dentist + Procedure */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Dentista</label>
              <select value={createDentistId} onChange={e => handleCreateDentistChange(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-600/30 bg-white"
              >
                <option value="">Selecione…</option>
                {dentists.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Procedimento</label>
              <select value={createProcedureId} onChange={e => handleCreateProcedureChange(e.target.value)}
                disabled={!createDentistId}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-600/30 bg-white disabled:opacity-50"
              >
                <option value="">Selecione…</option>
                {availableProcedures.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.durationMinutes}min)</option>
                ))}
              </select>
            </div>
          </div>

          {/* Slots */}
          {createProcedureId && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">
                Horário disponível
                {createSelectedSlot && (
                  <span className="ml-2 text-brand-600 font-semibold">
                    — {capitalize(createSelectedSlot.displayDate)} às {createSelectedSlot.displayStart}
                  </span>
                )}
              </p>
              <SlotGrid
                days={createSlots}
                selected={createSelectedSlot}
                onSelect={setCreateSelectedSlot}
                loading={createSlotsLoading}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Observações <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea value={createNotes} onChange={e => setCreateNotes(e.target.value)}
              rows={2} placeholder="Ex: paciente tem alergia a látex"
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-600/30 resize-none"
            />
          </div>

          {createError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{createError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => { setShowCreate(false); resetCreate() }}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button type="button" onClick={handleCreate}
              disabled={creating || !createPatient || !createDentistId || !createProcedureId || !createSelectedSlot}
              className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {creating ? <><Spinner /> Agendando…</> : 'Confirmar Agendamento'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
