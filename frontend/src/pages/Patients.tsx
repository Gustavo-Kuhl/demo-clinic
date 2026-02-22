import { useEffect, useState, useRef } from 'react'
import { api, type Patient, type Appointment } from '../api/client'
import Modal from '../components/Modal'

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-block w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0
      ${light ? 'border-white/40 border-t-white' : 'border-slate-300 border-t-brand-600'}`}
    />
  )
}

function formatCpf(cpf?: string) {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Agendada',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
  RESCHEDULED: 'Reagendada',
}

const STATUS_CLASSES: Record<string, string> = {
  SCHEDULED: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-red-50 text-red-600',
  RESCHEDULED: 'bg-amber-50 text-amber-700',
}

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState<Patient | null>(null)
  const [form, setForm] = useState({ name: '', cpf: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // History modal
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Delete modal
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load(q?: string) {
    setLoading(true)
    try {
      const data = await api.patients.list(q)
      setPatients(data)
    } finally {
      setLoading(false)
    }
  }

  function onSearchChange(val: string) {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => load(val || undefined), 400)
  }

  function openEdit(p: Patient) {
    setSelected(p)
    setForm({
      name: p.name ?? '',
      cpf: p.cpf ?? '',
      email: p.email ?? '',
      phone: p.phone,
    })
    setEditError('')
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!selected) return
    setSaving(true)
    setEditError('')
    try {
      const updated = await api.patients.update(selected.id, {
        name: form.name || undefined,
        cpf: form.cpf || undefined,
        email: form.email || undefined,
        phone: form.phone,
      })
      setPatients(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
      setEditOpen(false)
    } catch (e: any) {
      setEditError(e.message ?? 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function openHistory(p: Patient) {
    setHistoryPatient(p)
    setAppointments([])
    setHistoryOpen(true)
    setHistoryLoading(true)
    try {
      const data = await api.patients.getAppointments(p.id)
      setAppointments(data)
    } finally {
      setHistoryLoading(false)
    }
  }

  function openDelete(p: Patient) {
    setDeleteTarget(p)
    setDeleteError('')
    setDeleteOpen(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await api.patients.delete(deleteTarget.id)
      setPatients(prev => prev.filter(p => p.id !== deleteTarget.id))
      setDeleteOpen(false)
    } catch (e: any) {
      setDeleteError(e.message ?? 'Erro ao excluir paciente')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Pacientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gerencie e edite os dados dos pacientes</p>
        </div>
        <div className="text-sm text-slate-500 font-medium">
          {!loading && `${patients.length} paciente(s)`}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
          </svg>
        </span>
        <input
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          placeholder="Buscar por nome, telefone ou CPF…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
            <Spinner /><span className="text-sm">Carregando…</span>
          </div>
        ) : patients.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            {search ? `Nenhum paciente encontrado para "${search}"` : 'Nenhum paciente cadastrado ainda.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-5 py-3 font-medium text-slate-500">Paciente</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500">Telefone</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500">CPF</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500">E-mail</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500">Consultas</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500">Cadastro</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-brand-600">
                            {(p.name ?? p.phone).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-slate-800">
                          {p.name ?? <span className="text-slate-400 italic">Sem nome</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 font-mono">{p.phone}</td>
                    <td className="px-5 py-3.5 text-slate-600">{formatCpf(p.cpf)}</td>
                    <td className="px-5 py-3.5 text-slate-600">{p.email ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => openHistory(p)}
                        title="Ver consultas"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-600 transition-colors text-xs font-medium"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/>
                        </svg>
                        {p._count?.appointments ?? 0}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{formatDate(p.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(p)}
                          title="Editar dados"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => openDelete(p)}
                          title="Excluir paciente"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <polyline points="3 6 5 6 21 6" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M10 11v6M14 11v6" strokeLinecap="round"/>
                            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar Paciente">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome completo">
              <input
                className="input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nome do paciente"
              />
            </Field>
            <Field label="Telefone (WhatsApp)">
              <input
                className="input font-mono"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="5511999999999"
              />
            </Field>
            <Field label="CPF">
              <input
                className="input"
                value={form.cpf}
                onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))}
                placeholder="000.000.000-00"
              />
            </Field>
            <Field label="E-mail">
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </Field>
          </div>

          {editError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{editError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setEditOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={saveEdit}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {saving && <Spinner light />}
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── History Modal ── */}
      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={historyPatient ? `Consultas — ${historyPatient.name ?? historyPatient.phone}` : 'Consultas'}
      >
        {historyLoading ? (
          <div className="flex items-center justify-center py-10 gap-3 text-slate-500">
            <Spinner /><span className="text-sm">Carregando…</span>
          </div>
        ) : appointments.length === 0 ? (
          <p className="text-center py-10 text-sm text-slate-400">Nenhuma consulta encontrada.</p>
        ) : (
          <div className="space-y-3">
            {appointments.map(a => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-800 text-sm">{a.procedure.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[a.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_LABELS[a.status] ?? a.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    🦷 {a.dentist.name} &nbsp;·&nbsp; {formatDateTime(a.startTime)}
                  </p>
                  {a.notes && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">📝 {a.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ── Delete Confirmation Modal ── */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Excluir Paciente" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-100">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round"/>
              <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round"/>
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">Esta ação é irreversível</p>
              <p className="text-sm text-red-700 mt-0.5">
                Todos os dados do paciente <strong>{deleteTarget?.name ?? deleteTarget?.phone}</strong> serão excluídos permanentemente, incluindo consultas e histórico de conversas.
              </p>
            </div>
          </div>

          {deleteError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{deleteError}</p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              {deleting && <Spinner light />}
              {deleting ? 'Excluindo…' : 'Excluir permanentemente'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 mb-1.5 block">{label}</span>
      {children}
    </label>
  )
}
