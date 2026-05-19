import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
// 📁 Importa o auth já configurado do seu próprio projeto
import { auth } from './lib/firebase' 
import { onAuthStateChanged } from 'firebase/auth'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Admin from './pages/Admin'

// 🔐 Guarda de segurança da rota
function RotaProtegida({ children }) {
  const [estaLogado, setEstaLogado] = useState(null)

  useEffect(() => {
    if (!auth) {
      console.error("Firebase Auth não foi encontrado. Verifique o caminho no import.");
      setEstaLogado(false);
      return;
    }

    // Monitora o login usando o seu auth configurado
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setEstaLogado(!!user) // Vira true se tiver usuário, false se não tiver
    })

    return () => unsubscribe()
  }, [])

  // Enquanto o Firebase responde, não deixa a tela preta
  if (estaLogado === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFlamily: 'sans-serif' }}>
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
