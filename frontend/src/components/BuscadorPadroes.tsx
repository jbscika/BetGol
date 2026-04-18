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

  const verde = '#1a7a3a'
  const azul = '#1565c0'
  const vermelho = '#c0392b'

  return (
    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #ddd', padding: '24px' }}>
      <h2 style={{ margin: '0 0 20px 0', color: azul, fontSize: '18px' }}>Buscador de Padroes</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#666', display: 'block', marginBottom: '4px' }}>PADROES SEGUIDOS</label>
          <select value={repeticoes} onChange={e => setRepeticoes(parseInt(e.target.value))}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
            {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n}x seguidos</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#666', display: 'block', marginBottom: '4px' }}>MERCADO</label>
          <select value={mercado} onChange={e => setMercado(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
            {MERCADOS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#666', display: 'block', marginBottom: '4px' }}>MAX PULOS</label>
          <select value={maxPulos} onChange={e => setMaxPulos(parseInt(e.target.value))}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
            {[5, 10, 15, 20, 30, 40, 50, 60].map(n => <option key={n} value={n}>{n} pulos</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#666', display: 'block', marginBottom: '4px' }}>GALE</label>
          <select value={gale} onChange={e => setGale(parseInt(e.target.value))}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
            {GALES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#666', display: 'block', marginBottom: '4px' }}>MAX HORAS</label>
          <select value={horas} onChange={e => setHoras(parseInt(e.target.value))}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
            {HORAS_OPCOES.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#666', display: 'block', marginBottom: '4px' }}>% MINIMO</label>
          <select value={minPct} onChange={e => setMinPct(parseInt(e.target.value))}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
            {[70, 75, 80, 85, 90, 95, 100].map(n => <option key={n} value={n}>{n}%</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '11px', fontWeight: 700, color: '#666', display: 'block', marginBottom: '8px' }}>LIGAS</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {ligas?.map(l => (
            <button key={l} onClick={() => toggleLiga(l)} style={{
              padding: '6px 12px', borderRadius: '20px', border: 'none',
              background: ligasSelecionadas.includes(l) ? azul : '#e0e0e0',
              color: ligasSelecionadas.includes(l) ? '#fff' : '#333',
              fontWeight: 700, fontSize: '11px', cursor: 'pointer',
            }}>
              {l.split(' ')[0].toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <button onClick={buscar} disabled={buscando} style={{
        width: '100%', padding: '12px', background: verde, color: '#fff',
        border: 'none', borderRadius: '8px', fontWeight: 800,
        fontSize: '14px', cursor: buscando ? 'not-allowed' : 'pointer',
        marginBottom: '20px', letterSpacing: '1px', opacity: buscando ? 0.7 : 1,
      }}>
        {buscando ? 'Buscando padroes...' : 'BUSCAR PADROES'}
      </button>

      {resultados.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#666', marginBottom: '10px' }}>
            {resultados.length} padroes encontrados
            {gale > 1 && <span style={{ marginLeft: '8px', color: azul }}>({gale === 2 ? '1 gale' : '2 gales'})</span>}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: azul, color: '#fff' }}>
                  {['PADRAO','MIN PADRAO','PULOS','MIN ENTRADA','LIGA','ENTRADAS','GREENS','REDS','%','RECENTE','STATUS'].map(h => (
                    <th key={h} style={{ padding: '10px', textAlign: h === 'PADRAO' ? 'left' : 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#f8f8f8' : '#fff', borderBottom: '1px solid #eee', borderLeft: r.confirmado ? '3px solid #1a7a3a' : '3px solid transparent' }}>
                    <td style={{ padding: '10px', fontWeight: 700, color: azul }}>{r.padrao}</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700 }}>{r.minuto}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{r.pulos}</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: verde }}>{r.minutoEntrada}</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontSize: '11px', color: '#666' }}>{r.liga.split(' ')[0]}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{r.entradas}</td>
                    <td style={{ padding: '10px', textAlign: 'center', color: verde, fontWeight: 700 }}>{r.greens}</td>
                    <td style={{ padding: '10px', textAlign: 'center', color: vermelho, fontWeight: 700 }}>{r.reds}</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 800, fontSize: '14px',
                      color: r.pct >= 95 ? verde : r.pct >= 90 ? '#b8960c' : vermelho }}>
                      {r.pct}%
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700, fontSize: '12px',
                      color: r.pctRecente >= 80 ? verde : r.pctRecente >= 60 ? '#b8960c' : vermelho }}>
                      {r.pctRecente}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {resultados.length === 0 && !buscando && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          Configure os filtros e clique em Buscar para encontrar padroes
        </div>
      )}
    </div>
  )
}
