import { useEffect, useState } from 'react'
import { api, type DashboardData } from '../api/client'

function formatDate(iso: string) {
  const d = new Date(iso)
  const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} · ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

const statusColors: Record<string, string> = {
  SCHEDULED: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  CANCELLED: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  RESCHEDULED: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
}
const statusLabels: Record<string, string> = {
  SCHEDULED: 'Agendado', CANCELLED: 'Cancelado', COMPLETED: 'Concluído', RESCHEDULED: 'Reagendado',
}

function Skeleton() {
  return <div className="shimmer-bg h-5 rounded-lg w-20" />
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.dashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const whatsConnected = data?.whatsappStatus?.connected

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Visão geral da clínica</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: 'Consultas Hoje',
            value: data?.stats.appointmentsToday,
            icon: <CalTodayIcon />,
            color: 'text-brand-600',
            bg: 'bg-brand-50',
          },
          {
            label: 'Consultas no Mês',
            value: data?.stats.appointmentsMonth,
            icon: <CalMonthIcon />,
            color: 'text-teal-600',
            bg: 'bg-teal-50',
          },
          {
            label: 'Escalações Pendentes',
            value: data?.stats.pendingEscalations,
            icon: <AlertStatIcon />,
            color: data?.stats.pendingEscalations ? 'text-amber-600' : 'text-slate-500',
            bg: data?.stats.pendingEscalations ? 'bg-amber-50' : 'bg-slate-50',
          },
          {
            label: 'WhatsApp',
            value: whatsConnected === undefined ? '—' : whatsConnected ? 'Conectado' : 'Desconectado',
            icon: <WhatsIcon />,
            color: whatsConnected ? 'text-emerald-600' : 'text-red-500',
            bg: whatsConnected ? 'bg-emerald-50' : 'bg-red-50',
            dot: whatsConnected !== undefined,
            dotColor: whatsConnected ? 'bg-emerald-500' : 'bg-red-500',
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-4"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
              <span className={`w-5 h-5 ${stat.color}`}>{stat.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 mb-0.5">{stat.label}</p>
              <div className="flex items-center gap-2">
                {loading ? (
                  <Skeleton />
                ) : (
                  <>
                    {stat.dot && (
                      <span className={`w-2 h-2 rounded-full ${stat.dotColor} flex-shrink-0`} />
                    )}
                    <span className={`text-xl font-bold font-display ${stat.color}`}>
                      {stat.value ?? 0}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming appointments */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900">Próximas Consultas</h2>
          <span className="text-xs text-slate-400 font-medium">Próximas 10</span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="shimmer-bg h-12 rounded-xl" />
            ))}
          </div>
        ) : !data?.upcomingAppointments?.length ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/>
            </svg>
            Nenhuma consulta agendada
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  {['Paciente', 'Dentista', 'Procedimento', 'Data/Hora', 'Status'].map(col => (
                    <th key={col} className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.upcomingAppointments.map((apt, i) => (
                  <tr key={apt.id} className="hover:bg-slate-50/70 transition-colors" style={{ animationDelay: `${i * 30}ms` }}>
                    <td className="px-6 py-3.5">
                      <div className="font-medium text-slate-900">{apt.patient.name || '—'}</div>
                      <div className="text-xs text-slate-400">{apt.patient.phone}</div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="text-slate-800">{apt.dentist.name}</div>
                      {apt.dentist.specialty && (
                        <div className="text-xs text-slate-400">{apt.dentist.specialty}</div>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-slate-700">{apt.procedure.name}</td>
                    <td className="px-6 py-3.5 text-slate-600 text-xs font-medium">{formatDate(apt.startTime)}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[apt.status]}`}>
                        {statusLabels[apt.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function CalTodayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/>
      <path d="M12 15v-4l-1.5 1" strokeLinecap="round"/>
    </svg>
  )
}
function CalMonthIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/>
      <path d="M8 14h8M8 18h5" strokeLinecap="round"/>
    </svg>
  )
}
function AlertStatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round"/>
      <path d="M12 9v4M12 17h.01" strokeLinecap="round"/>
    </svg>
  )
}
function WhatsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}
