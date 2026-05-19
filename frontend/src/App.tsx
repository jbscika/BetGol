import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Admin from './pages/Admin'

// 🔑 Cole aqui as suas chaves públicas do Firebase (Web App)
// Você encontra isso nas configurações do seu projeto no console do Firebase
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "seu-id",
  appId: "seu-app-id"
};

// Inicializa o Firebase no navegador se ele ainda não tiver sido iniciado
if (!getApps().length) {
  initializeApp(firebaseConfig);
}

// 🔐 Componente que protege a rota do ADM
function RotaProtegida({ children }) {
  const [estaLogado, setEstaLogado] = useState<boolean | null>(null)

  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setEstaLogado(!!user)
    })
    return () => unsubscribe()
  }, [])

  if (estaLogado === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <h3>Verificando segurança...</h3>
      </div>
    )
  }

  if (!estaLogado) {
    return <Navigate to="/login" replace />
  }

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
