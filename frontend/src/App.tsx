import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Admin from './pages/Admin'
import Cadastro from './pages/Cadastro'
import AdminLogin from './pages/AdminLogin' // Importando a nova tela

function RotaAdminProtegida({ children }: { children: React.ReactNode }) {
  const adminLogado = localStorage.getItem('betgol_admin_logado') === 'true'
  return adminLogado ? children : <Navigate to="/admin-login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Telas Públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/admin-login" element={<AdminLogin />} />

        {/* Área do Usuário Comum */}
        <Route path="/" element={<Dashboard />} />
        
        {/* Área do Admin Protegida */}
        <Route 
          path="/admin" 
          element={<RotaAdminProtegida><Admin /></RotaAdminProtegida>} 
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
