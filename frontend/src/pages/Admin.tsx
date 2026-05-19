import { useState } from 'react'

interface Usuario {
  id: string
  email: string
  status: 'Ativo' | 'Inativo' | 'Teste'
  dataPagamento: string
  dataVencimento: string
}

function Admin() {
  const [emailNovo, setEmailNovo] = useState('')
  const [tipoAcesso, setTipoAcesso] = useState<'mensal' | 'teste'>('mensal')
  const [carregando, setCarregando] = useState(false)
  
  // Lista simulada para vermos como vai ficar o painel visualmente
  const [usuarios, setUsuarios] = useState<Usuario[]>([
    { 
      id: '1', 
      email: 'cliente_vip@gmail.com', 
      status: 'Ativo', 
      dataPagamento: '15/05/2026', 
      dataVencimento: '15/06/2026' 
    },
    { 
      id: '2', 
      email: 'testador_sistema@hotmail.com', 
      status: 'Teste', 
      dataPagamento: '19/05/2026', 
      dataVencimento: '20/05/2026' 
    }
  ])

  async function LidarComCadastro(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)

    // Filtro contra e-mails temporários na criação pelo ADM também
    const dominiosBloqueados = ['yopmail.com', 'mailinator.com', '10minutemail.com', 'tempmail.com']
    const dominioUsuario = emailNovo.split('@')[1]?.toLowerCase()

    if (dominiosBloqueados.includes(dominioUsuario)) {
      alert('Aviso: Este e-mail parece ser temporário. Evite cadastrar para manter o banco limpo.')
      setCarregando(false)
      return
    }

    // Temporário: No próximo passo essa lógica vai salvar direto no Firebase via Backend
    alert(`Usuário ${emailNovo} criado como plano [${tipoAcesso}] com sucesso!`)
    setEmailNovo('')
    setCarregando(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f8', padding: '30px', fontFamily: "'Barlow', sans-serif" }}>
      
      {/* Cabeçalho do Painel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #d0d0d0', paddingBottom: '15px' }}>
        <h2 style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontSize: '28px', color: '#111' }}>
          BET<span style={{ color: '#1a7a3a' }}>GOL</span> — Painel Administrativo
        </h2>
        <div style={{ background: '#111', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
          MODO: MASTER ADM
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
        
        {/* Formulário de Cadastro */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', height: 'fit-content' }}>
          <h3 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Liberar Novo Acesso</h3>
          
          <form onSubmit={LidarComCadastro} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#555' }}>E-mail do Cliente</label>
              <input 
                type="email" 
                required 
                value={emailNovo}
                onChange={(e) => setEmailNovo(e.target.value)}
                placeholder="cliente@email.com"
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#555' }}>Tipo de Licença</label>
              <select 
                value={tipoAcesso} 
                onChange={(e) => setTipoAcesso(e.target.value as 'mensal' | 'teste')}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff' }}
              >
                <option value="mensal">Mensal (30 Dias de Acesso)</option>
                <option value="teste">Teste Grátis (24 Horas de Acesso)</option>
              </select>
            </div>

            <button 
              type="submit" 
              disabled={carregando}
              style={{ background: '#1a7a3a', color: '#fff', border: 'none', padding: '12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', letterSpacing: '1px' }}
            >
              {carregando ? 'GERANDO ACESSO...' : 'CRIAR E ATIVAR CONTA'}
            </button>
          </form>
        </div>

        {/* Tabela de Gerenciamento de Usuários */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Controle de Clientes</h3>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '15px' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', textAlign: 'left', borderBottom: '2px solid #eee' }}>
                <th style={{ padding: '12px' }}>Usuário</th>
                <th style={{ padding: '12px' }}>Plano</th>
                <th style={{ padding: '12px' }}>Último PG</th>
                <th style={{ padding: '12px' }}>Vencimento</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px', fontWeight: 500 }}>{user.email}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ 
                      padding: '3px 8px', 
                      borderRadius: '12px', 
                      fontSize: '12px', 
                      fontWeight: 'bold',
                      background: user.status === 'Ativo' ? '#e2f0d9' : user.status === 'Teste' ? '#fff2cc' : '#fce4e4',
                      color: user.status === 'Ativo' ? '#385723' : user.status === 'Teste' ? '#7f6000' : '#c00000'
                    }}>
                      {user.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: '#666' }}>{user.dataPagamento}</td>
                  <td style={{ padding: '12px', color: '#666', fontWeight: user.status === 'Teste' ? 'bold' : 'normal' }}>{user.dataVencimento}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button 
                      onClick={() => alert(`Alterar status de ${user.email}`)}
                      style={{ background: '#e1ecf4', border: '1px solid #7aa7c7', color: '#39739d', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}

export default Admin
