import { useEffect, useState } from 'react'
import { api, type Dentist, type Procedure } from '../api/client'
import Modal from '../components/Modal'

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function blank(): Partial<Dentist> {
  return { name: '', specialty: '', calendarId: '', phone: '', email: '', bio: '', active: true }
}

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-block w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0
      ${light ? 'border-white/40 border-t-white' : 'border-slate-300 border-t-brand-600'}`}
    />
  )
}

export default function Dentists() {
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [allProcedures, setAllProcedures] = useState<Procedure[]>([])
  const [loading, setLoading] = useState(true)

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Partial<Dentist>>(blank())
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Hours modal
  const [hoursModal, setHoursModal] = useState<Dentist | null>(null)
  const [hoursEdit, setHoursEdit] = useState<Record<number, { active: boolean; start: string; end: string }>>({})
  const [hoursSaving, setHoursSaving] = useState(false)

  // Procedures modal — edit in batch, confirm to save
  const [procsModal, setProcsModal] = useState<Dentist | null>(null)
  const [pendingProcIds, setPendingProcIds] = useState<Set<string>>(new Set())
  const [originalProcIds, setOriginalProcIds] = useState<Set<string>>(new Set())
  const [procsSaving, setProcsSaving] = useState(false)
  const [procsError, setProcsError] = useState('')

  async function load() {
    setLoading(true)
    const [d, p] = await Promise.all([api.dentists.list(), api.procedures.list()])
    setDentists(d)
    setAllProcedures(p)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Create / Edit ─────────────────────────────────────────────────────────
  function openCreate() {
    setForm(blank()); setEditing(null); setError(''); setModalOpen(true)
  }

  function openEdit(d: Dentist) {
    setForm({ name: d.name, specialty: d.specialty, calendarId: d.calendarId, phone: d.phone, email: d.email, bio: d.bio, active: d.active })
    setEditing(d.id); setError(''); setModalOpen(true)
  }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      if (editing) await api.dentists.update(editing, form)
      else await api.dentists.create(form)
      setModalOpen(false)
      await load()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // ── Hours ─────────────────────────────────────────────────────────────────
  function openHours(d: Dentist) {
    const state: Record<number, { active: boolean; start: string; end: string }> = {}
    for (let i = 0; i < 7; i++) {
      const wh = d.workingHours.find(h => h.dayOfWeek === i)
      state[i] = { active: !!wh?.active, start: wh?.startTime ?? '08:00', end: wh?.endTime ?? '18:00' }
    }
    setHoursEdit(state)
    setHoursModal(d)
  }

  async function saveHours() {
    if (!hoursModal) return
    setHoursSaving(true)
    await Promise.all(
      Object.entries(hoursEdit).map(([dayStr, val]) =>
        api.dentists.setHours(hoursModal.id, parseInt(dayStr), val.start, val.end, val.active)
      )
    )
    setHoursSaving(false)
    setHoursModal(null)
    await load()
  }

  // ── Procedures (batch edit) ───────────────────────────────────────────────
  function openProcs(d: Dentist) {
    const linked = new Set(d.dentistProcedures.map(dp => dp.procedureId))
    setPendingProcIds(new Set(linked))
    setOriginalProcIds(new Set(linked))
    setProcsError('')
    setProcsModal(d)
  }

  function togglePending(procId: string) {
    setPendingProcIds(prev => {
      const next = new Set(prev)
      if (next.has(procId)) next.delete(procId)
      else next.add(procId)
      return next
    })
  }

  async function saveProcs() {
    if (!procsModal) return
    setProcsSaving(true)
    setProcsError('')
    try {
      // Procedures to add (in pending but not in original)
      const toAdd = [...pendingProcIds].filter(id => !originalProcIds.has(id))
      // Procedures to remove (in original but not in pending)
      const toRemove = [...originalProcIds].filter(id => !pendingProcIds.has(id))

      await Promise.all([
        ...toAdd.map(id => api.dentists.linkProcedure(procsModal.id, id)),
        ...toRemove.map(id => api.dentists.unlinkProcedure(procsModal.id, id)),
      ])

      setProcsModal(null)
      await load()
    } catch (e: unknown) {
      setProcsError((e as Error).message || 'Erro ao salvar procedimentos.')
    } finally {
      setProcsSaving(false)
    }
  }

  // Count pending changes
  const pendingChanges =
    [...pendingProcIds].filter(id => !originalProcIds.has(id)).length +
    [...originalProcIds].filter(id => !pendingProcIds.has(id)).length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Dentistas</h1>
          <p className="text-sm text-slate-500 mt-0.5">{dentists.length} profissional(is) cadastrado(s)</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-navy-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors shadow-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
          </svg>
          Novo Dentista
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="shimmer-bg h-48 rounded-2xl" />)}
        </div>
      ) : dentists.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round"/>
          </svg>
          <p className="text-sm">Nenhum dentista cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dentists.map((d, i) => (
            <div
              key={d.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-sm font-display">
                    {d.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{d.name}</p>
                    <p className="text-xs text-slate-500">{d.specialty ?? 'Clínico Geral'}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {d.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              {/* Working days */}
              <div className="mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Dias de atendimento</p>
                <div className="flex gap-1 flex-wrap">
                  {DAYS.map((day, idx) => {
                    const has = d.workingHours.some(wh => wh.dayOfWeek === idx && wh.active)
                    return (
                      <span key={idx} className={`text-xs px-2 py-0.5 rounded-full font-medium ${has ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400'}`}>
                        {day.slice(0, 3)}
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* Procedures */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Procedimentos ({d.dentistProcedures.length})
                </p>
                <div className="flex gap-1 flex-wrap">
                  {d.dentistProcedures.slice(0, 3).map(dp => (
                    <span key={dp.procedureId} className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">
                      {dp.procedure.name}
                    </span>
                  ))}
                  {d.dentistProcedures.length > 3 && (
                    <span className="text-xs text-slate-400">+{d.dentistProcedures.length - 3}</span>
                  )}
                  {d.dentistProcedures.length === 0 && (
                    <span className="text-xs text-slate-400">Nenhum vinculado</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button onClick={() => openEdit(d)}
                  className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">
                  Editar
                </button>
                <button onClick={() => openHours(d)}
                  className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 transition-colors">
                  Horários
                </button>
                <button onClick={() => openProcs(d)}
                  className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 transition-colors">
                  Procedimentos
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Criar / Editar Dentista ──────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Dentista' : 'Novo Dentista'}>
        <div className="space-y-4">
          {([
            { label: 'Nome completo *', key: 'name', placeholder: 'Dr. João Silva' },
            { label: 'Especialidade', key: 'specialty', placeholder: 'Ortodontia, Endodontia...' },
            { label: 'ID do Google Calendar *', key: 'calendarId', placeholder: 'email@gmail.com ou ID do calendário' },
            { label: 'Telefone', key: 'phone', placeholder: '(11) 99999-9999' },
            { label: 'E-mail', key: 'email', placeholder: 'doutor@clinica.com' },
          ] as const).map(field => (
            <div key={field.key}>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{field.label}</label>
              <input
                type="text"
                value={(form[field.key] as string) ?? ''}
                onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Bio / Apresentação</label>
            <textarea
              value={form.bio ?? ''}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              rows={3}
              placeholder="Breve descrição do profissional..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={form.active ?? true}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
            <label htmlFor="active" className="text-sm text-slate-700">Ativo</label>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-navy-800 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Spinner light /> Salvando…</> : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Horários de Atendimento ──────────────────────────────────── */}
      <Modal open={!!hoursModal} onClose={() => setHoursModal(null)} title={`Horários — ${hoursModal?.name ?? ''}`}>
        <div className="space-y-2">
          <p className="text-xs text-slate-500 mb-3">Marque os dias de atendimento e defina os horários de início e fim.</p>
          {DAYS.map((day, idx) => {
            const isActive = hoursEdit[idx]?.active ?? false
            return (
              <div key={idx} className={`rounded-xl border p-3 transition-colors ${isActive ? 'border-brand-200 bg-brand-50/40' : 'border-slate-100 bg-slate-50/50'}`}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`day-${idx}`}
                    checked={isActive}
                    onChange={e => setHoursEdit(h => ({ ...h, [idx]: { ...h[idx], active: e.target.checked } }))}
                    className="rounded border-slate-300 text-brand-600 w-4 h-4 flex-shrink-0 cursor-pointer"
                  />
                  <label htmlFor={`day-${idx}`} className="text-sm font-semibold text-slate-700 w-20 flex-shrink-0 cursor-pointer select-none">
                    {day}
                  </label>
                  {isActive ? (
                    <div className="flex items-center gap-2 ml-auto flex-wrap">
                      <input
                        type="time"
                        value={hoursEdit[idx]?.start ?? '08:00'}
                        onChange={e => setHoursEdit(h => ({ ...h, [idx]: { ...h[idx], start: e.target.value } }))}
                        className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-600/30 bg-white"
                      />
                      <span className="text-slate-400 text-xs font-medium">até</span>
                      <input
                        type="time"
                        value={hoursEdit[idx]?.end ?? '18:00'}
                        onChange={e => setHoursEdit(h => ({ ...h, [idx]: { ...h[idx], end: e.target.value } }))}
                        className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-600/30 bg-white"
                      />
                    </div>
                  ) : (
                    <span className="ml-auto text-xs text-slate-400 italic">Não atende</span>
                  )}
                </div>
              </div>
            )
          })}
          <div className="flex gap-3 pt-3">
            <button onClick={() => setHoursModal(null)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button onClick={saveHours} disabled={hoursSaving}
              className="flex-1 py-2.5 rounded-xl bg-navy-800 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {hoursSaving ? <><Spinner light /> Salvando…</> : 'Salvar Horários'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Procedimentos (batch edit) ──────────────────────────────── */}
      <Modal open={!!procsModal} onClose={() => setProcsModal(null)} title={`Procedimentos — ${procsModal?.name ?? ''}`}>
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Marque os procedimentos realizados por este dentista. As alterações só serão salvas ao clicar em <strong>Confirmar</strong>.
          </p>

          {/* Changes badge */}
          {pendingChanges > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600 flex-shrink-0">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
              </svg>
              <p className="text-xs text-amber-700 font-medium">
                {pendingChanges} alteração(ões) pendente(s) — não salva(s) ainda
              </p>
            </div>
          )}

          {allProcedures.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">Nenhum procedimento cadastrado.</p>
          )}

          <div className="space-y-2">
            {allProcedures.map(proc => {
              const isLinked = pendingProcIds.has(proc.id)
              const wasLinked = originalProcIds.has(proc.id)
              const changed = isLinked !== wasLinked

              return (
                <label
                  key={proc.id}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    isLinked
                      ? changed
                        ? 'border-teal-300 bg-teal-50/70 ring-1 ring-teal-200'
                        : 'border-teal-200 bg-teal-50/40'
                      : changed
                        ? 'border-red-200 bg-red-50/40 ring-1 ring-red-100'
                        : 'border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${isLinked ? 'bg-teal-500' : 'bg-slate-300'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800 truncate">{proc.name}</p>
                        {changed && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isLinked ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-600'}`}>
                            {isLinked ? '+adicionado' : '–removido'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{proc.durationMinutes} min{proc.price ? ` · R$ ${proc.price}` : ''}</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isLinked}
                    onChange={() => togglePending(proc.id)}
                    className="rounded border-slate-300 text-teal-600 w-4 h-4 flex-shrink-0 ml-3 cursor-pointer"
                  />
                </label>
              )
            })}
          </div>

          {procsError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{procsError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setProcsModal(null)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={saveProcs}
              disabled={procsSaving || pendingChanges === 0}
              className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {procsSaving
                ? <><Spinner light /> Salvando…</>
                : pendingChanges === 0
                  ? 'Sem alterações'
                  : `Confirmar ${pendingChanges} alteração(ões)`
              }
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
