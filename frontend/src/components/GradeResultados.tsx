import { useState, useMemo } from 'react'
import { Partida } from '../pages/Dashboard'

interface Props {
  linhas: Partida[]
  colunas: string[]
  liga?: string
}

interface PlacarInfo {
  casa: number; fora: number; texto: string; gols: number
  over05: boolean; over15: boolean; over25: boolean; over35: boolean
  ambasSim: boolean; casaVence: boolean; empate: boolean; foraVence: boolean
}

interface Tendencia {
  minuto: string
  mercado: string
  probabilidade: number
  confianca: number
  motivo: string
}

const FILTRO_VAZIO = { over: '', under: '', ambas: '', resultado: '' }

function extrairPlacar(val: string | null): PlacarInfo | null {
  if (!val) return null
  const linha = val.split('</br>')[0].split('<br>')[0].trim()
  const m = linha.match(/(\d+)\s*-\s*(\d+)/)
  if (!m) return null
  const casa = parseInt(m[1]), fora = parseInt(m[2]), gols = casa + fora
  return {
    casa, fora, gols, texto: `${casa}-${fora}`,
    over05: gols > 0.5, over15: gols > 1.5, over25: gols > 2.5, over35: gols > 3.5,
    ambasSim: casa > 0 && fora > 0,
    casaVence: casa > fora, empate: casa === fora, foraVence: fora > casa,
  }
}

function passaFiltro(p: PlacarInfo, f: typeof FILTRO_VAZIO): boolean {
  if (f.over && p.gols <= parseFloat(f.over)) return false
  if (f.under && p.gols >= parseFloat(f.under)) return false
  if (f.ambas === 'sim' && !p.ambasSim) return false
  if (f.ambas === 'nao' && p.ambasSim) return false
  if (f.resultado === 'casa' && !p.casaVence) return false
  if (f.resultado === 'empate' && !p.empate) return false
  if (f.resultado === 'fora' && !p.foraVence) return false
  return true
}

function calcularIA(linhas: Partida[], colunas: string[], tipoIA: number, filtroAtivo: typeof FILTRO_VAZIO): Tendencia[] {
  const horas = Math.min(linhas.length, 48)
  const resultado: Tendencia[] = []
  const temFiltro = Object.values(filtroAtivo).some(v => v !== '')

  // Pré-calcular histórico de todas as colunas para correlação entre minutos
  const histMap: Record<string, (PlacarInfo | null)[]> = {}
  colunas.forEach(col => {
    const hist: (PlacarInfo | null)[] = []
    for (let i = 0; i < horas; i++) hist.push(extrairPlacar(linhas[i]?.[col] as string))
    histMap[col] = []
    for (let i = 0; i < horas; i++) histMap[col].push(extrairPlacar(linhas[i]?.[col] as string))
  })

  colunas.forEach((col, colIdx) => {
    const hist = histMap[col]
    const validos = hist.filter(Boolean) as PlacarInfo[]
    if (validos.length < 5) return

    const min = col.replace('tempo', '')
    const n = validos.length

    // % por mercado
    const pO05 = Math.round(validos.filter(p => p.over05).length / n * 100)
    const pO15 = Math.round(validos.filter(p => p.over15).length / n * 100)
    const pO25 = Math.round(validos.filter(p => p.over25).length / n * 100)
    const pO35 = Math.round(validos.filter(p => p.over35).length / n * 100)
@@ -74,7 +78,7 @@
    const pFora = Math.round(validos.filter(p => p.foraVence).length / n * 100)
    const mediaG = Math.round(validos.reduce((s, p) => s + p.gols, 0) / n * 10) / 10

    // Sequência atual over25
    // Sequência atual
    let seq = 0; let dir: boolean | null = null
    for (const p of hist) {
      if (!p) continue
@@ -83,68 +87,85 @@
      else break
    }

    // Variação recente (últimas 5 vs histórico)
    const ult5 = hist.slice(0, 5).filter(Boolean) as PlacarInfo[]
    const pO25Rec = ult5.length > 0 ? Math.round(ult5.filter(p => p.over25).length / ult5.length * 100) : pO25
    const varRec = pO25Rec - pO25

    // Correlação com minuto anterior
    let corrBoost = 0
    if (colIdx > 0) {
      const colAnt = colunas[colIdx - 1]
      const histAnt = histMap[colAnt]
      let concord = 0, tot = 0
      for (let i = 0; i < Math.min(hist.length, histAnt.length, 24); i++) {
        const a = histAnt[i], b = hist[i]
        if (!a || !b) continue
        tot++
        if (!a.over25 && b.over25) concord++ // ant RED → atual GREEN
      }
      const pCorr = tot > 0 ? concord / tot : 0
      if (histAnt[0] && !histAnt[0].over25 && pCorr > 0.5) corrBoost = Math.round(pCorr * 18)
    }

    // Análise de ciclos
    let cc = 0; let ant = hist[0]?.over25
    for (let i = 1; i < Math.min(hist.length, 24); i++) {
      const p = hist[i]; if (!p) continue
      if (p.over25 !== ant) { cc++; ant = p.over25 }
    }
    const cicloMedio = cc > 0 ? Math.round(24 / cc) : 0
    const cicloBoost = cicloMedio > 0 && seq >= cicloMedio ? Math.min((seq - cicloMedio + 1) * 10, 25) : 0

    // Boost por tipo de IA
    let boost = 0
    if (tipoIA === 1) boost = seq >= 3 && dir === false ? seq * 8 : 0
    else if (tipoIA === 2) boost = hist[0] && !hist[0]!.over25 ? 15 : 0
    else {
      let cc = 0; let ant = hist[0]?.over25
      for (let i = 1; i < Math.min(hist.length, 24); i++) {
        const p = hist[i]; if (!p) continue
        if (p.over25 !== ant) { cc++; ant = p.over25 }
      }
      const cm = cc > 0 ? Math.round(24 / cc) : 0
      boost = cm > 0 && seq >= cm ? Math.min((seq - cm + 1) * 12, 30) : 0
    if (tipoIA === 1) {
      boost = seq >= 3 && dir === false ? seq * 8 : seq >= 3 && dir === true ? -(seq * 5) : 0
    } else if (tipoIA === 2) {
      boost = corrBoost + (varRec < -10 ? 12 : varRec > 10 ? -8 : 0)
    } else {
      boost = cicloBoost + corrBoost + (varRec < -15 ? 15 : varRec > 15 ? -10 : 0)
      if (mediaG > 3.0) boost += 5
      if (mediaG < 1.5) boost -= 8
    }

    // Se tem filtro ativo, calcular prob para esse mercado específico
    const baseOver25 = Math.min(Math.max(pO25 + (dir === false ? Math.abs(boost) : dir === true ? -Math.abs(boost) : boost), 10), 93)

    let mercadoNome = ''
    let probFinal = 0
    let confiancaFinal = 55

    if (temFiltro) {
      // Calcular % histórica para o filtro selecionado
      const greens = validos.filter(p => passaFiltro(p, filtroAtivo)).length
      const pctFiltro = Math.round(greens / n * 100)

      // Montar nome do mercado
      const partes = []
      if (filtroAtivo.over) partes.push(`OVER ${filtroAtivo.over}`)
      if (filtroAtivo.under) partes.push(`UNDER ${filtroAtivo.under}`)
      if (filtroAtivo.ambas === 'sim') partes.push('AMBAS SIM')
      if (filtroAtivo.ambas === 'nao') partes.push('AMBAS NÃO')
      if (filtroAtivo.resultado) partes.push(filtroAtivo.resultado.toUpperCase())
      mercadoNome = partes.join(' + ')

      probFinal = Math.min(pctFiltro + (dir === false ? boost : 0), 93)
      confiancaFinal = boost > 0 ? Math.min(75 + boost, 93) : Math.abs(probFinal - 50) > 20 ? 72 : 55
      probFinal = Math.min(Math.max(pctFiltro + (dir === false ? Math.abs(boost) : 0), 10), 93)
      confiancaFinal = Math.abs(boost) > 15 ? 88 : Math.abs(boost) > 8 ? 78 : Math.abs(probFinal - 50) > 20 ? 70 : 55
    } else {
      // Sem filtro: encontrar melhor mercado automaticamente
      const opcoes = [
        { nome: 'OVER 1.5', prob: pO15 },
        { nome: 'OVER 2.5', prob: Math.min(pO25 + (dir === false ? boost : 0), 93) },
        { nome: 'UNDER 2.5', prob: Math.min(pU25 + (dir === true ? boost : 0), 93) },
        { nome: 'OVER 3.5', prob: pO35 },
        { nome: 'AMBAS SIM', prob: Math.min(pAmbas + (pAmbas > 55 ? Math.round(boost / 2) : 0), 92) },
        { nome: 'CASA', prob: pCasa },
        { nome: 'EMPATE', prob: pEmp },
        { nome: 'FORA', prob: pFora },
        { nome: 'OVER 1.5', prob: Math.min(pO15, 95) },
        { nome: 'OVER 2.5', prob: baseOver25 },
        { nome: 'UNDER 2.5', prob: Math.min(100 - baseOver25 + (dir === true ? Math.abs(boost) : 0), 93) },
        { nome: 'OVER 3.5', prob: Math.min(pO35 + (mediaG > 3 ? 8 : 0), 88) },
        { nome: 'AMBAS SIM', prob: Math.min(pAmbas + (pAmbas > 55 ? Math.round(Math.abs(boost) / 3) : 0), 92) },
        { nome: 'CASA', prob: pCasa }, { nome: 'EMPATE', prob: pEmp }, { nome: 'FORA', prob: pFora },
      ].sort((a, b) => b.prob - a.prob)

      const melhor = opcoes[0]
      mercadoNome = melhor.nome
      probFinal = Math.round(melhor.prob)
      confiancaFinal = boost > 0 ? Math.min(75 + boost, 93) : Math.abs(probFinal - 50) > 20 ? 72 : 55
      confiancaFinal = Math.abs(boost) > 15 ? 88 : Math.abs(boost) > 8 ? 78 : Math.abs(probFinal - 50) > 20 ? 70 : 55
    }

    const motivo = `Seq:${seq} | Gols:${mediaG} | Ambas:${pAmbas}%`

    resultado.push({
      minuto: min,
      mercado: mercadoNome,
      probabilidade: Math.round(probFinal),
      confianca: confiancaFinal,
      motivo,
      minuto: min, mercado: mercadoNome,
      probabilidade: Math.round(probFinal), confianca: confiancaFinal,
      motivo: `Seq:${seq} | Ciclo≈${cicloMedio} | Rec:${pO25Rec}% | ${mediaG}g`,
    })
  })

@@ -321,23 +342,23 @@
            {/* IA Tendência — só mostra prob/conf quando filtro ativo */}
            {mostrarIA && (
              <tr>
                <th style={{ background: '#071020', border: `1px solid ${c.borda}`, padding: '4px 8px', color: c.azul, fontSize: '10px', position: 'sticky', left: 0, zIndex: 3 }}>IA T{tipoIA}</th>
                <th style={{ background: '#071020', border: `1px solid ${c.borda}`, padding: '2px 6px', color: c.azul, fontSize: '10px', position: 'sticky', left: 0, zIndex: 3, height: '28px' }}>IA T{tipoIA}</th>
                {cols.map(col => {
                  const t = tendencias.find(t => t.minuto === col.replace('tempo', ''))
                  return (
                    <td key={col} title={t?.motivo} style={{ background: '#071020', border: `1px solid ${c.borda}`, padding: '3px 2px', textAlign: 'center' }}>
                    <td key={col} title={t?.motivo} style={{ background: '#071020', border: `1px solid ${c.borda}`, padding: '1px 2px', textAlign: 'center', height: '28px' }}>
                      {t && temFiltro ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: c.azul }}>{t.probabilidade}%</span>
                          <span style={{ fontSize: '9px', color: c.verdeClaro }}>{t.confianca}%</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: c.azul, lineHeight: '1.2' }}>{t.probabilidade}%</span>
                          <span style={{ fontSize: '9px', color: c.verdeClaro, lineHeight: '1.2' }}>{t.confianca}%</span>
                        </div>
                      ) : t ? (
                        <span style={{ fontSize: '10px', color: c.texto2, fontWeight: 600 }}>{t.mercado}</span>
                        <span style={{ fontSize: '9px', color: c.texto2, fontWeight: 600 }}>{t.mercado}</span>
                      ) : <span style={{ color: c.borda }}>—</span>}
                    </td>
                  )
                })}
                <td style={{ background: '#071020', border: `1px solid ${c.borda}` }} />
                <td style={{ background: '#071020', border: `1px solid ${c.borda}`, height: '28px' }} />
              </tr>
            )}

@@ -368,38 +389,38 @@
                      <td key={col} style={{ padding: '2px 3px', border: `1px solid rgba(255,255,255,0.03)`, textAlign: 'center' }}>
                        {p ? (
                          <span style={{
                            display: 'inline-block', padding: '3px 5px', borderRadius: '3px',
                            fontWeight: 700, fontSize: '12px', fontFamily: 'monospace',
                            display: 'inline-block', padding: '2px 4px', borderRadius: '3px',
                            fontWeight: 700, fontSize: '11px', fontFamily: 'monospace',
                            background: isGreen ? c.verde : c.vermelho,
                            color: '#fff', minWidth: '38px', textAlign: 'center',
                            color: '#fff', minWidth: '36px', textAlign: 'center',
                          }}>
                            {p.texto}
                          </span>
                        ) : <span style={{ color: c.borda, fontSize: '10px' }}>—</span>}
                      </td>
                    )
                  })}
                  <td style={{ background: c.bg2, border: `1px solid ${c.borda}`, padding: '2px 8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: ls.pct >= 50 ? c.verdeClaro : c.vermelhoClaro }}>{ls.pct}%</span>
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
        <div style={{ background: c.bg2, border: `1px solid ${c.borda}`, borderRadius: '6px', padding: '10px 14px', fontSize: '11px', color: c.texto2 }}>
          <span style={{ color: c.azul, fontWeight: 700 }}>IA TIPO {tipoIA} </span>
          {tipoIA === 1 && '— Sequência 2h: detecta correções após sequências longas'}
          {tipoIA === 2 && '— Correlação horária: analisa resultado da hora anterior'}
          {tipoIA === 3 && '— Avançada: ciclos do algoritmo + padrões compostos'}
          {!temFiltro && <span style={{ marginLeft: '12px', color: c.amarelo }}>← Selecione um filtro para ver probabilidade e confiança por minuto</span>}
        </div>
      )}
    </div>
  )
}
