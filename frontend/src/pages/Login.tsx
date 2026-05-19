import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const navigate = useNavigate()

  function LidarComLogin(e: React.FormEvent) {
    e.preventDefault()
    
    // 🔐 Lógica de Login Única
    if (email === 'jbscika@gmail.com' && senha === 'He18@894') {
      localStorage.setItem('betgol_admin_logado', 'true')
      navigate('/admin') // Você vai para o ADM
    } else {
      // Aqui seria a lógica para usuários comuns
      alert('Login efetuado! (Redirecionando para a área do cliente...)')
      navigate('/') 
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f8' }}>
      <div style={{ background: '#fff', padding: '40px', borderRadius: '8px', width: '350px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign: 'center', color: '#1a7a3a' }}>BETGOL</h2>
        
        <form onSubmit={LidarComLogin}>
          <input type="email" placeholder="E-mail" onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px' }} />
          <input type="password" placeholder="Senha" onChange={e => setSenha(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '20px' }} />
          
          <button type="submit" style={{ width: '100%', padding: '10px', background: '#1a7a3a', color: '#fff', border: 'none', cursor: 'pointer' }}>
            ENTRAR
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p>Ainda não tem conta?</p>
          <button 
            onClick={() => navigate('/cadastro')} 
            style={{ background: 'transparent', border: '1px solid #1a7a3a', color: '#1a7a3a', padding: '10px', width: '100%', cursor: 'pointer' }}
          >
            CADASTRE-SE
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
