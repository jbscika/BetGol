import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// 🔌 Inicialização forçada do Firebase antes do site carregar
import { initializeApp } from 'firebase/app'
import { firebaseConfig } from './lib/firebase' 

try {
  initializeApp(firebaseConfig)
  console.log("Firebase inicializado com sucesso no main.tsx!")
} catch (error) {
  console.error("Erro ao inicializar o Firebase no main.tsx:", error)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
