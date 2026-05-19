import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Admin from './pages/Admin'

// 🔐 Componente de Guarda que protege a rota do ADM
function RotaProtegida({ children }) {
  const [estaLogado, setEstaLogado] = useState(null)
  const auth = getAuth()

  useEffect(() => {
    // Monitora em tempo real se o usuário está logado no Firebase
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setEstaLogado(true)
      } else {
        setEstaLogado(false)
      }
    })

    return () => unsubscribe()
  }, [auth])

  // Enquanto o Firebase descobre se tem alguém logado, mostra uma tela de carregamento
  if (estaLogado === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <h3>Verificando segurança...</h3>
      </div>
    )
  }

  // Se NÃO estiver logado, chuta o intruso de volta para a tela de /login
  if (!estaLogado) {
    return <Navigate to="/login" replace />
  }

  // Se estiver logado, deixa passar para o painel Admin
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        
        {/* 🔒 Agora a rota Admin está envelopada e protegida pela nossa trava */}
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
