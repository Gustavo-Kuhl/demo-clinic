import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Dentists from './pages/Dentists'
import Procedures from './pages/Procedures'
import Appointments from './pages/Appointments'
import Patients from './pages/Patients'
import Escalations from './pages/Escalations'
import FAQ from './pages/FAQ'
import Settings from './pages/Settings'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('admin_token')
  if (!token) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/dentistas" element={<RequireAuth><Dentists /></RequireAuth>} />
        <Route path="/procedimentos" element={<RequireAuth><Procedures /></RequireAuth>} />
        <Route path="/agendamentos" element={<RequireAuth><Appointments /></RequireAuth>} />
        <Route path="/pacientes" element={<RequireAuth><Patients /></RequireAuth>} />
        <Route path="/escalacoes" element={<RequireAuth><Escalations /></RequireAuth>} />
        <Route path="/faq" element={<RequireAuth><FAQ /></RequireAuth>} />
        <Route path="/configuracoes" element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
