import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Admin from './pages/Admin'

// 🔐 Componente que protege a rota do ADM
function RotaProtegida({ children }) {
  const [estaLogado, setEstaLogado] = useState(null)

  useEffect(() => {
    try {
      // O getAuth() só é chamado QUANDO o componente entra na tela,
      // dando tempo para o seu arquivo principal iniciar o Firebase antes.
      const auth = getAuth()
      
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setEstaLogado(!!user)
      })

      return () => unsubscribe()
    } catch (error) {
      console.error("Erro ao iniciar Auth:", error)
      // Se der erro de inicialização, assume que não está logado para não travar a tela
      setEstaLogado(false)
    }
  }, [])

  // Enquanto o Firebase responde, mostra um aviso rápido
  if (estaLogado === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <h3>Verificando segurança...</h3>
      </div>
    )
  }

  // Se não estiver logado, manda para o login
  if (!estaLogado) {
    return <Navigate to="/login" replace />
  }

  // Se estiver logado, abre o Admin
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        
        {/* Rota Protegida */}
        <Route 
          path="/admin" 
          element={
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
