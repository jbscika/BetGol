import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function AdminLogin() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const navigate = useNavigate()

  function entrarComoAdmin(e: React.FormEvent) {
    e.preventDefault()
    if (email === 'jbscika@gmail.com' && senha === 'He18@894') {
      localStorage.setItem('betgol_admin_logado', 'true')
      navigate('/admin')
    } else {
      alert('Acesso negado: Credenciais de Administrador inválidas.')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <form onSubmit={entrarComoAdmin} style={{ background: '#222', padding: '40px', borderRadius: '10px', width: '100%', maxWidth: '350px', color: '#fff', border: '1px solid #1a7a3a' }}>
        <h2 style={{ textAlign: 'center', color: '#1a7a3a' }}>PAINEL ADM</h2>
        <div style={{ marginBottom: '15px' }}>
          <label>E-mail do Administrador</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: 'none' }} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label>Senha Secreta</label>
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: 'none' }} />
        </div>
        <button type="submit" style={{ width: '100%', padding: '12px', background: '#1a7a3a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          ACESSAR PAINEL DE CONTROLE
        </button>
      </form>
    </div>
  )
}

export default AdminLogin
