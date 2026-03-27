import { useState, useEffect, useCallback } from 'react'
import GradeResultados from '../components/GradeResultados'
import IATendencia from '../components/IATendencia'

const LIGAS: Record<string, string> = {
  'Copa do Mundo': 'copa',
  'Euro Cup': 'euro',
  'Premier League': 'premier',
  'Super Liga': 'super',
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
  }, [ligaSelecionada])

  useEffect(() => {
    const intervalo = setInterval(() => {
      buscarDadosSilencioso()
    }, 120 * 1000)
    return () => clearInterval(intervalo)
  }, [ligaSelecionada])

  async function buscarDadosSilencioso() {
    try {
      const API = (import.meta as any).env.VITE_API_URL || 'https://betgol-production.up.railway.app'
      const url = `${API}/resultados?liga=${encodeURIComponent(ligaSelecionada)}`
      const resp = await fetch(url)
      const json = await resp.json()
      if (!json.data) return
      const dados = json.data
      const linhasData = dados.linhas || dados.resultados || dados.rows || []
      const colunasData = dados.colunas || ['tempo01','tempo04','tempo07','tempo10','tempo13','tempo16','tempo19','tempo22','tempo25','tempo28','tempo31','tempo34','tempo37','tempo40','tempo43','tempo46','tempo49','tempo52','tempo55','tempo58']
      setLinhas(linhasData)
      setColunas(colunasData)
      setTotalPartidas(linhasData.length)
    } catch (e) {
      console.error('Erro na atualização silenciosa:', e)
    }
  }

  async function buscarDados() {
    try {
      setCarregando(true)
      setErro(null)
      const API = (import.meta as any).env.VITE_API_URL || 'https://betgol-production.up.railway.app'
      const url = `${API}/resultados?liga=${encodeURIComponent(ligaSelecionada)}`
      const resp = await fetch(url)
      const json = await resp.json()
      if (!json.data) throw new Error('Dados inválidos')
      const dados = json.data
      const linhasData = dados.linhas || dados.resultados || dados.rows || []
      const colunasData = dados.colunas || ['tempo01','tempo04','tempo07','tempo10','tempo13','tempo16','tempo19','tempo22','tempo25','tempo28','tempo31','tempo34','tempo37','tempo40','tempo43','tempo46','tempo49','tempo52','tempo55','tempo58']
      setLinhas(linhasData)
      setColunas(colunasData)
      setTotalPartidas(linhasData.length)
    } catch (e: any) {
      setErro('Erro ao carregar dados. Tente novamente.')
      console.error(e)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080c0e', color: '#cfd8dc', fontFamily: "'Barlow', sans-serif" }}>

      {/* HEADER */}
      <header style={{
        background: '#0d1214',
        borderBottom: '1px solid #1e2d33',
        padding: '0 24px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '32px', fontWeight: 800, letterSpacing: '3px', display: 'flex', alignItems: 'center', gap: '2px' }}>
          <span style={{ color: '#00c853' }}>BET</span>
          <div style={{
            width: '8px', height: '8px', background: '#00c853',
            borderRadius: '50%', margin: '0 4px',
            animation: 'blink 2s infinite',
          }} />
          <span style={{ color: '#fff' }}>GOL</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: '#8b1a1a', color: '#fff',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '11px', fontWeight: 700, letterSpacing: '2px',
            padding: '3px 8px', borderRadius: '2px',
          }}>
            AO VIVO
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#607d8b' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: carregando ? '#b8960c' : '#00c853',
            }} />
            {carregando ? 'Carregando...' : `${totalPartidas} partidas`}
          </div>
        </div>
      </header>

      {/* LIGA TABS */}
      <div style={{
        display: 'flex',
        background: '#0d1214',
        borderBottom: '1px solid #1e2d33',
        overflowX: 'auto',
        padding: '0 24px',
      }}>
        {Object.keys(LIGAS).map(liga => (
          <button
            key={liga}
            onClick={() => setLigaSelecionada(liga)}
            style={{
              padding: '12px 20px',
              background: 'transparent',
              border: 'none',
              borderBottom: ligaSelecionada === liga ? '3px solid #00e676' : '3px solid transparent',
              color: ligaSelecionada === liga ? '#00c853' : '#607d8b',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600,
              fontSize: '13px',
              letterSpacing: '1.5px',
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
      <div style={{ padding: '16px 24px' }}>
        {carregando ? (
          <div style={{ textAlign: 'center', padding: '80px', color: '#607d8b' }}>
            <div style={{
              width: '40px', height: '40px',
              border: '3px solid #1e2d33',
              borderTopColor: '#00c853',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            Buscando dados...
          </div>
        ) : erro ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#8b1a1a' }}>
            {erro}
            <br />
            <button
              onClick={buscarDados}
              style={{
                marginTop: '16px', padding: '8px 24px',
                background: '#8b1a1a', color: '#fff',
                border: 'none', borderRadius: '4px',
                cursor: 'pointer', fontWeight: 'bold',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '14px', letterSpacing: '1px',
              }}
            >
              TENTAR NOVAMENTE
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <IATendencia linhas={linhas} colunas={colunas} />
            <GradeResultados linhas={linhas} colunas={colunas} />
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@300;400;500&display=swap');
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0d1214; }
        ::-webkit-scrollbar-thumb { background: #1e2d33; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #2a3f47; }
      `}</style>
    </div>
  )
}

export default Dashboard
