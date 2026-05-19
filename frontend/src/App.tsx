import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Admin from './pages/Admin'
// Se o seu arquivo de cadastro se chamar Cadastro.tsx ou Register.tsx, certifique-se de que ele está criado em pages
import Cadastro from './pages/Cadastro' 

// 🔐 Proteção do Painel do ADM
function RotaAdminProtegida({ children }: { children: React.ReactNode }) {
  const adminLogado = localStorage.getItem('betgol_admin_logado') === 'true'

  if (!adminLogado) {
    return <Navigate to="/login" replace />
  }

  return children
}

// 🔓 Proteção da Área do Usuário Comum (Dashboard)
function RotaUsuarioProtegida({ children }: { children: React.ReactNode }) {
  const userLogado = localStorage.getItem('betgol_user_logado') === 'true'

  if (!userLogado) {
    return <Navigate to="/login" replace />
  }

  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Área do Usuário Comum protegida */}
        <Route 
          path="/" 
          element={
            <RotaUsuarioProtegida>
              <Dashboard />
            </RotaUsuarioProtegida>
          } 
        />
        
        {/* Rota Pública de Login e Cadastro */}
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        
        {/* Rota do Admin protegida */}
        <Route 
          path="/admin" 
          element = {
            <RotaAdminProtegida>
              <Admin />
            </RotaAdminProtegida>
          } 
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
