import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function Cadastro() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ background: '#fff', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <h2 style={{ color: '#1a7a3a' }}>BETGOL</h2>
        <h3>Criar Nova Conta</h3>
        <p>A tela de cadastro está sendo conectada ao servidor...</p>
        <button 
          onClick={() => navigate('/login')}
          style={{ background: '#1a7a3a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}
        >
          Voltar para Login
        </button>
      </div>
    </div>
  )
}

export default Cadastro
