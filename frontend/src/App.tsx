import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Admin from './pages/Admin' // <-- Substituímos o temporário pelo real!

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} /> {/* <-- Rota oficial ativada */}
      </Routes>
    </BrowserRouter>
  )
}

export default App
