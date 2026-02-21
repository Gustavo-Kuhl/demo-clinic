import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.login(username, password)
      localStorage.setItem('admin_token', res.token)
      localStorage.setItem('admin_username', res.username)
      navigate('/')
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-navy-800 to-slate-900 flex items-center justify-center p-4">
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Card */}
        <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl overflow-hidden">
          {/* Top accent */}
          <div className="h-1.5 bg-gradient-to-r from-brand-600 via-teal-500 to-brand-600" />

          <div className="px-8 py-8">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-navy-800 flex items-center justify-center shadow-lg mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8 2 5 5 5 8c0 2 .5 3.5 2 5l1 4h8l1-4c1.5-1.5 2-3 2-5 0-3-3-6-7-6z" fill="white" fillOpacity=".9"/>
                  <path d="M9 17v2a1 1 0 001 1h4a1 1 0 001-1v-2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <h1 className="font-display text-2xl font-bold text-slate-900">Bem-vindo</h1>
              <p className="text-sm text-slate-500 mt-1">Painel Administrativo</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Usuário
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm
                    focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 transition-all"
                  placeholder="admin"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm
                    focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 transition-all"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-navy-800 text-white font-semibold text-sm
                  hover:bg-slate-700 disabled:opacity-60 transition-all duration-200 mt-2
                  flex items-center justify-center gap-2 shadow-md"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    Entrando...
                  </>
                ) : 'Entrar'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Sistema de Automação Odontológica
        </p>
      </div>
    </div>
  )
}
