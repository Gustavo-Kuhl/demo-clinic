import { useEffect, useState } from 'react'
import { api, type FAQ } from '../api/client'
import Modal from '../components/Modal'

const CATEGORIES = [
  { value: 'pagamento', label: 'Pagamento' },
  { value: 'horarios', label: 'Horários' },
  { value: 'procedimentos', label: 'Procedimentos' },
  { value: 'agendamento', label: 'Agendamento' },
  { value: 'emergencia', label: 'Emergência' },
  { value: 'outros', label: 'Outros' },
]

const catColors: Record<string, string> = {
  pagamento: 'bg-emerald-50 text-emerald-700',
  horarios: 'bg-blue-50 text-blue-700',
  procedimentos: 'bg-teal-50 text-teal-700',
  agendamento: 'bg-violet-50 text-violet-700',
  emergencia: 'bg-red-50 text-red-600',
  outros: 'bg-slate-100 text-slate-600',
}

function blankFAQ(): Partial<FAQ> {
  return { question: '', answer: '', category: 'outros', active: true, order: 0 }
}

export default function FAQPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Partial<FAQ>>(blankFAQ())
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  async function load() {
    const data = await api.faqs.list()
    setFaqs(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setForm(blankFAQ())
    setEditing(null)
    setError('')
    setModalOpen(true)
  }

  function openEdit(f: FAQ) {
    setForm({ question: f.question, answer: f.answer, category: f.category, active: f.active, order: f.order })
    setEditing(f.id)
    setError('')
    setModalOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await api.faqs.update(editing, form)
      } else {
        await api.faqs.create(form)
      }
      setModalOpen(false)
      await load()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Confirma a exclusão desta pergunta?')) return
    await api.faqs.delete(id)
    await load()
  }

  async function toggleActive(f: FAQ) {
    await api.faqs.update(f.id, { active: !f.active })
    await load()
  }

  const filtered = faqs.filter(f => !filterCat || f.category === filterCat)

  // Group by category
  const grouped = filtered.reduce<Record<string, FAQ[]>>((acc, f) => {
    const cat = f.category ?? 'outros'
    ;(acc[cat] = acc[cat] ?? []).push(f)
    return acc
  }, {})

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">FAQ</h1>
          <p className="text-sm text-slate-500 mt-0.5">{faqs.filter(f => f.active).length} pergunta(s) ativa(s)</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-navy-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors shadow-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          Nova Pergunta
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCat('')}
          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${!filterCat ? 'bg-navy-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          Todas
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setFilterCat(cat.value)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${filterCat === cat.value ? 'bg-navy-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="shimmer-bg h-20 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-14 text-center text-slate-400 text-sm">
          Nenhuma pergunta encontrada
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, items]) => {
            const catInfo = CATEGORIES.find(c => c.value === cat)
            return (
              <div key={cat}>
                <h2 className={`inline-flex text-xs font-bold px-3 py-1 rounded-full mb-3 ${catColors[cat] ?? catColors.outros}`}>
                  {catInfo?.label ?? cat}
                </h2>
                <div className="space-y-2">
                  {items.map((f, i) => (
                    <div
                      key={f.id}
                      className={`bg-white rounded-2xl border shadow-sm overflow-hidden animate-fade-in transition-all ${f.active ? 'border-slate-100' : 'border-slate-100 opacity-60'}`}
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <div
                        className="flex items-start justify-between gap-4 p-4 cursor-pointer"
                        onClick={() => setExpanded(expanded === f.id ? null : f.id)}
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <svg
                            className={`w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400 transition-transform ${expanded === f.id ? 'rotate-90' : ''}`}
                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          >
                            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <p className="text-sm font-medium text-slate-900">{f.question}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={e => { e.stopPropagation(); toggleActive(f) }}
                            className={`text-xs px-2 py-1 rounded-lg font-medium ${f.active ? 'bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500' : 'bg-emerald-50 text-emerald-700'}`}>
                            {f.active ? 'Desativar' : 'Ativar'}
                          </button>
                          <button onClick={e => { e.stopPropagation(); openEdit(f) }}
                            className="text-xs px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium">
                            Editar
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleDelete(f.id) }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      {expanded === f.id && (
                        <div className="px-4 pb-4 pt-0 border-t border-slate-100">
                          <p className="text-sm text-slate-600 mt-3 leading-relaxed">{f.answer}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Pergunta' : 'Nova Pergunta'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Pergunta *</label>
            <input type="text" value={form.question ?? ''} onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
              placeholder="Ex: Quais formas de pagamento vocês aceitam?"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Resposta *</label>
            <textarea value={form.answer ?? ''} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
              rows={5} placeholder="Resposta completa e clara..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Categoria</label>
              <select value={form.category ?? 'outros'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 bg-white"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Ordem</label>
              <input type="number" min={0} value={form.order ?? 0} onChange={e => setForm(f => ({ ...f, order: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="faq-active" checked={form.active ?? true} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
            <label htmlFor="faq-active" className="text-sm text-slate-700">Ativo (visível para o bot)</label>
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
