import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Admin from './pages/Admin'

// 🔐 Trava de segurança: Só deixa passar se encontrar o aviso de que o admin logou
function RotaProtegida({ children }: { children: React.ReactNode }) {
  // Checa se existe a confirmação de login no navegador
  const adminLogado = localStorage.getItem('betgol_admin_logado') === 'true'

  if (!adminLogado) {
    // Se não estiver logado, chuta de volta para o login
    return <Navigate to="/login" replace />
  }

  // Se estiver logado, deixa entrar na tela de Admin
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        
        {/* Rota do Admin protegida pela nossa trava */}
        <Route 
          path="/admin" 
          element = {
            <RotaProtegida>
              <Admin />
            </RotaProtegida>
          } 
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
