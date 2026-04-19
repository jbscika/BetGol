import { useState } from 'react'
import { Partida } from '../pages/Dashboard'

interface Props {
  linhas: Partida[]
  colunas: string[]
  liga?: string
  ligas?: string[]
  dadosTodasLigas?: Record<string, Partida[]>
}

interface Resultado {
  padrao: string
  minuto: string
  pulos: number
  minutoEntrada: string
  entradas: number
  greens: number
  reds: number
  pct: number
  pctRecente: number
  confirmado: boolean
  liga: string
}

const MERCADOS = [
  'Over 0.5', 'Over 1.5', 'Over 2.5', 'Over 3.5',
  'Under 1.5', 'Under 2.5', 'Under 3.5',
  'Ambas Marcam Sim', 'Ambas Marcam Nao',
  'Vitoria Casa', 'Empate', 'Vitoria Fora',
]

const GALES = [
  { label: 'G1 (sem gale)', value: 1 },
  { label: 'G2 (1 gale)', value: 2 },
  { label: 'G3 (2 gales)', value: 3 },
]

const HORAS_OPCOES = [
  { label: 'Ultimas 24h', value: 24 },
  { label: 'Ultimas 36h', value: 36 },
  { label: 'Ultimas 48h', value: 48 },
]

function extrairPlacar(val: string | null): { casa: number; fora: number } | null {
  if (!val) return null
  const linha = typeof val === 'string' ? val.split('</br>')[0].split('<br>')[0].trim() : String(val)
  const m = linha.match(/(\d+)\s*-\s*(\d+)/)
  if (!m) return null
  return { casa: parseInt(m[1]), fora: parseInt(m[2]) }
}

function verificarMercado(p: { casa: number; fora: number }, mercado: string): boolean {
  const gols = p.casa + p.fora
  switch (mercado) {
    case 'Over 0.5': return gols > 0.5
    case 'Over 1.5': return gols > 1.5
    case 'Over 2.5': return gols > 2.5
    case 'Over 3.5': return gols > 3.5
    case 'Under 1.5': return gols < 1.5
    case 'Under 2.5': return gols < 2.5
    case 'Under 3.5': return gols < 3.5
    case 'Ambas Marcam Sim': return p.casa > 0 && p.fora > 0
    case 'Ambas Marcam Nao': return !(p.casa > 0 && p.fora > 0)
    case 'Vitoria Casa': return p.casa > p.fora
    case 'Empate': return p.casa === p.fora
    case 'Vitoria Fora': return p.fora > p.casa
    default: return false
  }
}

function detectarColunasLiga(dadosLiga: Partida[]): string[] {
  const colSet = new Set<number>()
  for (const linha of dadosLiga) {
    for (const key of Object.keys(linha)) {
      if (key.startsWith('tempo')) {
        const num = parseInt(key.replace('tempo', ''))
        if (!isNaN(num)) colSet.add(num)
      }
    }
  }
  return Array.from(colSet).sort((a, b) => a - b).map(n => `tempo${String(n).padStart(2, '0')}`)
}

function buscarPadroes(
  linhas: Partida[],
  colunas: string[],
  mercado: string,
  repeticoes: number,
  maxPulos: number,
  liga: string,
  minPct: number,
  gale: number
): Resultado[] {
  const resultados: Resultado[] = []

  for (let colIdx = 0; colIdx < colunas.length; colIdx++) {
    const col = colunas[colIdx]

    for (let pulos = 1; pulos <= maxPulos; pulos++) {
      const colAlvoIdx = colIdx + pulos
      if (colAlvoIdx >= colunas.length) continue
      const colAlvo = colunas[colAlvoIdx]

      const ocorrencias: { acertou: boolean }[] = []
      let ultimoPadrao = ''

      for (let linhaIdx = 0; linhaIdx <= linhas.length - repeticoes - 1; linhaIdx++) {
        let padraoValido = true
        let primeiroPlacar = ''

        for (let r = 0; r < repeticoes; r++) {
          const p = extrairPlacar(linhas[linhaIdx + r][col] as string)
          if (!p) { padraoValido = false; break }
          const placarStr = p.casa + '-' + p.fora
          if (r === 0) primeiroPlacar = placarStr
          if (placarStr !== primeiroPlacar) { padraoValido = false; break }
        }

        if (!padraoValido || !primeiroPlacar) continue

        // Verificar com gale
        let acertou = false
        for (let g = 0; g < gale; g++) {
          const linhaAlvoIdx = linhaIdx + repeticoes + g
          if (linhaAlvoIdx >= linhas.length) break
          const pAlvo = extrairPlacar(linhas[linhaAlvoIdx][colAlvo] as string)
          if (!pAlvo) continue
          if (verificarMercado(pAlvo, mercado)) { acertou = true; break }
        }

        const linhaAlvoBase = linhaIdx + repeticoes
        if (linhaAlvoBase >= linhas.length) continue
        if (!extrairPlacar(linhas[linhaAlvoBase][colAlvo] as string)) continue

        ultimoPadrao = primeiroPlacar
        ocorrencias.push({ acertou })
      }

      const entradas = ocorrencias.length
      if (entradas < 5) continue

      const greens = ocorrencias.filter(o => o.acertou).length
      const reds = entradas - greens
      const pct = Math.round(greens / entradas * 100)
      if (pct < minPct) continue

      // % recente: ultimas 5 ocorrencias
      const recentes = ocorrencias.slice(0, Math.min(5, entradas))
      const pctRecente = Math.round(recentes.filter(o => o.acertou).length / recentes.length * 100)

      // Confirmacao: ultimas 3 ocorrencias - padrao ainda ativo?
      const ultimas3 = ocorrencias.slice(0, Math.min(3, entradas))
      const confirmado = ultimas3.filter(o => o.acertou).length >= Math.ceil(ultimas3.length * 0.67)

      resultados.push({
        padrao: ultimoPadrao,
        minuto: col.replace('tempo', ''),
        pulos,
        minutoEntrada: colAlvo.replace('tempo', ''),
        entradas, greens, reds, pct, pctRecente, confirmado, liga,
      })
    }
  }

  return resultados.sort((a, b) => {
    const sA = a.pct * 0.6 + a.pctRecente * 0.4
    const sB = b.pct * 0.6 + b.pctRecente * 0.4
    return sB - sA || b.entradas - a.entradas
  })
}

export default function BuscadorPadroes({ linhas, colunas, liga, ligas, dadosTodasLigas }: Props) {
  const [mercado, setMercado] = useState('Over 2.5')
  const [repeticoes, setRepeticoes] = useState(2)
  const [maxPulos, setMaxPulos] = useState(10)
  const [minPct, setMinPct] = useState(70)
  const [gale, setGale] = useState(1)
  const [horas, setHoras] = useState(48)
  const [ligasSelecionadas, setLigasSelecionadas] = useState<string[]>(ligas || [])
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<Resultado[]>([])

  function toggleLiga(l: string) {
    setLigasSelecionadas(prev =>
      prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]
    )
  }

  function buscar() {
    setBuscando(true)
    setResultados([])
    setTimeout(() => {
      const todos: Resultado[] = []
      const linhasLimitadas = linhas.filter(l => colunas.some(c => l[c])).slice(0, horas)

      if (liga && ligasSelecionadas.includes(liga) && linhasLimitadas.length > 0) {
        todos.push(...buscarPadroes(linhasLimitadas, colunas, mercado, repeticoes, maxPulos, liga, minPct, gale))
      }

      if (dadosTodasLigas) {
        for (const [nomeLiga, dadosLiga] of Object.entries(dadosTodasLigas)) {
          if (!ligasSelecionadas.includes(nomeLiga)) continue
          if (!dadosLiga || dadosLiga.length === 0) continue
          const colsLiga = detectarColunasLiga(dadosLiga)
          const dadosLimitados = dadosLiga.filter(l => colsLiga.some(c => l[c])).slice(0, horas)
          todos.push(...buscarPadroes(dadosLimitados, colsLiga, mercado, repeticoes, maxPulos, nomeLiga, minPct, gale))
        }
      }

      todos.sort((a, b) => {
        // Confirmados primeiro, depois por score
        if (a.confirmado !== b.confirmado) return a.confirmado ? -1 : 1
        const sA = a.pct * 0.6 + a.pctRecente * 0.4
        const sB = b.pct * 0.6 + b.pctRecente * 0.4
        return sB - sA || b.entradas - a.entradas
      })
      setResultados(todos.slice(0, 50))
      setBuscando(false)
    }, 100)
  }

  const C = {
    bg: '#0a0e1a', surface: '#0f1629', surface2: '#141d35',
    border: '#1e2d4a', accent: '#00d4ff', green: '#00e676',
    red: '#ff3d5a', yellow: '#ffd600', text: '#ffffff',
    textDim: '#8aa0c0', purple: '#ce93d8',
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden', fontFamily: "'JetBrains Mono', monospace" }}>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');`}</style>

      {/* HEADER */}
      <div style={{ background: `linear-gradient(135deg, #0f1629 0%, #1a2540 100%)`, padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: C.accent, boxShadow: `0 0 8px ${C.accent}` }} />
        <span style={{ fontSize: '13px', fontWeight: 800, color: C.text, letterSpacing: '2px' }}>BUSCADOR DE PADROES</span>
        {resultados.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '10px', background: C.accent + '22', color: C.accent, border: `1px solid ${C.accent}44`, borderRadius: '4px', padding: '2px 8px', fontWeight: 700 }}>
            {resultados.length} padroes
          </span>
        )}
      </div>

      <div style={{ padding: '16px 20px' }}>

        {/* FILTROS GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '14px' }}>
          {[
            { label: 'PADROES', value: repeticoes, onChange: (v: string) => setRepeticoes(parseInt(v)), opts: [2,3,4,5].map(n => ({ v: n, l: n + 'x seguidos' })) },
            { label: 'MERCADO', value: mercado, onChange: (v: string) => setMercado(v), opts: MERCADOS.map(m => ({ v: m, l: m })) },
            { label: 'MAX PULOS', value: maxPulos, onChange: (v: string) => setMaxPulos(parseInt(v)), opts: [5,10,15,20,30,40,50,60].map(n => ({ v: n, l: n + ' pulos' })) },
            { label: 'GALE', value: gale, onChange: (v: string) => setGale(parseInt(v)), opts: GALES.map(g => ({ v: g.value, l: g.label })) },
            { label: 'MAX HORAS', value: horas, onChange: (v: string) => setHoras(parseInt(v)), opts: HORAS_OPCOES.map(h => ({ v: h.value, l: h.label })) },
            { label: '% MINIMO', value: minPct, onChange: (v: string) => setMinPct(parseInt(v)), opts: [70,75,80,85,90,95,100].map(n => ({ v: n, l: n + '%' })) },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: '8px', color: C.accent, fontWeight: 700, letterSpacing: '1.5px', marginBottom: '5px' }}>{f.label}</div>
              <select value={f.value} onChange={e => f.onChange(e.target.value)} style={{
                width: '100%', padding: '8px 10px',
                background: C.surface2, border: `1px solid ${C.border}`,
                borderRadius: '6px', color: C.text,
                fontSize: '11px', fontFamily: 'inherit', outline: 'none',
                cursor: 'pointer',
              }}>
                {f.opts.map((o: any) => <option key={o.v} value={o.v} style={{ background: C.surface2 }}>{o.l}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* LIGAS */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '8px', color: C.accent, fontWeight: 700, letterSpacing: '1.5px', marginBottom: '8px' }}>LIGAS</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {ligas?.map(l => (
              <button key={l} onClick={() => toggleLiga(l)} style={{
                padding: '5px 12px', borderRadius: '20px',
                border: `1px solid ${ligasSelecionadas.includes(l) ? C.accent : C.border}`,
                background: ligasSelecionadas.includes(l) ? C.accent + '22' : 'transparent',
                color: ligasSelecionadas.includes(l) ? C.accent : C.textDim,
                fontWeight: 700, fontSize: '10px', cursor: 'pointer',
                fontFamily: 'inherit', letterSpacing: '1px',
                transition: 'all 0.15s',
              }}>
                {l.split(' ')[0].toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* BOTAO BUSCAR */}
        <button onClick={buscar} disabled={buscando} style={{
          width: '100%', padding: '12px',
          background: buscando ? C.surface2 : `linear-gradient(135deg, #00c853, #00e676)`,
          color: buscando ? C.textDim : '#0a0e1a',
          border: `1px solid ${buscando ? C.border : C.green}`,
          borderRadius: '8px', fontWeight: 800, fontSize: '12px',
          cursor: buscando ? 'not-allowed' : 'pointer',
          letterSpacing: '2px', fontFamily: 'inherit',
          opacity: buscando ? 0.7 : 1, transition: 'all 0.2s',
        }}>
          {buscando ? 'ANALISANDO...' : 'BUSCAR PADROES'}
        </button>

        {/* RESULTADOS */}
        {resultados.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '9px', color: C.textDim, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{resultados.length} padroes encontrados</span>
              {gale > 1 && <span style={{ color: C.yellow }}>{gale === 2 ? '1 gale' : '2 gales'}</span>}
              <span style={{ marginLeft: 'auto', color: C.green }}>verde borda = ATIVO</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: C.surface2 }}>
                    {['PADRAO','MIN','PULOS','ENTRADA','LIGA','ENT','GREEN','RED','%','REC','STATUS'].map(h => (
                      <th key={h} style={{ padding: '8px 6px', textAlign: 'center', color: C.accent, fontSize: '8px', letterSpacing: '1px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((r, i) => (
                    <tr key={i} style={{
                      background: i % 2 === 0 ? C.surface2 : C.bg,
                      borderBottom: `1px solid ${C.border}`,
                      borderLeft: r.confirmado ? `3px solid ${C.green}` : `3px solid transparent`,
                    }}>
                      <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, color: C.accent }}>{r.padrao}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700, color: C.text }}>{r.minuto}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', color: C.textDim }}>{r.pulos}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, color: C.green }}>{r.minutoEntrada}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '9px', color: C.purple }}>{r.liga.split(' ')[0]}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', color: C.textDim }}>{r.entradas}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', color: C.green, fontWeight: 700 }}>{r.greens}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', color: C.red, fontWeight: 700 }}>{r.reds}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, fontSize: '13px',
                        color: r.pct >= 95 ? C.green : r.pct >= 85 ? C.yellow : C.red }}>
                        {r.pct}%
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700,
                        color: r.pctRecente >= 80 ? C.green : r.pctRecente >= 60 ? C.yellow : C.red }}>
                        {r.pctRecente}%
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        {r.confirmado
                          ? <span style={{ background: C.green + '22', color: C.green, border: `1px solid ${C.green}44`, borderRadius: '4px', padding: '2px 6px', fontSize: '8px', fontWeight: 700 }}>ATIVO</span>
                          : <span style={{ background: C.red + '22', color: C.red, border: `1px solid ${C.red}44`, borderRadius: '4px', padding: '2px 6px', fontSize: '8px', fontWeight: 700 }}>FRIO</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {resultados.length === 0 && !buscando && (
          <div style={{ textAlign: 'center', padding: '30px', color: C.textDim, fontSize: '11px', marginTop: '8px' }}>
            Configure os filtros e clique em Buscar
          </div>
        )}
      </div>
    </div>
  )
        }
