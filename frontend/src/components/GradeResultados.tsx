import { useState, useEffect, useMemo } from 'react'
import { Partida } from '../pages/Dashboard'

interface Props {
  linhas: Partida[]
  colunas: string[]
}

interface PlacarInfo {
  casa: number
  fora: number
  texto: string
  gols: number
  over05: boolean
  over15: boolean
  over25: boolean
  over35: boolean
  ambasSim: boolean
  casaVence: boolean
  empate: boolean
  foraVence: boolean
}

interface ColStats {
  col: string
  total: number
  greens: number
  pctGreen: number
  mediaGols: number
}

interface LinhaStats {
  idx: number
  total: number
  greens: number
  pctGreen: number
  totalGols: number
}

interface Tendencia {
  minuto: string
  probabilidade: number
  sequencia: number
  direcao: 'GREEN' | 'RED'
  motivo: string
  confianca: number
}

function extrairPlacarRaw(val: string | null): PlacarInfo | null {
  if (!val) return null
  const linha = val.split('</br>')[0].split('<br>')[0].trim()
  const m = linha.match(/(\d+)\s*-\s*(\d+)/)
  if (!m) return null
  const casa = parseInt(m[1])
  const fora = parseInt(m[2])
  const gols = casa + fora
  return {
    casa, fora, gols,
    texto: `${casa}-${fora}`,
    over05: gols > 0.5,
    over15: gols > 1.5,
    over25: gols > 2.5,
    over35: gols > 3.5,
    ambasSim: casa > 0 && fora > 0,
    casaVence: casa > fora,
    empate: casa === fora,
    foraVence: fora > casa,
  }
}

function verificarFiltro(p: PlacarInfo, filtros: any): boolean {
  if (filtros.over && p.gols <= parseFloat(filtros.over)) return false
  if (filtros.under && p.gols >= parseFloat(filtros.under)) return false
  if (filtros.ambas === 'sim' && !p.ambasSim) return false
  if (filtros.ambas === 'nao' && p.ambasSim) return false
  if (filtros.resultado === 'casa' && !p.casaVence) return false
  if (filtros.resultado === 'empate' && !p.empate) return false
  if (filtros.resultado === 'fora' && !p.foraVence) return false
  return true
}

function calcularTendencias(linhas: Partida[], colunas: string[], tipoIA: number): Tendencia[] {
  const tendencias: Tendencia[] = []
  const horas = Math.min(linhas.length, 48)

  colunas.forEach(col => {
    const historico: (PlacarInfo | null)[] = []
    for (let i = 0; i < horas; i++) {
      historico.push(extrairPlacarRaw(linhas[i]?.[col] as string))
    }

    const validos = historico.filter(p => p !== null) as PlacarInfo[]
    if (validos.length < 5) return

    const minuto = col.replace('tempo', '')
    const pctOver = Math.round((validos.filter(p => p.over25).length / validos.length) * 100)
    const pctAmbas = Math.round((validos.filter(p => p.ambasSim).length / validos.length) * 100)
    const mediaGols = Math.round((validos.reduce((s, p) => s + p.gols, 0) / validos.length) * 10) / 10

    // Sequência atual
    let seqAtual = 0
    let dirAtual: boolean | null = null
    for (const p of historico) {
      if (!p) continue
      if (dirAtual === null) { dirAtual = p.over25; seqAtual = 1 }
      else if (p.over25 === dirAtual) seqAtual++
      else break
    }

    let prob = pctOver
    let motivo = ''
    let confianca = 55

    if (tipoIA === 1) {
      // Tipo 1: Sequência simples 2h
      if (seqAtual >= 3 && dirAtual === false) {
        prob = Math.min(pctOver + seqAtual * 8, 92)
        motivo = `${seqAtual}x RED seguidos → correção esperada`
        confianca = Math.min(70 + seqAtual * 5, 92)
      } else if (seqAtual >= 3 && dirAtual === true) {
        prob = Math.max(pctOver - seqAtual * 6, 18)
        motivo = `${seqAtual}x GREEN seguidos → possível reversão`
        confianca = Math.min(65 + seqAtual * 4, 88)
      } else {
        motivo = `${pctOver}% histórico | Seq: ${seqAtual}`
        confianca = Math.abs(pctOver - 50) > 15 ? 70 : 50
      }

    } else if (tipoIA === 2) {
      // Tipo 2: Correlação hora anterior
      const ultimaHora = historico[0]
      const penultimaHora = historico[1]
      let ajuste = 0
      if (ultimaHora && !ultimaHora.over25) ajuste += 10
      if (penultimaHora && !penultimaHora.over25) ajuste += 8
      if (pctAmbas > 60) ajuste += 5
      if (mediaGols > 2.5) ajuste += 5
      prob = Math.min(pctOver + ajuste, 93)
      motivo = `Hist:${pctOver}% | Últ.hora:${ultimaHora ? (ultimaHora.over25 ? 'G' : 'R') : '?'} | Gols:${mediaGols}`
      confianca = Math.abs(prob - 50) > 20 ? 78 : 58

    } else {
      // Tipo 3: Análise avançada — ciclos + padrões compostos
      let cicloCount = 0
      let ant = historico[0]?.over25
      for (let i = 1; i < Math.min(historico.length, 24); i++) {
        const p = historico[i]
        if (!p) continue
        if (p.over25 !== ant) { cicloCount++; ant = p.over25 }
      }
      const cicloMedio = cicloCount > 0 ? Math.round(24 / cicloCount) : 0

      // Ajuste por ciclo
      if (cicloMedio > 0 && seqAtual >= cicloMedio) {
        const fatorCiclo = Math.min((seqAtual - cicloMedio + 1) * 12, 30)
        prob = dirAtual ? Math.max(pctOver - fatorCiclo, 15) : Math.min(pctOver + fatorCiclo, 93)
        confianca = Math.min(75 + (seqAtual - cicloMedio) * 5, 93)
      }

      // Boost por ambas marcam e média gols
      if (pctAmbas > 65) prob = Math.min(prob + 8, 93)
      if (mediaGols > 3.0) prob = Math.min(prob + 6, 93)
      if (mediaGols < 1.5) prob = Math.max(prob - 8, 15)

      prob = Math.round(prob)
      motivo = `Ciclo≈${cicloMedio} | Seq:${seqAtual} | ${mediaGols}g/p | Ambas:${pctAmbas}%`
      confianca = seqAtual >= 4 ? Math.min(80 + seqAtual * 2, 93) : Math.abs(prob - 50) > 20 ? 72 : 55
    }

    tendencias.push({
      minuto,
      probabilidade: Math.round(prob),
      sequencia: seqAtual,
      direcao: prob >= 50 ? 'GREEN' : 'RED',
      motivo,
      confianca,
    })
  })

  return tendencias
}

const FILTRO_VAZIO = { over: '', under: '', ambas: '', resultado: '' }

export default function GradeResultados({ linhas, colunas }: Props) {
  const [filtros, setFiltros] = useState({ ...FILTRO_VAZIO })
  const [filtrosAtivos, setFiltrosAtivos] = useState({ ...FILTRO_VAZIO })
  const [tipoIA, setTipoIA] = useState<1 | 2 | 3>(1)
  const [mostrarIA, setMostrarIA] = useState(true)

  const temFiltro = Object.values(filtrosAtivos).some(v => v !== '')
  const colsUsadas = colunas.length > 0 ? colunas : ['tempo01','tempo04','tempo07','tempo10','tempo13','tempo16','tempo19','tempo22','tempo25','tempo28','tempo31','tempo34','tempo37','tempo40','tempo43','tempo46','tempo49','tempo52','tempo55','tempo58']

  const colStats = useMemo((): ColStats[] => {
    return colsUsadas.map(col => {
      let total = 0, greens = 0, totalGols = 0
      linhas.forEach(linha => {
        const p = extrairPlacarRaw(linha[col] as string)
        if (p) {
          total++
          totalGols += p.gols
          const pass = !temFiltro || verificarFiltro(p, filtrosAtivos)
          if (pass && p.over25) greens++
        }
      })
      return { col, total, greens, pctGreen: total > 0 ? Math.round((greens / total) * 100) : 0, mediaGols: total > 0 ? Math.round((totalGols / total) * 10) / 10 : 0 }
    })
  }, [linhas, colunas, filtrosAtivos])

  const linhaStats = useMemo((): LinhaStats[] => {
    return linhas.map((linha, idx) => {
      let total = 0, greens = 0, totalGols = 0
      colsUsadas.forEach(col => {
        const p = extrairPlacarRaw(linha[col] as string)
        if (p) {
          total++
          totalGols += p.gols
          if (p.over25) greens++
        }
      })
      return { idx, total, greens, pctGreen: total > 0 ? Math.round((greens / total) * 100) : 0, totalGols }
    })
  }, [linhas, colunas])

  const tendencias = useMemo(() => {
    if (!mostrarIA || linhas.length < 5) return []
    return calcularTendencias(linhas, colsUsadas, tipoIA)
  }, [linhas, colunas, tipoIA, mostrarIA])

  const totalPartidas = linhaStats.reduce((s, l) => s + l.total, 0)
  const totalGreens = linhaStats.reduce((s, l) => s + l.greens, 0)
  const pctGeral = totalPartidas > 0 ? Math.round((totalGreens / totalPartidas) * 100) : 0
  const mediaGolsGeral = totalPartidas > 0 ? Math.round((linhaStats.reduce((s, l) => s + l.totalGols, 0) / totalPartidas) * 10) / 10 : 0

  function aplicar() { setFiltrosAtivos({ ...filtros }) }
  function limpar() { setFiltros({ ...FILTRO_VAZIO }); setFiltrosAtivos({ ...FILTRO_VAZIO }) }

  const c = {
    bg: '#080c0e', bg2: '#0d1214', bg3: '#131a1d', bg4: '#1a2328',
    borda: '#1e2d33', verde: '#1a4a2e', vermelho: '#4a1a1a',
    verdeClaro: '#00c853', vermelhoClaro: '#c62828',
    texto: '#cfd8dc', texto2: '#607d8b', amarelo: '#b8960c', azul: '#1565c0',
  }

  const sel: any = { background: c.bg3, border: `1px solid ${c.borda}`, color: c.texto, padding: '6px 10px', fontSize: '13px', borderRadius: '4px', outline: 'none', cursor: 'pointer' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* STATS HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { lbl: 'MEDIA GREENS', val: `${pctGeral}%`, cor: c.verdeClaro },
            { lbl: 'MÉDIA GOLS', val: String(mediaGolsGeral), cor: c.amarelo },
            { lbl: 'PARTIDAS', val: String(totalPartidas), cor: c.texto },
          ].map(s => (
            <div key={s.lbl} style={{ background: c.bg2, border: `1px solid ${c.borda}`, borderRadius: '6px', padding: '8px 14px' }}>
              <div style={{ fontSize: '10px', color: c.texto2, letterSpacing: '2px' }}>{s.lbl}</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: s.cor, fontFamily: 'monospace' }}>{s.val}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setMostrarIA(!mostrarIA)} style={{ padding: '6px 14px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', letterSpacing: '1px', background: mostrarIA ? c.verdeClaro : c.bg4, color: mostrarIA ? '#000' : c.texto2 }}>
            IA {mostrarIA ? 'ON' : 'OFF'}
          </button>
          {mostrarIA && ([1,2,3] as const).map(t => (
            <button key={t} onClick={() => setTipoIA(t)} style={{ padding: '6px 14px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', background: tipoIA === t ? c.azul : c.bg4, color: tipoIA === t ? '#fff' : c.texto2 }}>
              TIPO {t}
            </button>
          ))}
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ background: c.bg2, border: `1px solid ${c.borda}`, borderRadius: '8px', padding: '12px 16px' }}>
        <div style={{ fontSize: '10px', color: c.texto2, letterSpacing: '2px', marginBottom: '10px' }}>FILTROS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: c.texto2, fontWeight: 700 }}>OVER</span>
            <select style={sel} value={filtros.over} onChange={e => setFiltros(p => ({ ...p, over: e.target.value }))}>
              <option value="">—</option>
              {['0.5','1.5','2.5','3.5'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: c.texto2, fontWeight: 700 }}>UNDER</span>
            <select style={sel} value={filtros.under} onChange={e => setFiltros(p => ({ ...p, under: e.target.value }))}>
              <option value="">—</option>
              {['1.5','2.5','3.5'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: c.texto2, fontWeight: 700 }}>AMBAS</span>
            <select style={sel} value={filtros.ambas} onChange={e => setFiltros(p => ({ ...p, ambas: e.target.value }))}>
              <option value="">—</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: c.texto2, fontWeight: 700 }}>RESULTADO</span>
            <select style={sel} value={filtros.resultado} onChange={e => setFiltros(p => ({ ...p, resultado: e.target.value }))}>
              <option value="">—</option>
              <option value="casa">Casa</option>
              <option value="empate">Empate</option>
              <option value="fora">Fora</option>
            </select>
          </div>
          <button onClick={aplicar} style={{ background: c.verdeClaro, color: '#000', border: 'none', padding: '7px 18px', fontWeight: 700, fontSize: '13px', borderRadius: '4px', cursor: 'pointer' }}>FILTRAR</button>
          <button onClick={limpar} style={{ background: 'transparent', color: c.texto2, border: `1px solid ${c.borda}`, padding: '7px 14px', fontSize: '13px', borderRadius: '4px', cursor: 'pointer' }}>LIMPAR</button>
        </div>
      </div>

      {/* PAINEL APOSTAR AGORA */}
      {mostrarIA && tendencias.length > 0 && (() => {
        const melhores = tendencias
          .filter(t => t.probabilidade >= 60 && t.confianca >= 65)
          .sort((a, b) => (b.probabilidade + b.confianca) - (a.probabilidade + a.confianca))
          .slice(0, 5)
        if (melhores.length === 0) return null
        return (
          <div style={{ background: '#071a0f', border: `2px solid ${c.verdeClaro}`, borderRadius: '8px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: c.verdeClaro, animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 800, color: c.verdeClaro, letterSpacing: '2px' }}>
                MELHORES ENTRADAS — PRÓXIMA PARTIDA
              </span>
              <span style={{ fontSize: '11px', color: c.texto2, marginLeft: '8px' }}>IA TIPO {tipoIA}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {melhores.map((t, i) => (
                <div key={i} style={{ background: '#0a2a18', border: `1px solid ${c.verdeClaro}44`, borderRadius: '6px', padding: '10px 14px', minWidth: '120px' }}>
                  <div style={{ fontSize: '11px', color: c.texto2, marginBottom: '4px', letterSpacing: '1px' }}>MIN {t.minuto}</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: c.verdeClaro, fontFamily: 'monospace', lineHeight: 1 }}>
                    {t.probabilidade}%
                  </div>
                  <div style={{ fontSize: '10px', color: '#4a9a6a', marginTop: '2px' }}>
                    Confiança: {t.confianca}%
                  </div>
                  <div style={{ fontSize: '10px', color: c.texto2, marginTop: '3px', maxWidth: '140px' }}>
                    {t.motivo.split('|')[0]}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: c.texto2, marginTop: '10px' }}>
              ⚠️ Aposte apenas quando probabilidade ≥ 65% E confiança ≥ 70%. Nunca aposte em sequências longas sem confirmar com o histórico.
            </div>
          </div>
        )
      })()}

      {/* GRADE */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            {/* % por coluna */}
            <tr>
              <th style={{ background: c.bg2, border: `1px solid ${c.borda}`, padding: '5px 8px', color: c.verdeClaro, fontSize: '10px', position: 'sticky', left: 0, zIndex: 3, minWidth: '44px' }}>HORA</th>
              {colStats.map(cs => (
                <th key={cs.col} style={{ background: c.bg2, border: `1px solid ${c.borda}`, padding: '4px 5px', textAlign: 'center', minWidth: '50px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: cs.pctGreen >= 50 ? c.verdeClaro : c.vermelhoClaro }}>{cs.pctGreen}%</div>
                  <div style={{ fontSize: '10px', color: c.texto2 }}>{cs.total}</div>
                </th>
              ))}
              <th style={{ background: c.bg2, border: `1px solid ${c.borda}`, padding: '4px 8px', color: c.texto2, fontSize: '10px', minWidth: '72px', textAlign: 'center' }}>% | GOLS</th>
            </tr>

            {/* IA Tendência */}
            {mostrarIA && (
              <tr>
                <th style={{ background: '#071020', border: `1px solid ${c.borda}`, padding: '4px 8px', color: c.azul, fontSize: '10px', position: 'sticky', left: 0, zIndex: 3 }}>IA T{tipoIA}</th>
                {colsUsadas.map(col => {
                  const t = tendencias.find(t => t.minuto === col.replace('tempo', ''))
                  return (
                    <td key={col} title={t?.motivo} style={{ background: '#071020', border: `1px solid ${c.borda}`, padding: '3px 2px', textAlign: 'center' }}>
                      {t ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: t.direcao === 'GREEN' ? c.verdeClaro : c.vermelhoClaro }}>{t.probabilidade}%</span>
                          <span style={{ fontSize: '9px', color: '#4a7fb5' }}>{t.confianca}%</span>
                        </div>
                      ) : <span style={{ color: c.borda }}>—</span>}
                    </td>
                  )
                })}
                <td style={{ background: '#071020', border: `1px solid ${c.borda}` }} />
              </tr>
            )}

            {/* Minutos */}
            <tr>
              <th style={{ background: c.bg3, border: `1px solid ${c.borda}`, padding: '5px 8px', color: c.texto2, fontSize: '10px', position: 'sticky', left: 0, zIndex: 3 }}>MIN</th>
              {colsUsadas.map(col => (
                <th key={col} style={{ background: c.bg3, border: `1px solid ${c.borda}`, padding: '5px 5px', color: c.texto2, fontSize: '10px', textAlign: 'center' }}>
                  {col.replace('tempo', '')}
                </th>
              ))}
              <th style={{ background: c.bg3, border: `1px solid ${c.borda}`, padding: '5px 8px', color: c.texto2, fontSize: '10px', textAlign: 'center' }}>% | G</th>
            </tr>
          </thead>

          <tbody>
            {linhas.map((linha, idx) => {
              const ls = linhaStats[idx]
              return (
                <tr key={idx}>
                  <td style={{ background: c.bg2, border: `1px solid ${c.borda}`, padding: '2px 8px', color: c.verdeClaro, fontWeight: 700, fontSize: '12px', position: 'sticky', left: 0, textAlign: 'center', fontFamily: 'monospace' }}>
                    {String(idx).padStart(2, '0')}
                  </td>
                  {colsUsadas.map(col => {
                    const p = extrairPlacarRaw(linha[col] as string)
                    const isGreen = p !== null && (!temFiltro || verificarFiltro(p, filtrosAtivos))
                    return (
                      <td key={col} style={{ padding: '2px 3px', border: `1px solid rgba(255,255,255,0.03)`, textAlign: 'center' }}>
                        {p ? (
                          <span style={{ display: 'inline-block', padding: '3px 5px', borderRadius: '3px', fontWeight: 700, fontSize: '12px', fontFamily: 'monospace', background: isGreen ? c.verde : c.vermelho, color: '#fff', minWidth: '38px', textAlign: 'center' }}>
                            {p.texto}
                          </span>
                        ) : (
                          <span style={{ color: c.borda, fontSize: '10px' }}>—</span>
                        )}
                      </td>
                    )
                  })}
                  <td style={{ background: c.bg2, border: `1px solid ${c.borda}`, padding: '2px 8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: ls.pctGreen >= 50 ? c.verdeClaro : c.vermelhoClaro }}>{ls.pctGreen}%</span>
                    <span style={{ fontSize: '10px', color: c.texto2, marginLeft: '4px' }}>{ls.totalGols}g</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* LEGENDA */}
      {mostrarIA && (
        <div style={{ background: c.bg2, border: `1px solid ${c.borda}`, borderRadius: '6px', padding: '10px 14px', fontSize: '11px', color: c.texto2, lineHeight: '1.6' }}>
          <span style={{ color: c.azul, fontWeight: 700 }}>IA TIPO {tipoIA} </span>
          {tipoIA === 1 && '— Sequência 2h: detecta correções após sequências longas de RED/GREEN'}
          {tipoIA === 2 && '— Correlação horária: analisa resultado da hora anterior + ambas marcam'}
          {tipoIA === 3 && '— Avançada: ciclos do algoritmo + padrões compostos + média de gols'}
          <span style={{ marginLeft: '12px' }}><span style={{ color: c.verdeClaro }}>■</span> % = prob. de GREEN | </span>
          <span><span style={{ color: '#4a7fb5' }}>■</span> % menor = confiança</span>
        </div>
      )}
    </div>
  )
}
