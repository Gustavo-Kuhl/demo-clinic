import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard', icon: <GridIcon /> },
  { to: '/dentistas', label: 'Dentistas', icon: <DoctorIcon /> },
  { to: '/procedimentos', label: 'Procedimentos', icon: <ToothIcon /> },
  { to: '/agendamentos', label: 'Agendamentos', icon: <CalIcon /> },
  { to: '/pacientes', label: 'Pacientes', icon: <UsersIcon /> },
  { to: '/escalacoes', label: 'Escalações', icon: <AlertIcon /> },
  { to: '/faq', label: 'FAQ', icon: <QuestionIcon /> },
  { to: '/configuracoes', label: 'Configurações', icon: <SettingsIcon /> },
]

// Itens da barra inferior (mobile) — os 4 mais usados + botão Menu
const bottomNavItems = [
  { to: '/', label: 'Início', icon: <GridIcon /> },
  { to: '/agendamentos', label: 'Agenda', icon: <CalIcon /> },
  { to: '/pacientes', label: 'Pacientes', icon: <UsersIcon /> },
  { to: '/escalacoes', label: 'Alertas', icon: <AlertIcon /> },
]

// Each nav item: py-2.5 (10px*2) + text-sm line-height (20px) = 40px
// Gap between items: space-y-2 = 8px
const ITEM_HEIGHT = 40
const ITEM_GAP = 8
const PILL_STEP = ITEM_HEIGHT + ITEM_GAP

export default function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const username = localStorage.getItem('admin_username') ?? 'Admin'

  const activeIndex = navItems.findIndex(item =>
    item.to === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.to)
  )

  const currentPage = navItems[activeIndex]?.label ?? 'Painel Admin'

  function logout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_username')
    navigate('/login')
  }

  return (
    <div className="flex h-[100dvh] bg-navy-800 sidebar-grain">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-navy-900/70 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-40
          w-72 lg:w-64 h-full flex flex-col flex-shrink-0
          bg-navy-800 sidebar-grain
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 pt-safe mt-safe border-b border-white/10" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))' }}>
          <div className="pb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8 2 5 5 5 8c0 2 .5 3.5 2 5l1 4h8l1-4c1.5-1.5 2-3 2-5 0-3-3-6-7-6z" fill="white" fillOpacity=".9"/>
                <path d="M9 17v2a1 1 0 001 1h4a1 1 0 001-1v-2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-white leading-tight">Clínica</p>
              <p className="text-xs text-slate-400 font-body">Painel Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="relative">
            {/* Sliding pill */}
            {activeIndex >= 0 && (
              <div
                className="absolute inset-x-0 rounded-xl bg-brand-600 shadow-md shadow-brand-600/40 pointer-events-none"
                style={{
                  height: ITEM_HEIGHT,
                  top: 0,
                  transform: `translateY(${activeIndex * PILL_STEP}px)`,
                  transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                  willChange: 'transform',
                }}
              />
            )}

            <div className="space-y-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `relative z-10 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-white/10 pb-safe" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-brand-400">
                {username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{username}</p>
              <p className="text-xs text-slate-500">Administrador</p>
            </div>
            <button
              onClick={logout}
              title="Sair"
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 lg:p-2">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 lg:rounded-2xl">

          {/* Topbar mobile — mostra título da página atual */}
          <header
            className="lg:hidden flex items-center justify-between px-4 bg-navy-800 border-b border-white/10"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))', paddingBottom: '0.75rem' }}
          >
            {/* Logo + título */}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8 2 5 5 5 8c0 2 .5 3.5 2 5l1 4h8l1-4c1.5-1.5 2-3 2-5 0-3-3-6-7-6z" fill="white" fillOpacity=".95"/>
                </svg>
              </div>
              <p className="font-display text-sm font-semibold text-white">{currentPage}</p>
            </div>

            {/* Botão menu completo */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 active:bg-white/20 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round"/>
              </svg>
            </button>
          </header>

          {/* Content — pb-nav reserva espaço para a bottom nav no mobile */}
          <main className="flex-1 overflow-y-auto p-4 pb-nav lg:p-8 lg:pb-8">
            {children}
          </main>
        </div>
      </div>

      {/* Bottom Navigation — apenas mobile */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-navy-800 border-t border-white/10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch h-16">
          {bottomNavItems.map((item) => {
            const isActive = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors active:bg-white/5"
              >
                <span className={`w-5 h-5 transition-colors ${isActive ? 'text-brand-400' : 'text-slate-500'}`}>
                  {item.icon}
                </span>
                <span className={`text-[10px] font-medium leading-none transition-colors ${isActive ? 'text-brand-400' : 'text-slate-500'}`}>
                  {item.label}
                </span>
              </NavLink>
            )
          })}

          {/* Botão Menu — abre o sidebar com todos os itens */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-slate-500 active:bg-white/5 transition-colors"
          >
            <span className="w-5 h-5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round"/>
              </svg>
            </span>
            <span className="text-[10px] font-medium leading-none">Menu</span>
          </button>
        </div>
      </nav>
    </div>
  )
}

// ---- Icons ----
function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}
function DoctorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round"/>
    </svg>
  )
}
function ToothIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3C8 3 5 6 5 9c0 2 .5 3.5 2 5l1 4h8l1-4c1.5-1.5 2-3 2-5 0-3-3-6-7-6z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function CalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/>
    </svg>
  )
}
function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function QuestionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" strokeLinecap="round"/>
    </svg>
  )
}
function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round"/>
    </svg>
  )
}
function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="7" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round"/>
      <path d="M16 3.13a4 4 0 010 7.75" strokeLinecap="round"/>
      <path d="M21 20c0-3-1.8-5.4-4-6" strokeLinecap="round"/>
    </svg>
  )
}
