import { useState, useEffect } from 'react'
import GradeResultados from '../components/GradeResultados'
import IATendencia from '../components/IATendencia'
import JogosFuturos from '../components/JogosFuturos'
import BuscadorPadroes from '../components/BuscadorPadroes'

const LIGAS: Record<string, string> = {
  'Copa do Mundo': 'copa',
  'Euro Cup': 'euro',
  'Premier League': 'premier',
  'Super Liga Sul-Americana': 'super',
  'Express Cup': 'express',
}

export interface Partida {
  [key: string]: string | null
}

function detectarColunas(partidas: Partida[]): string[] {
  const padrao = ['tempo01','tempo04','tempo07','tempo10','tempo13','tempo16','tempo19','tempo22','tempo25','tempo28','tempo31','tempo34','tempo37','tempo40','tempo43','tempo46','tempo49','tempo52','tempo55','tempo58']
  if (!partidas || partidas.length === 0) return padrao
  const colSet = new Set<number>()
  for (const linha of partidas) {
    for (const key of Object.keys(linha)) {
      if (key.startsWith('tempo')) {
        const num = parseInt(key.replace('tempo', ''))
        if (!isNaN(num)) colSet.add(num)
      }
    }
  }
  if (colSet.size === 0) return padrao
  return Array.from(colSet).sort((a, b) => a - b).map(n => `tempo${String(n).padStart(2, '0')}`)
}

function parsearResposta(json: any): { linhas: Partida[], colunas: string[], horas: string[] } {
  if (json?.data?.linhas) {
    return {
      linhas: json.data.linhas || [],
      colunas: json.data.colunas || detectarColunas(json.data.linhas),
      horas: json.data.horas || [],
    }
  }
  if (json?.linhas) {
    return {
      linhas: json.linhas || [],
      colunas: json.colunas || detectarColunas(json.linhas),
      horas: json.horas || [],
    }
  }
  if (Array.isArray(json)) {
    return { linhas: json, colunas: detectarColunas(json), horas: [] }
  }
  return { linhas: [], colunas: [], horas: [] }
}

function Dashboard() {
  const [ligaSelecionada, setLigaSelecionada] = useState('Copa do Mundo')
  const [linhas, setLinhas] = useState<Partida[]>([])
  const [colunas, setColunas] = useState<string[]>([])
  const [horas, setHoras] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [totalPartidas, setTotalPartidas] = useState(0)
  const [dadosTodasLigas, setDadosTodasLigas] = useState<Record<string, Partida[]>>({})

  useEffect(() => {
    buscarDados()
  }, [ligaSelecionada])

  useEffect(() => {
    buscarTodasLigas()
    const intervalo = setInterval(() => {
      buscarDadosSilencioso()
      buscarTodasLigas()
    }, 30 * 1000)
    return () => clearInterval(intervalo)
  }, [ligaSelecionada])

  async function buscarTodasLigas() {
    try {
      // 🔥 Ajustado para bater direto na sua Hostinger com segurança máxima HTTPS
      const API = 'https://betgol.tech'
      const resultados: Record<string, Partida[]> = {}
      await Promise.all(Object.keys(LIGAS).map(async (liga) => {
        if (liga === ligaSelecionada) return
        try {
          const resp = await fetch(`${API}/resultados?liga=${encodeURIComponent(liga)}`)
          const json = await resp.json()
          const { linhas: l } = parsearResposta(json)
          if (l.length > 0) resultados[liga] = l
        } catch {}
      }))
      setDadosTodasLigas(resultados)
    } catch {}
  }

  async function buscarDadosSilencioso() {
    try {
      // 🔥 Ajustado para bater direto na sua Hostinger com segurança máxima HTTPS
      const API = 'https://betgol.tech'
      const resp = await fetch(`${API}/resultados?liga=${encodeURIComponent(ligaSelecionada)}`)
      const json = await resp.json()
      const { linhas: l, colunas: c, horas: h } = parsearResposta(json)
      if (l.length === 0) return
      setLinhas(l)
      setColunas(c)
      setHoras(h)
      setTotalPartidas(l.length)
    } catch (e) {
      console.error('Erro na atualizacao silenciosa:', e)
    }
  }

  async function buscarDados() {
    try {
      setCarregando(true)
      setErro(null)
      // 🔥 Ajustado para bater direto na sua Hostinger com segurança máxima HTTPS
      const API = 'https://betgol.tech'
      const resp = await fetch(`${API}/resultados?liga=${encodeURIComponent(ligaSelecionada)}`)
      const json = await resp.json()
      const { linhas: l, colunas: c, horas: h } = parsearResposta(json)
      if (l.length === 0) throw new Error('Sem dados')
      setLinhas(l)
      setColunas(c)
      setHoras(h)
      setTotalPartidas(l.length)
    } catch (e: any) {
      setErro('Erro ao carregar dados. Tente novamente.')
      console.error(e)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', color: '#111111', fontFamily: "'Barlow', sans-serif" }}>

      <header style={{
        background: '#ffffff', borderBottom: '1px solid #d0d0d0',
        padding: '0 24px', height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '32px', fontWeight: 800, letterSpacing: '3px', display: 'flex', alignItems: 'center', gap: '2px' }}>
          <span style={{ color: '#1a7a3a' }}>BET</span>
          <div style={{ width: '8px', height: '8px', background: '#1a7a3a', borderRadius: '50%', margin: '0 4px' }} />
          <span style={{ color: '#111111' }}>GOL</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: '#c0392b', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px', fontWeight: 700, letterSpacing: '2px', padding: '3px 8px', borderRadius: '2px' }}>
            AO VIVO
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#444444' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: carregando ? '#b8600c' : '#1a7a3a' }} />
            {carregando ? 'Carregando...' : `${totalPartidas} partidas`}
          </div>
        </div>
      </header>

      <div style={{ padding: '16px 24px' }}>
        {carregando ? (
          <div style={{ textAlign: 'center', padding: '80px', color: '#444444' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid #d0d0d0', borderTopColor: '#1a7a3a', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            Buscando dados...
          </div>
        ) : erro ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#8b1a1a' }}>
            {erro}
            <br />
            <button onClick={buscarDados} style={{ marginTop: '16px', padding: '8px 24px', background: '#8b1a1a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', letterSpacing: '1px' }}>
              TENTAR NOVAMENTE
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <BuscadorPadroes
              linhas={linhas}
              colunas={colunas}
              liga={ligaSelecionada}
              ligas={Object.keys(LIGAS)}
              dadosTodasLigas={dadosTodasLigas}
            />
            <IATendencia linhas={linhas} colunas={colunas} />
            <JogosFuturos linhas={linhas} colunas={colunas} horas={horas} />
            <GradeResultados
              linhas={linhas}
              colunas={colunas}
              horas={horas}
              liga={ligaSelecionada}
              ligas={Object.keys(LIGAS)}
              onTrocarLiga={setLigaSelecionada}
              dadosTodasLigas={dadosTodasLigas}
            />
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
