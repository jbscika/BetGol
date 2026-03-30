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
    histMap[col] = []
    for (let i = 0; i < horas; i++) histMap[col].push(extrairPlacar(linhas[i]?.[col] as string))
  })

  colunas.forEach((col, colIdx) => {
    const hist = histMap[col]
    const validos = hist.filter(Boolean) as PlacarInfo[]
    if (validos.length < 5) return

    const min = col.replace('tempo', '')
    const n = validos.length

    const pO15 = Math.round(validos.filter(p => p.over15).length / n * 100)
    const pO25 = Math.round(validos.filter(p => p.over25).length / n * 100)
    const pO35 = Math.round(validos.filter(p => p.over35).length / n * 100)
    const pU25 = 100 - pO25
    const pAmbas = Math.round(validos.filter(p => p.ambasSim).length / n * 100)
    const pCasa = Math.round(validos.filter(p => p.casaVence).length / n * 100)
    const pEmp = Math.round(validos.filter(p => p.empate).length / n * 100)
    const pFora = Math.round(validos.filter(p => p.foraVence).length / n * 100)
    const mediaG = Math.round(validos.reduce((s, p) => s + p.gols, 0) / n * 10) / 10

    // Sequência atual
    let seq = 0; let dir: boolean | null = null
    for (const p of hist) {
      if (!p) continue
      if (dir === null) { dir = p.over25; seq = 1 }
      else if (p.over25 === dir) seq++
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
    if (tipoIA === 1) {
      boost = seq >= 3 && dir === false ? seq * 8 : seq >= 3 && dir === true ? -(seq * 5) : 0
    } else if (tipoIA === 2) {
      boost = corrBoost + (varRec < -10 ? 12 : varRec > 10 ? -8 : 0)
    } else {
      boost = cicloBoost + corrBoost + (varRec < -15 ? 15 : varRec > 15 ? -10 : 0)
      if (mediaG > 3.0) boost += 5
      if (mediaG < 1.5) boost -= 8
    }

    const baseOver25 = Math.min(Math.max(pO25 + (dir === false ? Math.abs(boost) : dir === true ? -Math.abs(boost) : boost), 10), 93)

    let mercadoNome = ''
    let probFinal = 0
    let confiancaFinal = 55

    if (temFiltro) {
      const greens = validos.filter(p => passaFiltro(p, filtroAtivo)).length
      const pctFiltro = Math.round(greens / n * 100)
      const partes = []
      if (filtroAtivo.over) partes.push(`OVER ${filtroAtivo.over}`)
      if (filtroAtivo.under) partes.push(`UNDER ${filtroAtivo.under}`)
      if (filtroAtivo.ambas === 'sim') partes.push('AMBAS SIM')
      if (filtroAtivo.ambas === 'nao') partes.push('AMBAS NÃO')
      if (filtroAtivo.resultado) partes.push(filtroAtivo.resultado.toUpperCase())
      mercadoNome = partes.join(' + ')
      probFinal = Math.min(Math.max(pctFiltro + (dir === false ? Math.abs(boost) : 0), 10), 93)
      confiancaFinal = Math.abs(boost) > 15 ? 88 : Math.abs(boost) > 8 ? 78 : Math.abs(probFinal - 50) > 20 ? 70 : 55
    } else {
      const opcoes = [
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
      confiancaFinal = Math.abs(boost) > 15 ? 88 : Math.abs(boost) > 8 ? 78 : Math.abs(probFinal - 50) > 20 ? 70 : 55
    }

    resultado.push({
      minuto: min, mercado: mercadoNome,
      probabilidade: Math.round(probFinal), confianca: confiancaFinal,
      motivo: `Seq:${seq} | Ciclo≈${cicloMedio} | Rec:${pO25Rec}% | ${mediaG}g`,
    })
  })

  return resultado
}

export default function GradeResultados({ linhas, colunas, liga }: Props) {
  const [filtros, setFiltros] = useState({ ...FILTRO_VAZIO })
  const [filtrosAtivos, setFiltrosAtivos] = useState({ ...FILTRO_VAZIO })
  const [tipoIA, setTipoIA] = useState<1 | 2 | 3>(1)
  const [mostrarIA, setMostrarIA] = useState(true)

  const temFiltro = Object.values(filtrosAtivos).some(v => v !== '')
  const cols = colunas.length > 0 ? colunas : ['tempo01','tempo04','tempo07','tempo10','tempo13','tempo16','tempo19','tempo22','tempo25','tempo28','tempo31','tempo34','tempo37','tempo40','tempo43','tempo46','tempo49','tempo52','tempo55','tempo58']

  // Stats por coluna
  const colStats = useMemo(() => cols.map(col => {
    let total = 0, greens = 0, totalGols = 0
    linhas.forEach(linha => {
      const p = extrairPlacar(linha[col] as string)
      if (p) { total++; totalGols += p.gols; if (!temFiltro || passaFiltro(p, filtrosAtivos)) if (p.over25) greens++ }
    })
    return { col, total, greens, pct: total > 0 ? Math.round(greens / total * 100) : 0 }
  }), [linhas, colunas, filtrosAtivos])

  // Stats por linha
  const linhaStats = useMemo(() => linhas.map((linha, idx) => {
    let total = 0, greens = 0, totalGols = 0
    cols.forEach(col => {
      const p = extrairPlacar(linha[col] as string)
      if (p) { total++; totalGols += p.gols; if (p.over25) greens++ }
    })
    return { idx, total, greens, pct: total > 0 ? Math.round(greens / total * 100) : 0, totalGols }
  }), [linhas, colunas])

  // IA Tendência — recalcula quando linhas, colunas, tipoIA ou filtro mudam
  const tendencias = useMemo(() => {
    if (!mostrarIA || linhas.length < 5) return []
    return calcularIA(linhas, cols, tipoIA, filtrosAtivos)
  }, [linhas, colunas, tipoIA, mostrarIA, filtrosAtivos])

  const totalP = linhaStats.reduce((s, l) => s + l.total, 0)
  const totalG = linhaStats.reduce((s, l) => s + l.greens, 0)
  const pctGeral = totalP > 0 ? Math.round(totalG / totalP * 100) : 0
  const mediaGols = totalP > 0 ? Math.round(linhaStats.reduce((s, l) => s + l.totalGols, 0) / totalP * 10) / 10 : 0

  function aplicar() { setFiltrosAtivos({ ...filtros }) }
  function limpar() { setFiltros({ ...FILTRO_VAZIO }); setFiltrosAtivos({ ...FILTRO_VAZIO }) }

  const c = {
    bg2: '#0d1214', bg3: '#131a1d', bg4: '#1a2328', borda: '#1e2d33',
    verde: '#1a4a2e', vermelho: '#7a1010',
    verdeClaro: '#00c853', vermelhoClaro: '#f44336',
    texto: '#cfd8dc', texto2: '#607d8b', amarelo: '#ffd600', azul: '#2979ff',
  }

  const sel: any = { background: c.bg3, border: `1px solid ${c.borda}`, color: c.texto, padding: '6px 10px', fontSize: '13px', borderRadius: '4px', outline: 'none', cursor: 'pointer' }

  // Calcular hora da próxima partida por minuto
  const agora = new Date()
  const horaAtual = agora.getHours()
  const minAtual = agora.getMinutes()

  function proximaHora(minuto: string): string {
    const minNum = parseInt(minuto)
    // Próxima ocorrência desse minuto
    let h = horaAtual
    let m = minAtual
    // Avança até o próximo minuto correspondente
    if (minNum <= m) h = (h + 1) % 24
    return `${String(h).padStart(2, '0')}:${String(minNum).padStart(2, '0')}`
  }

  // Melhores entradas
  const melhores = tendencias
    .filter(t => t.probabilidade >= 60 && t.confianca >= 65)
    .sort((a, b) => (b.probabilidade + b.confianca) - (a.probabilidade + a.confianca))
    .slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* STATS */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { lbl: 'MEDIA GREENS', val: `${pctGeral}%`, cor: c.verdeClaro },
            { lbl: 'MÉDIA GOLS', val: String(mediaGols), cor: c.amarelo },
            { lbl: 'PARTIDAS', val: String(totalP), cor: c.texto },
          ].map(s => (
            <div key={s.lbl} style={{ background: c.bg2, border: `1px solid ${c.borda}`, borderRadius: '6px', padding: '8px 14px' }}>
              <div style={{ fontSize: '10px', color: c.texto2, letterSpacing: '2px' }}>{s.lbl}</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: s.cor, fontFamily: 'monospace' }}>{s.val}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setMostrarIA(!mostrarIA)} style={{ padding: '6px 14px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', background: mostrarIA ? c.verdeClaro : c.bg4, color: mostrarIA ? '#000' : c.texto2 }}>
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
              {['0.5','1.5','2.5','3.5'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: c.texto2, fontWeight: 700 }}>UNDER</span>
            <select style={sel} value={filtros.under} onChange={e => setFiltros(p => ({ ...p, under: e.target.value }))}>
              <option value="">—</option>
              {['1.5','2.5','3.5'].map(o => <option key={o} value={o}>{o}</option>)}
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

      {/* MELHORES ENTRADAS */}
      {mostrarIA && melhores.length > 0 && (
        <div style={{ background: '#071a0f', border: `2px solid ${c.verdeClaro}`, borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.verdeClaro }} />
            <span style={{ fontSize: '12px', fontWeight: 800, color: c.verdeClaro, letterSpacing: '2px' }}>MELHORES ENTRADAS — PRÓXIMA PARTIDA</span>
            <span style={{ fontSize: '11px', color: c.texto2 }}>IA TIPO {tipoIA}</span>
            {liga && <span style={{ fontSize: '11px', background: '#2979ff22', color: c.azul, border: `1px solid ${c.azul}44`, borderRadius: '4px', padding: '2px 8px', fontWeight: 700 }}>{liga.toUpperCase()}</span>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {melhores.map((t, i) => (
              <div key={i} style={{ background: '#0a2a18', border: `1px solid ${c.verdeClaro}44`, borderRadius: '6px', padding: '8px 12px', minWidth: '120px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '10px', color: c.texto2 }}>MIN {t.minuto}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: c.amarelo }}>→ {proximaHora(t.minuto)}</span>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: c.amarelo, marginBottom: '2px' }}>{t.mercado}</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: c.azul, fontFamily: 'monospace', lineHeight: 1 }}>{t.probabilidade}%</div>
                <div style={{ fontSize: '10px', color: c.verdeClaro, marginTop: '2px', fontWeight: 700 }}>Conf: {t.confianca}%</div>
                <div style={{ fontSize: '10px', color: c.texto2, marginTop: '2px' }}>{t.motivo.split('|')[0]}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '11px', color: c.texto2, marginTop: '10px' }}>⚠️ Aposte apenas quando prob ≥ 65% E confiança ≥ 70%</div>
        </div>
      )}

      {/* GRADE */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            {/* % por coluna */}
            <tr>
              <th style={{ background: c.bg2, border: `1px solid ${c.borda}`, padding: '5px 8px', color: c.verdeClaro, fontSize: '10px', position: 'sticky', left: 0, zIndex: 3, minWidth: '44px' }}>HORA</th>
              {colStats.map(cs => (
                <th key={cs.col} style={{ background: c.bg2, border: `1px solid ${c.borda}`, padding: '4px 5px', textAlign: 'center', minWidth: '52px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: cs.pct >= 50 ? c.verdeClaro : c.vermelhoClaro }}>{cs.pct}%</div>
                  <div style={{ fontSize: '10px', color: c.texto2 }}>{cs.total}</div>
                </th>
              ))}
              <th style={{ background: c.bg2, border: `1px solid ${c.borda}`, padding: '4px 8px', color: c.texto2, fontSize: '10px', minWidth: '72px', textAlign: 'center' }}>% | GOLS</th>
            </tr>

            {/* IA Tendência — só mostra prob/conf quando filtro ativo */}
            {mostrarIA && (
              <tr>
                <th style={{ background: '#071020', border: `1px solid ${c.borda}`, padding: '2px 6px', color: c.azul, fontSize: '10px', position: 'sticky', left: 0, zIndex: 3, height: '28px' }}>IA T{tipoIA}</th>
                {cols.map(col => {
                  const t = tendencias.find(t => t.minuto === col.replace('tempo', ''))
                  return (
                    <td key={col} title={t?.motivo} style={{ background: '#071020', border: `1px solid ${c.borda}`, padding: '1px 2px', textAlign: 'center', height: '28px' }}>
                      {t && temFiltro ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: c.azul, lineHeight: '1.2' }}>{t.probabilidade}%</span>
                          <span style={{ fontSize: '9px', color: c.verdeClaro, lineHeight: '1.2' }}>{t.confianca}%</span>
                        </div>
                      ) : t ? (
                        <span style={{ fontSize: '9px', color: c.texto2, fontWeight: 600 }}>{t.mercado}</span>
                      ) : <span style={{ color: c.borda }}>—</span>}
                    </td>
                  )
                })}
                <td style={{ background: '#071020', border: `1px solid ${c.borda}`, height: '28px' }} />
              </tr>
            )}

            {/* Minutos */}
            <tr>
              <th style={{ background: c.bg3, border: `1px solid ${c.borda}`, padding: '5px 8px', color: c.texto2, fontSize: '10px', position: 'sticky', left: 0, zIndex: 3 }}>MIN</th>
              {cols.map(col => (
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
                  <td style={{ background: c.bg2, border: `1px solid ${c.borda}`, padding: '1px 6px', color: c.verdeClaro, fontWeight: 700, fontSize: '11px', position: 'sticky', left: 0, textAlign: 'center', fontFamily: 'monospace', height: '24px' }}>
                    {String(idx).padStart(2, '0')}
                  </td>
                  {cols.map(col => {
                    const p = extrairPlacar(linha[col] as string)
                    const isGreen = p !== null && temFiltro && passaFiltro(p, filtrosAtivos)
                    return (
                      <td key={col} style={{ padding: '1px 2px', border: `1px solid rgba(255,255,255,0.03)`, textAlign: 'center', height: '24px' }}>
                        {p ? (
                          <span style={{
                            display: 'inline-block', padding: '1px 3px', borderRadius: '2px',
                            fontWeight: 700, fontSize: '11px', fontFamily: 'monospace',
                            background: isGreen ? c.verde : c.vermelho,
                            color: '#fff', minWidth: '34px', textAlign: 'center',
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
