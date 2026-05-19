import { useState } from 'react'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'

function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  
  const navigate = useNavigate() // 🚀 Hook para redirecionar após o login

  async function LidarComLogin(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro(null)

    // Aqui filtramos de cara se o espertinho tentar usar e-mail temporário comum no login
    const dominiosBloqueados = ['yopmail.com', 'mailinator.com', '10minutemail.com', 'tempmail.com']
    const dominioUsuario = email.split('@')[1]?.toLowerCase()

    if (dominiosBloqueados.includes(dominioUsuario)) {
      setErro('E-mails temporários não são permitidos no sistema.')
      setCarregando(false)
      return
    }

    try {
      const auth = getAuth()
      
      // 🔥 CONEXÃO REAL COM O FIREBASE:
      // Faz a autenticação usando o e-mail e a senha digitados
      await signInWithEmailAndPassword(auth, email, senha)
      
      // Se deu certo, manda o usuário direto para o painel de administração protegido!
      navigate('/admin')

    } catch (err: any) {
      console.error('Erro ao autenticar:', err)
      // Mensagem amigável caso a senha esteja errada ou usuário não exista
      setErro('Usuário ou senha incorretos, ou acesso expirado.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f4f6f8', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: "'Barlow', sans-serif",
      padding: '20px'
    }}>
      <div style={{ 
        background: '#ffffff', 
        padding: '40px', 
        borderRadius: '8px', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
        width: '100%', 
        maxWidth: '400px' 
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '32px', fontWeight: 800, letterSpacing: '3px' }}>
          <span style={{ color: '#1a7a3a' }}>BET</span>
          <span style={{ color: '#111111' }}>GOL</span>
        </div>

        <h3 style={{ margin: '0 0 20px 0', color: '#333', textAlign: 'center' }}>Acesse sua Conta</h3>

        {erro && (
          <div style={{ background: '#fce4e4', color: '#cc0000', padding: '10px', borderRadius: '4px', fontSize: '14px', marginBottom: '15px', textAlign: 'center' }}>
            {erro}
          </div>
        )}

        <form onSubmit={LidarComLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#555' }}>E-mail</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '15px' }}
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#555' }}>Senha</label>
            <input 
              type="password" 
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '15px' }}
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={carregando}
            style={{ 
              background: '#1a7a3a', 
              color: '#fff', 
              border: 'none', 
              padding: '12px', 
              borderRadius: '4px', 
              cursor: 'pointer', 
              fontWeight: 'bold',
              fontSize: '16px',
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: '1px',
              marginTop: '10px'
            }}
          >
            {carregando ? 'ENTRANDO...' : 'ENTRAR NO SISTEMA'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
