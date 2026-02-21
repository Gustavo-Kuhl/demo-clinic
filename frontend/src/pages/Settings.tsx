import { useEffect, useState } from 'react'
import { api, type Settings } from '../api/client'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<Settings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.settings.get()
      .then(s => { setSettings(s ?? {}); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const updated = await api.settings.update(settings)
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function field(key: keyof Settings) {
    return {
      value: (settings[key] as string) ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setSettings(s => ({ ...s, [key]: e.target.value })),
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="shimmer-bg h-8 w-48 rounded-xl" />
        {[...Array(6)].map((_, i) => <div key={i} className="shimmer-bg h-12 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500 mt-0.5">Informações e comportamento do sistema</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Clinic Info */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-display text-sm font-semibold text-slate-800">Informações da Clínica</h2>
          </div>
          <div className="p-6 space-y-4">
            {[
              { label: 'Nome da Clínica', key: 'clinicName' as const, placeholder: 'Ex: Clínica Odonto Saúde' },
              { label: 'Telefone', key: 'clinicPhone' as const, placeholder: '5511999999999' },
              { label: 'Endereço', key: 'clinicAddress' as const, placeholder: 'Rua das Flores, 123 - São Paulo/SP' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">{label}</label>
                <input type="text" {...field(key)} placeholder={placeholder}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Bot Config */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-display text-sm font-semibold text-slate-800">Configurações do Bot</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Nome do Bot</label>
              <input type="text" {...field('botName')} placeholder="Sofia"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
              />
              <p className="text-xs text-slate-400 mt-1">Nome que o assistente virtual usará para se apresentar</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Mensagem de Boas-Vindas</label>
              <textarea {...field('botWelcomeMessage')} rows={3}
                placeholder="Olá! Sou a Sofia, assistente da {clinicName}..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">Use {'{clinicName}'} para inserir o nome da clínica automaticamente</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Política de Cancelamento</label>
              <textarea {...field('cancellationPolicy')} rows={3}
                placeholder="Para cancelar sem custo, entre em contato com até 24h de antecedência..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Attendant */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-display text-sm font-semibold text-slate-800">Atendente Humano</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">WhatsApp do Atendente</label>
              <input type="text" {...field('attendantPhone')} placeholder="5511999999999"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
              />
              <p className="text-xs text-slate-400 mt-1">Número que receberá notificações de escalação (com DDI, sem +)</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">E-mail do Atendente</label>
              <input type="email" {...field('attendantEmail')} placeholder="atendente@clinica.com"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Fuso Horário</label>
              <select value={settings.timezone ?? 'America/Sao_Paulo'}
                onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 bg-white"
              >
                <option value="America/Sao_Paulo">América/São Paulo (BRT, UTC-3)</option>
                <option value="America/Manaus">América/Manaus (AMT, UTC-4)</option>
                <option value="America/Belem">América/Belém (BRT, UTC-3)</option>
                <option value="America/Fortaleza">América/Fortaleza (BRT, UTC-3)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Feedback */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
            </svg>
            {error}
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-sm text-emerald-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Configurações salvas com sucesso!
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-navy-800 text-white font-semibold text-sm rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-60 shadow-sm"
        >
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </form>
    </div>
  )
}
