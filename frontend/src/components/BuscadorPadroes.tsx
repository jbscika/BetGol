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
  pulos: number
  entradas: number
  greens: number
  reds: number
  pct: number
  liga: string
}

const MERCADOS = [
  'Over 0.5', 'Over 1.5', 'Over 2.5', 'Over 3.5',
  'Under 1.5', 'Under 2.5', 'Under 3.5',
  'Ambas Marcam Sim', 'Ambas Marcam Não',
  'Vitória Casa', 'Empate', 'Vitória Fora',
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
    case 'Ambas Marcam Não': return !(p.casa > 0 && p.fora > 0)
    case 'Vitória Casa': return p.casa > p.fora
    case 'Empate': return p.casa === p.fora
    case 'Vitória Fora': return p.fora > p.casa
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

// =========================================================================
// FUNÇÃO: Converte a grade (linhas x colunas) em uma sequência linear de jogos
// Cada jogo é uma "casa" — a sequência é: linha0/col0, linha0/col1...linha0/colN,
// linha1/col0, linha1/col1... etc
// Como as linhas estão ordenadas do mais recente para o mais antigo,
// invertemos para ter ordem cronológica
// =========================================================================
function construirSequencia(linhas: Partida[], colunas: string[], maxHoras: number): { placar: { casa: number; fora: number }; str: string; hora: string; minuto: string }[] {
  const seq: { placar: { casa: number; fora: number }; str: string; hora: string; minuto: string }[] = []

  // Inverte para ordem cronológica (mais antigo primeiro)
  const linhasOrdenadas = [...linhas].slice(0, maxHoras).reverse()

  for (const linha of linhasOrdenadas) {
    for (const col of colunas) {
      const p = extrairPlacar(linha[col] as string)
      if (!p) continue
      seq.push({
        placar: p,
        str: `${p.casa}-${p.fora}`,
        hora: (linha.hora as string) || '',
        minuto: col.replace('tempo', ''),
      })
    }
  }

  return seq
}

// =========================================================================
// ALGORITMO CORRETO:
// 1. Constrói uma sequência linear de todos os jogos em ordem cronológica
// 2. Para cada placar que se repete N vezes seguidas,
//    verifica o que acontece X casas depois (pulos)
// =========================================================================
function buscarPadroes(
  linhas: Partida[],
  colunas: string[],
  mercado: string,
  repeticoes: number,
  maxPulos: number,
  maxHoras: number,
  liga: string,
  minPct: number
): Resultado[] {
  const sequencia = construirSequencia(linhas, colunas, maxHoras)
  if (sequencia.length < repeticoes + maxPulos + 1) return []

  // Agrupa resultados por (placar, pulos)
  const contagem: Record<string, { entradas: number; greens: number; reds: number }> = {}

  for (let i = repeticoes - 1; i < sequencia.length - maxPulos; i++) {
    // Verifica se as N casas anteriores têm o mesmo placar
    const placarBase = sequencia[i].str
    let padraoValido = true

    for (let r = 1; r < repeticoes; r++) {
      if (sequencia[i - r].str !== placarBase) {
        padraoValido = false
        break
      }
    }

    if (!padraoValido) continue

    // Testa cada pulo de 1 a maxPulos
    for (let pulo = 1; pulo <= maxPulos; pulo++) {
      const idxAlvo = i + pulo
      if (idxAlvo >= sequencia.length) break

      const alvo = sequencia[idxAlvo]
      const chave = `${placarBase}__${pulo}`

      if (!contagem[chave]) contagem[chave] = { entradas: 0, greens: 0, reds: 0 }
      contagem[chave].entradas++

      if (verificarMercado(alvo.placar, mercado)) contagem[chave].greens++
      else contagem[chave].reds++
    }
  }

  // Filtra e formata resultados
  const resultados: Resultado[] = []

  for (const [chave, dados] of Object.entries(contagem)) {
    if (dados.entradas < 5) continue
    const pct = (dados.greens / dados.entradas) * 100
    if (pct < minPct) continue

    const [padrao, pulosStr] = chave.split('__')
    resultados.push({
      padrao,
      pulos: parseInt(pulosStr),
      entradas: dados.entradas,
      greens: dados.greens,
      reds: dados.reds,
      pct: Math.round(pct),
      liga,
    })
  }

  return resultados.sort((a, b) => b.pct - a.pct || b.entradas - a.entradas)
}

export default function BuscadorPadroes({ linhas, colunas, liga, ligas, dadosTodasLigas }: Props) {
  const [aberto, setAberto] = useState(false)
  const [mercado, setMercado] = useState('Over 2.5')
  const [repeticoes, setRepeticoes] = useState(3)
  const [maxPulos, setMaxPulos] = useState(10)
  const [maxHoras, setMaxHoras] = useState(24)
  const [minPct, setMinPct] = useState(80)
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

      if (liga && ligasSelecionadas.includes(liga) && linhas.length > 0) {
        const r = buscarPadroes(linhas, colunas, mercado, repeticoes, maxPulos, maxHoras, liga, minPct)
        todos.push(...r)
      }

      if (dadosTodasLigas) {
        for (const [nomeLiga, dadosLiga] of Object.entries(dadosTodasLigas)) {
          if (!ligasSelecionadas.includes(nomeLiga)) continue
          if (!dadosLiga || dadosLiga.length === 0) continue
          const colsLiga = detectarColunasLiga(dadosLiga)
          const r = buscarPadroes(dadosLiga, colsLiga, mercado, repeticoes, maxPulos, maxHoras, nomeLiga, minPct)
          todos.push(...r)
        }
      }

      todos.sort((a, b) => b.pct - a.pct || b.entradas - a.entradas)
      setResultados(todos.slice(0, 50))
      setBuscando(false)
    }, 100)
  }

  const verde = '#1a7a3a'
  const azul = '#1565c0'
  const vermelho = '#c0392b'

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        style={{
          background: azul, color: '#fff', border: 'none',
          borderRadius: '6px', padding: '8px 16px',
          fontWeight: 700, fontSize: '12px', cursor: 'pointer',
          letterSpacing: '1px', alignSelf: 'flex-start',
        }}
      >
        🔍 BUSCADOR DE PADRÕES
      </button>

      {aberto && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}>
          <div style={{
            background: '#fff', borderRadius: '12px',
            width: '100%', maxWidth: '950px', maxHeight: '90vh',
            overflow: 'auto', padding: '24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: azul, fontSize: '18px' }}>🔍 Buscador de Padrões</h2>
              <button onClick={() => setAberto(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}>✕</button>
            </div>

            {/* FILTROS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#666', display: 'block', marginBottom: '4px' }}>ENTRADA</label>
                <select value={mercado} onChange={e => setMercado(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px' }}>
                  {MERCADOS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#666', display: 'block', marginBottom: '4px' }}>PADRÕES SEGUIDOS</label>
                <select value={repeticoes} onChange={e => setRepeticoes(parseInt(e.target.value))}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px' }}>
                  {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}x seguidos</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#666', display: 'block', marginBottom: '4px' }}>MAX PULOS</label>
                <select value={maxPulos} onChange={e => setMaxPulos(parseInt(e.target.value))}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px' }}>
                  {[5, 10, 15, 20, 30, 40, 50, 60].map(n => <option key={n} value={n}>{n} pulos</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#666', display: 'block', marginBottom: '4px' }}>MAX HORAS</label>
                <select value={maxHoras} onChange={e => setMaxHoras(parseInt(e.target.value))}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px' }}>
                  {[6, 12, 24, 36, 48, 60].map(n => <option key={n} value={n}>{n}h</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#666', display: 'block', marginBottom: '4px' }}>% MÍNIMO</label>
                <select value={minPct} onChange={e => setMinPct(parseInt(e.target.value))}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px' }}>
                  {[70, 75, 80, 85, 90, 95, 100].map(n => <option key={n} value={n}>{n}%</option>)}
                </select>
              </div>
            </div>

            {/* LIGAS */}
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

            {/* BOTÃO BUSCAR */}
            <button onClick={buscar} disabled={buscando} style={{
              width: '100%', padding: '12px', background: verde, color: '#fff',
              border: 'none', borderRadius: '8px', fontWeight: 800,
              fontSize: '14px', cursor: buscando ? 'not-allowed' : 'pointer',
              marginBottom: '20px', letterSpacing: '1px',
              opacity: buscando ? 0.7 : 1,
            }}>
              {buscando ? '⏳ Buscando padrões...' : '🔍 BUSCAR PADRÕES'}
            </button>

            {/* RESULTADOS */}
            {resultados.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#666', marginBottom: '10px' }}>
                  {resultados.length} padrões encontrados — ordenados por % de acerto
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: azul, color: '#fff' }}>
                        <th style={{ padding: '10px', textAlign: 'left' }}>PADRÃO</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>PULOS</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>LIGA</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>ENTRADAS</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>GREENS</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>REDS</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultados.map((r, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#f8f8f8' : '#fff', borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px', fontWeight: 700, color: azul }}>{r.padrao}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{r.pulos}</td>
                          <td style={{ padding: '10px', textAlign: 'center', fontSize: '11px', color: '#666' }}>{r.liga.split(' ')[0]}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{r.entradas}</td>
                          <td style={{ padding: '10px', textAlign: 'center', color: verde, fontWeight: 700 }}>{r.greens}</td>
                          <td style={{ padding: '10px', textAlign: 'center', color: vermelho, fontWeight: 700 }}>{r.reds}</td>
                          <td style={{ padding: '10px', textAlign: 'center', fontWeight: 800, fontSize: '14px',
                            color: r.pct >= 95 ? verde : r.pct >= 85 ? '#b8960c' : vermelho,
                          }}>
                            {r.pct}%
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
                Configure os filtros e clique em Buscar para encontrar padrões
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
