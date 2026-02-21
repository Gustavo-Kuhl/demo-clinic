import { useEffect, useState } from 'react'
import { api, type Escalation } from '../api/client'

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

export default function Escalations() {
  const [escalations, setEscalations] = useState<Escalation[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function load() {
    const data = await api.escalations.list()
    setEscalations(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function resolve(id: string) {
    setResolving(id)
    try {
      await api.escalations.resolve(id)
      await load()
    } finally {
      setResolving(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-slate-900">Escalações</h1>
          {escalations.length > 0 && (
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full ring-1 ring-amber-200">
              {escalations.length} pendente(s)
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-0.5">Atendimentos que precisam de ação humana</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="shimmer-bg h-24 rounded-2xl" />)}
        </div>
      ) : escalations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-emerald-50 rounded-2xl flex items-center justify-center">
            <svg className="w-6 h-6 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">Tudo em dia!</p>
          <p className="text-xs text-slate-400 mt-1">Nenhuma escalação pendente</p>
        </div>
      ) : (
        <div className="space-y-3">
          {escalations.map((esc, i) => (
            <div
              key={esc.id}
              className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden animate-fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="p-5 flex items-start gap-4">
                {/* Alert icon */}
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="18" height="18" className="text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round"/>
                    <path d="M12 9v4M12 17h.01" strokeLinecap="round"/>
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">
                        {esc.conversation.patient.name || 'Paciente'} · {esc.conversation.patient.phone}
                      </p>
                      {esc.reason && (
                        <p className="text-sm text-slate-600 mt-0.5">{esc.reason}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">{timeAgo(esc.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setExpanded(expanded === esc.id ? null : esc.id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                      >
                        {expanded === esc.id ? 'Ocultar' : 'Histórico'}
                      </button>
                      <button
                        onClick={() => resolve(esc.id)}
                        disabled={resolving === esc.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors disabled:opacity-60"
                      >
                        {resolving === esc.id ? 'Resolvendo...' : '✓ Resolver'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message history */}
              {expanded === esc.id && esc.conversation.messages.length > 0 && (
                <div className="px-5 pb-5 border-t border-slate-100 mt-1 pt-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Últimas mensagens</p>
                  {[...esc.conversation.messages].reverse().map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-xs px-3.5 py-2 rounded-2xl text-sm ${
                        msg.direction === 'OUTBOUND'
                          ? 'bg-brand-600 text-white rounded-tr-sm'
                          : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-xs mt-1 ${msg.direction === 'OUTBOUND' ? 'text-blue-200' : 'text-slate-400'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
