import { useEffect, useState } from 'react'
import { api, type CostStats } from '../api/client'

const USD_TO_BRL = 5.70

const MODEL_PRICES: Record<string, [number, number]> = {
  'gpt-4.1-mini': [0.40, 1.60],
  'gpt-4.1-nano': [0.10, 0.40],
  'gpt-5-mini':   [0.25, 2.00],
  'gpt-4o-mini':  [0.15, 0.60],
}

function fmt(n: number, decimals = 4) {
  return n.toFixed(decimals)
}
function fmtBRL(usd: number) {
  return (usd * USD_TO_BRL).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function Spinner() {
  return (
    <span className="inline-block w-4 h-4 rounded-full border-2 border-slate-300 border-t-brand-600 animate-spin flex-shrink-0" />
  )
}

function StatCard({
  label, value, sub, color = 'brand',
}: { label: string; value: string; sub?: string; color?: 'brand' | 'emerald' | 'violet' | 'amber' }) {
  const colors = {
    brand:   'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet:  'bg-violet-50 text-violet-600',
    amber:   'bg-amber-50 text-amber-600',
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold font-display ${colors[color].split(' ')[1]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function Costs() {
  const [stats, setStats] = useState<CostStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Calculator
  const [calcMsgs, setCalcMsgs] = useState(50)
  const [calcModel, setCalcModel] = useState('gpt-5-mini')

  useEffect(() => {
    api.costs.getStats()
      .then(setStats)
      .catch(e => setError(e.message ?? 'Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [])

  const maxDailyCost = stats ? Math.max(...stats.daily.map(d => d.costUSD), 0.000001) : 1

  // Calculator logic
  // Avg: 3 OpenAI calls per conversation, ~1500 input + 300 output tokens per call
  const [inP, outP] = MODEL_PRICES[calcModel] ?? [0.40, 1.60]
  const avgCostPerMsg = ((1500 / 1_000_000) * inP + (300 / 1_000_000) * outP) * 3
  const estMonthlyUSD = avgCostPerMsg * calcMsgs * 30
  const estMonthlyBRL = estMonthlyUSD * USD_TO_BRL

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Custos IA</h1>
        <p className="text-sm text-slate-500 mt-0.5">Consumo de tokens e estimativa de gastos com a OpenAI</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
          <Spinner /><span className="text-sm">Carregando dados…</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-sm text-red-700">{error}</div>
      ) : stats && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Custo hoje"
              value={`$${fmt(stats.today.costUSD)}`}
              sub={fmtBRL(stats.today.costUSD)}
              color="brand"
            />
            <StatCard
              label="Custo este mês"
              value={`$${fmt(stats.thisMonth.costUSD)}`}
              sub={fmtBRL(stats.thisMonth.costUSD)}
              color="emerald"
            />
            <StatCard
              label="Custo total"
              value={`$${fmt(stats.allTime.costUSD)}`}
              sub={fmtBRL(stats.allTime.costUSD)}
              color="violet"
            />
            <StatCard
              label="Tokens (total)"
              value={fmtTokens(stats.allTime.totalTokens)}
              sub={`↑ ${fmtTokens(stats.allTime.promptTokens)} entrada · ↓ ${fmtTokens(stats.allTime.completionTokens)} saída`}
              color="amber"
            />
          </div>

          {/* By model */}
          {stats.byModel.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h2 className="font-display text-sm font-semibold text-slate-800">Por modelo</h2>
              </div>
              <div className="divide-y divide-slate-50">
                {stats.byModel.map(m => (
                  <div key={m.model} className="flex items-center gap-4 px-6 py-3">
                    <span className="font-mono text-sm text-slate-700 flex-1">{m.model}</span>
                    <span className="text-sm text-slate-500">{fmtTokens(m.totalTokens)} tokens</span>
                    <span className="text-sm font-semibold text-slate-800 w-24 text-right">${fmt(m.costUSD, 5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily usage table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-slate-800">Uso diário (últimos 30 dias)</h2>
              <span className="text-xs text-slate-400">{stats.daily.length} dia(s) com uso</span>
            </div>
            {stats.daily.length === 0 ? (
              <p className="text-center py-10 text-sm text-slate-400">Nenhum dado ainda. O rastreamento começa agora.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/40">
                      <th className="text-left px-5 py-3 font-medium text-slate-500">Data</th>
                      <th className="text-right px-5 py-3 font-medium text-slate-500">Entrada</th>
                      <th className="text-right px-5 py-3 font-medium text-slate-500">Saída</th>
                      <th className="text-right px-5 py-3 font-medium text-slate-500">Custo (USD)</th>
                      <th className="px-5 py-3 w-32" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {[...stats.daily].reverse().map(d => (
                      <tr key={d.date} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-700">
                          {new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                          })}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-500 font-mono text-xs">{fmtTokens(d.promptTokens)}</td>
                        <td className="px-5 py-3 text-right text-slate-500 font-mono text-xs">{fmtTokens(d.completionTokens)}</td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-800">${fmt(d.costUSD, 5)}</td>
                        <td className="px-5 py-3">
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full"
                              style={{ width: `${Math.min(100, (d.costUSD / maxDailyCost) * 100)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Calculator */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="font-display text-sm font-semibold text-slate-800">Calculadora de estimativa</h2>
          <p className="text-xs text-slate-500 mt-0.5">Estime o custo mensal baseado no volume de mensagens</p>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-2 block">
                Mensagens por dia: <strong>{calcMsgs}</strong>
              </span>
              <input
                type="range"
                min={1}
                max={500}
                value={calcMsgs}
                onChange={e => setCalcMsgs(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>1</span><span>250</span><span>500</span>
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-2 block">Modelo</span>
              <select
                value={calcModel}
                onChange={e => setCalcModel(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              >
                {Object.keys(MODEL_PRICES).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Entrada: ${MODEL_PRICES[calcModel]?.[0]}/1M · Saída: ${MODEL_PRICES[calcModel]?.[1]}/1M
              </p>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Custo por mensagem</p>
              <p className="text-lg font-bold font-display text-slate-800">${(avgCostPerMsg).toFixed(5)}</p>
            </div>
            <div className="rounded-xl bg-brand-50 border border-brand-100 p-4 text-center">
              <p className="text-xs text-brand-600 mb-1">Estimativa mensal (USD)</p>
              <p className="text-lg font-bold font-display text-brand-700">${fmt(estMonthlyUSD, 3)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-center">
              <p className="text-xs text-emerald-600 mb-1">Estimativa mensal (BRL)</p>
              <p className="text-lg font-bold font-display text-emerald-700">{fmtBRL(estMonthlyUSD)}</p>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            * Estimativa baseada em ~3 chamadas OpenAI por conversa, com ~1.500 tokens de entrada e ~300 de saída por chamada. Câmbio fixo: R$ {USD_TO_BRL.toFixed(2)}.
          </p>
        </div>
      </div>
    </div>
  )
}
