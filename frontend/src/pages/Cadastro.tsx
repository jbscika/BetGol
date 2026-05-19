import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function Cadastro() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const navigate = useNavigate()

  const handleCadastro = (e: React.FormEvent) => {
    e.preventDefault()
    // AQUI: é onde o cadastro seria enviado para o seu backend
    alert('Cadastro realizado com sucesso!')
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f8', padding: '20px' }}>
      <div style={{ background: '#fff', padding: '40px', borderRadius: '8px', width: '100%', maxWidth: '350px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign: 'center', color: '#1a7a3a' }}>BETGOL - CADASTRO</h2>
        <form onSubmit={handleCadastro}>
          <input type="text" placeholder="Nome Completo" onChange={e => setNome(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px' }} required />
          <input type="email" placeholder="E-mail" onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px' }} required />
          <input type="password" placeholder="Senha" onChange={e => setSenha(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '20px' }} required />
          <button type="submit" style={{ width: '100%', padding: '10px', background: '#1a7a3a', color: '#fff', border: 'none', cursor: 'pointer' }}>
            CADASTRAR AGORA
          </button>
        </form>
        <button onClick={() => navigate('/login')} style={{ width: '100%', padding: '10px', marginTop: '10px', background: 'transparent', border: '1px solid #ccc', cursor: 'pointer' }}>
          Voltar para Login
        </button>
      </div>
    </div>
  )
}

export default Cadastro
