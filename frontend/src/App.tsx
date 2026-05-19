import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'

// Componentes temporários apenas para o sistema não quebrar enquanto criamos os arquivos
const LoginTemporario = () => <div style={{ padding: 20, color: '#111' }}>Tela de Login (Será criada no próximo passo)</div>;
const AdminTemporario = () => <div style={{ padding: 20, color: '#111' }}>Área do ADM (Será criada em breve)</div>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota principal do seu site */}
        <Route path="/" element={<Dashboard />} />

        {/* Novas rotas que vamos construir */}
        <Route path="/login" element={<LoginTemporario />} />
        <Route path="/admin" element={<AdminTemporario />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
