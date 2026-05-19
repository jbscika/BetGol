import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const navigate = useNavigate()

  function entrar(e: React.FormEvent) {
    e.preventDefault()
    // Login do Admin
    if (email === 'jbscika@gmail.com' && senha === 'He18@894') {
      localStorage.setItem('betgol_admin_logado', 'true')
      navigate('/admin')
    } else {
      // Login do Cliente comum
      alert('Login efetuado!')
      navigate('/')
    }
  }

  return (
    <div style={{ padding: '50px', maxWidth: '300px', margin: 'auto' }}>
      <h2>BETGOL LOGIN</h2>
      <form onSubmit={entrar}>
        <input type="email" placeholder="E-mail" onChange={e => setEmail(e.target.value)} style={{ width: '100%', marginBottom: '10px' }} required />
        <input type="password" placeholder="Senha" onChange={e => setSenha(e.target.value)} style={{ width: '100%', marginBottom: '10px' }} required />
        <button type="submit" style={{ width: '100%' }}>ENTRAR</button>
      </form>
      <button type="button" onClick={() => navigate('/cadastro')} style={{ width: '100%', marginTop: '10px' }}>CADASTRE-SE</button>
    </div>
  )
}
export default Login
