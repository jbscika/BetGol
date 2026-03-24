import { useState, useEffect } from 'react'
import GradeResultados from '../components/GradeResultados'

const LIGAS: Record<string, string> = {
  'Copa do Mundo': 'copa',
  'Euro Cup': 'euro',
  'Premier League': 'premier',
  'Super Liga': 'superliga',
  'Express Cup': 'expresscup',
}

export interface Partida {
  [key: string]: string | null
}

function Dashboard() {
  const [ligaSelecionada, setLigaSelecionada] = useState('Copa do Mundo')
  const [linhas, setLinhas] = useState<Partida[]>([])
  const [colunas, setColunas] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [totalPartidas, setTotalPartidas] = useState(0)

  useEffect(() => {
    buscarDados()
    const intervalo = setInterval(buscarDados, 60 * 1000)
    return () => clearInterval(intervalo)
  }, [ligaSelecionada])

  async function buscarDados() {
    try {
      setCarregando(true)
      setErro(null)
      const API = (import.meta as any).env.VITE_API_URL || 'https://betgol-production.up.railway.app'
      const url = `${API}/resultados?liga=${encodeURIComponent(ligaSelecionada)}`
      const resp = await fetch(url)
      const json = await resp.json()
      if (!json.data?.resultsNames) throw new Error('Dados inválidos')
      const dados = json.data.resultsNames
      setLinhas(dados.linhas || [])
      setColunas(dados.colunas || [])
      setTotalPartidas((dados.linhas || []).length)
    } catch (e: any) {
      setErro('Erro ao carregar dados. Tente novamente.')
      console.error(e)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e0e0f0', fontFamily: 'sans-serif' }}>
      {/* HEADER */}
      <header style={{
        background: '#12121a',
        borderBottom: '2px solid #00ff88',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ fontSize: '26px', fontWeight: 'bold', letterSpacing: '2px' }}>
          <span style={{ color: '#00ff88' }}>BET</span>
          <span style={{ color: '#e0e0f0' }}>GOL</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#8888aa' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: carregando ? '#f5c518' : '#00ff88',
            animation: 'pulse 1.5s infinite',
          }} />
          {carregando ? 'Carregando...' : `${totalPartidas} partidas`}
        </div>
      </header>

      {/* LIGA TABS */}
      <div style={{
        display: 'flex',
        gap: 0,
        background: '#12121a',
        borderBottom: '1px solid #2a2a3a',
        overflowX: 'auto',
        padding: '0 20px',
      }}>
        {Object.keys(LIGAS).map(liga => (
          <button
            key={liga}
            onClick={() => setLigaSelecionada(liga)}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: 'none',
              borderBottom: ligaSelecionada === liga ? '3px solid #00ff88' : '3px solid transparent',
              color: ligaSelecionada === liga ? '#00ff88' : '#8888aa',
              fontWeight: 'bold',
              fontSize: '13px',
              letterSpacing: '1px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            {liga.toUpperCase()}
          </button>
        ))}
      </div>

      {/* CONTEÚDO */}
      <div style={{ padding: '16px 20px' }}>
        {carregando ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#8888aa' }}>
            <div style={{
              width: '40px', height: '40px',
              border: '3px solid #2a2a3a',
              borderTopColor: '#00ff88',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            Buscando dados...
          </div>
        ) : erro ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#e8334a' }}>
            {erro}
            <br />
            <button
              onClick={buscarDados}
              style={{
                marginTop: '12px',
                padding: '8px 20px',
                background: '#e8334a',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              TENTAR NOVAMENTE
            </button>
          </div>
        ) : (
          <GradeResultados linhas={linhas} colunas={colunas} />
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}

export default Dashboard
