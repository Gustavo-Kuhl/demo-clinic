import { useEffect, useState } from 'react'
import { api, type Procedure } from '../api/client'
import Modal from '../components/Modal'

function blankProc(): Partial<Procedure> {
  return { name: '', description: '', durationMinutes: 60, price: undefined, active: true }
}

export default function Procedures() {
  const [procs, setProcs] = useState<Procedure[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Partial<Procedure>>(blankProc())
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const data = await api.procedures.list()
    setProcs(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setForm(blankProc())
    setEditing(null)
    setError('')
    setModalOpen(true)
  }

  function openEdit(p: Procedure) {
    setForm({ name: p.name, description: p.description, durationMinutes: p.durationMinutes, price: p.price, active: p.active })
    setEditing(p.id)
    setError('')
    setModalOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await api.procedures.update(editing, form)
      } else {
        await api.procedures.create(form)
      }
      setModalOpen(false)
      await load()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(p: Procedure) {
    await api.procedures.update(p.id, { active: !p.active })
    await load()
  }

  const active = procs.filter(p => p.active)
  const inactive = procs.filter(p => !p.active)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Procedimentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">{active.length} ativo(s) · {inactive.length} inativo(s)</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-navy-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors shadow-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          Novo Procedimento
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="shimmer-bg h-14 rounded-xl" />)}
          </div>
        ) : procs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2C8 2 5 5 5 8c0 2 .5 3.5 2 5l1 4h8l1-4c1.5-1.5 2-3 2-5 0-3-3-6-7-6z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Nenhum procedimento cadastrado
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                {['Procedimento', 'Descrição', 'Duração', 'Preço', 'Status', 'Ações'].map(col => (
                  <th key={col} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {procs.map((p, i) => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition-colors animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-slate-900">{p.name}</p>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 max-w-xs">
                    <p className="truncate">{p.description ?? '—'}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1 text-slate-700">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" strokeLinecap="round"/></svg>
                      {p.durationMinutes} min
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-700 font-medium">
                    {p.price != null ? `R$ ${p.price.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${p.active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                      {p.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleActive(p)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                          p.active
                            ? 'bg-red-50 hover:bg-red-100 text-red-600'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {p.active ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Procedimento' : 'Novo Procedimento'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Nome *</label>
            <input type="text" value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Limpeza Dental, Clareamento..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Descrição</label>
            <textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Descrição breve do procedimento..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Duração (minutos) *</label>
              <input type="number" min={5} step={5} value={form.durationMinutes ?? 60}
                onChange={e => setForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Preço (R$)</label>
              <input type="number" min={0} step={0.01} value={form.price ?? ''}
                onChange={e => setForm(f => ({ ...f, price: e.target.value ? parseFloat(e.target.value) : undefined }))}
                placeholder="Opcional"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="proc-active" checked={form.active ?? true} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
            <label htmlFor="proc-active" className="text-sm text-slate-700">Ativo</label>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-navy-800 text-white text-sm font-semibold disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
