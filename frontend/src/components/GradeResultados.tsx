import { useState, useMemo } from 'react'
import { Partida } from '../pages/Dashboard'

interface Props {
  linhas: Partida[]
  colunas: string[]
  horas?: string[]
  liga?: string
  ligas?: string[]
  onTrocarLiga?: (liga: string) => void
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
  const resultado: Tendencia[] = []
  const temFiltro = Object.values(filtroAtivo).some(v => v !== '')

  // Linhas a comparar por tipo:
  // Tipo 1: linha atual (0) vs anterior (1) — 2 linhas
  // Tipo 2: atual (0) + última (1) + penúltima (2) — 3 linhas
  // Tipo 3: atual (0) + última (1) + penúltima (2) + antepenúltima (3) — 4 linhas
  const qtdLinhas = tipoIA === 1 ? 2 : tipoIA === 2 ? 3 : 4
  const linhasComparacao = linhas.slice(0, qtdLinhas)
  const linhasHistorico = linhas.slice(0, Math.min(linhas.length, 48))

  colunas.forEach(col => {
    // Histórico completo — base estatística
    const histCompleto = linhasHistorico.map(l => extrairPlacar(l[col] as string))
    const validosCompleto = histCompleto.filter(Boolean) as PlacarInfo[]
    if (validosCompleto.length < 5) return

    const min = col.replace('tempo', '')
    const n = validosCompleto.length

    // % base histórica
    const pO25Base = Math.round(validosCompleto.filter(p => p.over25).length / n * 100)
    const pO15Base = Math.round(validosCompleto.filter(p => p.over15).length / n * 100)
    const pO35Base = Math.round(validosCompleto.filter(p => p.over35).length / n * 100)
    const pAmbasBase = Math.round(validosCompleto.filter(p => p.ambasSim).length / n * 100)
    const pCasaBase = Math.round(validosCompleto.filter(p => p.casaVence).length / n * 100)
    const pEmpBase = Math.round(validosCompleto.filter(p => p.empate).length / n * 100)
    const pForaBase = Math.round(validosCompleto.filter(p => p.foraVence).length / n * 100)
    const mediaGBase = Math.round(validosCompleto.reduce((s, p) => s + p.gols, 0) / n * 10) / 10

    // Placares das linhas de comparação (0 = atual, 1 = anterior, etc.)
    const placares = linhasComparacao.map(l => extrairPlacar(l[col] as string))
    const atual = placares[0]
    if (!atual) return

    // === NOVA LÓGICA: análise de padrão entre linhas ===

    let boost = 0
    let padraoDesc = ''

    if (tipoIA === 1) {
      // Tipo 1: atual vs anterior
      const ant = placares[1]
      if (ant) {
        const seguindo = atual.over25 === ant.over25
        const varGols = atual.gols - ant.gols

        if (seguindo) {
          // Mesma direção — possível reversão na próxima
          boost = atual.over25 ? -12 : 12
          padraoDesc = `2L iguais(${atual.over25 ? 'GG' : 'RR'})→reversão`
        } else {
          // Direções opostas — alternando, seguir o atual
          boost = atual.over25 ? 8 : -8
          padraoDesc = `Alternando→${atual.over25 ? 'G' : 'R'}`
        }
        if (varGols > 1) boost += 5
        if (varGols < -1) boost -= 5
      }

    } else if (tipoIA === 2) {
      // Tipo 2: atual + última + penúltima (3 linhas)
      const ant1 = placares[1]
      const ant2 = placares[2]
      if (ant1 && ant2) {
        const resultados = [ant2.over25, ant1.over25, atual.over25]
        const todosIguais = resultados.every(r => r === resultados[0])
        const ultimosDoisIguais = ant1.over25 === atual.over25
        const tendenciaSubindo = !ant2.over25 && !ant1.over25 && !atual.over25 // 3 RED
        const tendenciaOver = ant2.over25 && ant1.over25 && atual.over25 // 3 GREEN

        if (tendenciaOver) {
          boost = -18 // 3 greens seguidos → reversão esperada
          padraoDesc = '3xGREEN→reversão'
        } else if (tendenciaSubindo) {
          boost = 20 // 3 reds seguidos → correção forte
          padraoDesc = '3xRED→correção forte'
        } else if (todosIguais) {
          boost = atual.over25 ? -12 : 14
          padraoDesc = `Padrão uniforme→reversão`
        } else if (ultimosDoisIguais) {
          boost = atual.over25 ? -8 : 10
          padraoDesc = `2 iguais recentes→reversão`
        } else {
          // Alternando — sem padrão claro
          boost = 0
          padraoDesc = 'Sem padrão claro'
        }
      }

    } else {
      // Tipo 3: atual + 3 anteriores (4 linhas)
      const ant1 = placares[1]
      const ant2 = placares[2]
      const ant3 = placares[3]
      if (ant1 && ant2 && ant3) {
        const resultados = [ant3.over25, ant2.over25, ant1.over25, atual.over25]
        const redsConsec = resultados.filter(r => r === false).length
        const greensConsec = resultados.filter(r => r === true).length
        const mediaGolsRecente = [ant3, ant2, ant1, atual].reduce((s, p) => s + p.gols, 0) / 4

        // Contar sequência atual
        let seqAtual = 1
        for (let i = 1; i < resultados.length; i++) {
          if (resultados[resultados.length - 1 - i] === atual.over25) seqAtual++
          else break
        }

        if (redsConsec === 4) {
          boost = 25 // 4 reds = correção muito provável
          padraoDesc = '4xRED→correção muito provável'
        } else if (greensConsec === 4) {
          boost = -20
          padraoDesc = '4xGREEN→reversão muito provável'
        } else if (redsConsec === 3) {
          boost = 18
          padraoDesc = '3/4 RED→correção provável'
        } else if (greensConsec === 3) {
          boost = -15
          padraoDesc = '3/4 GREEN→reversão provável'
        } else {
          boost = atual.over25 ? -5 : 5
          padraoDesc = `Misto(${redsConsec}R/${greensConsec}G)`
        }

        // Ajuste por média de gols recente
        if (mediaGolsRecente > mediaGBase + 0.5) boost -= 5
        if (mediaGolsRecente < mediaGBase - 0.5) boost += 5
      }
    }

    const baseOver25 = Math.min(Math.max(pO25Base + boost, 10), 93)

    let mercadoNome = ''
    let probFinal = 0
    let confiancaFinal = 55

    if (temFiltro) {
      const greensBase = validosCompleto.filter(p => passaFiltro(p, filtroAtivo)).length
      const pctBase = Math.round(greensBase / n * 100)
      const partes = []
      if (filtroAtivo.over) partes.push(`OVER ${filtroAtivo.over}`)
      if (filtroAtivo.under) partes.push(`UNDER ${filtroAtivo.under}`)
      if (filtroAtivo.ambas === 'sim') partes.push('AMBAS SIM')
      if (filtroAtivo.ambas === 'nao') partes.push('AMBAS NÃO')
      if (filtroAtivo.resultado) partes.push(filtroAtivo.resultado.toUpperCase())
      mercadoNome = partes.join(' + ')
      probFinal = Math.min(Math.max(pctBase + boost, 10), 93)
      confiancaFinal = Math.abs(boost) > 18 ? 90 : Math.abs(boost) > 10 ? 80 : Math.abs(probFinal - 50) > 20 ? 70 : 55
    } else {
      const opcoes = [
        { nome: 'OVER 1.5', prob: Math.min(pO15Base, 95) },
        { nome: 'OVER 2.5', prob: baseOver25 },
        { nome: 'UNDER 2.5', prob: Math.min(100 - baseOver25, 93) },
        { nome: 'OVER 3.5', prob: Math.min(pO35Base + (atual.gols > 3 ? 8 : 0), 88) },
        { nome: 'AMBAS SIM', prob: Math.min(pAmbasBase + (boost > 10 ? 10 : 0), 92) },
        { nome: 'CASA', prob: pCasaBase },
        { nome: 'EMPATE', prob: pEmpBase },
        { nome: 'FORA', prob: pForaBase },
      ].sort((a, b) => b.prob - a.prob)
      mercadoNome = opcoes[0].nome
      probFinal = Math.round(opcoes[0].prob)
      confiancaFinal = Math.abs(boost) > 18 ? 90 : Math.abs(boost) > 10 ? 80 : Math.abs(probFinal - 50) > 20 ? 70 : 55
    }

    resultado.push({
      minuto: min, mercado: mercadoNome,
      probabilidade: Math.round(probFinal), confianca: confiancaFinal,
      motivo: padraoDesc,
    })
  })

  return resultado
}

export default function GradeResultados({ linhas, colunas, horas, liga, ligas, onTrocarLiga }: Props) {
  const [filtros, setFiltros] = useState({ ...FILTRO_VAZIO })
  const [filtrosAtivos, setFiltrosAtivos] = useState({ ...FILTRO_VAZIO })
  const [tipoIA, setTipoIA] = useState<1 | 2 | 3>(1)
  const [mostrarIA, setMostrarIA] = useState(true)
  const [painelAtivo, setPainelAtivo] = useState<'casa' | 'fora' | 'gols'>('casa')

  const temFiltro = Object.values(filtrosAtivos).some(v => v !== '')
  const cols = colunas.length > 0 ? colunas : ['tempo01','tempo04','tempo07','tempo10','tempo13','tempo16','tempo19','tempo22','tempo25','tempo28','tempo31','tempo34','tempo37','tempo40','tempo43','tempo46','tempo49','tempo52','tempo55','tempo58']

  // Stats pelas últimas 20 linhas
  const linhas20 = linhas.slice(0, 20)

  const linhaStats = useMemo(() => linhas.map((linha, idx) => {
    let total = 0, greens = 0, totalGols = 0
    cols.forEach(col => {
      const p = extrairPlacar(linha[col] as string)
      if (p) { total++; totalGols += p.gols; if (p.over25) greens++ }
    })
    return { idx, total, greens, pct: total > 0 ? Math.round(greens / total * 100) : 0, totalGols }
  }), [linhas, colunas])

  // Stats por coluna (últimas 20 linhas)
  const colStats = useMemo(() => cols.map(col => {
    let total = 0, greens = 0
    linhas20.forEach(linha => {
      const p = extrairPlacar(linha[col] as string)
      if (p) { total++; if (!temFiltro || passaFiltro(p, filtrosAtivos)) if (p.over25) greens++ }
    })
    return { col, total, greens, pct: total > 0 ? Math.round(greens / total * 100) : 0 }
  }), [linhas, colunas, filtrosAtivos])

  // Melhores minutos para apostar — baseado em % histórica por coluna (últimas 20 linhas)
  const melhoresParaApostar = useMemo(() => {
    const porMinuto = cols.map(col => {
      let total = 0, over25 = 0, casa = 0, fora = 0, gols = 0
      linhas20.forEach(linha => {
        const p = extrairPlacar(linha[col] as string)
        if (!p) return
        total++; gols += p.gols
        if (p.over25) over25++
        if (p.casaVence) casa++
        if (p.foraVence) fora++
      })
      if (total === 0) return null
      return {
        min: col.replace('tempo', ''),
        total,
        pctOver: Math.round(over25 / total * 100),
        pctCasa: Math.round(casa / total * 100),
        pctFora: Math.round(fora / total * 100),
        mediaGols: Math.round(gols / total * 10) / 10,
      }
    }).filter(Boolean) as { min: string; total: number; pctOver: number; pctCasa: number; pctFora: number; mediaGols: number }[]

    return {
      melhorCasa: [...porMinuto].sort((a, b) => b.pctCasa - a.pctCasa).slice(0, 5),
      melhorFora: [...porMinuto].sort((a, b) => b.pctFora - a.pctFora).slice(0, 5),
      maisGols: [...porMinuto].sort((a, b) => b.mediaGols - a.mediaGols).slice(0, 5),
    }
  }, [linhas, colunas])

  // IA Tendência
  const tendencias = useMemo(() => {
    if (!mostrarIA || linhas.length < 5) return []
    return calcularIA(linhas, cols, tipoIA, filtrosAtivos)
  }, [linhas, colunas, tipoIA, mostrarIA, filtrosAtivos])

  // Stats globais (últimas 20 linhas)
  const stats20 = useMemo(() => {
    let total = 0, greens = 0, totalGols = 0
    linhas20.forEach(linha => {
      cols.forEach(col => {
        const p = extrairPlacar(linha[col] as string)
        if (p) { total++; totalGols += p.gols; if (p.over25) greens++ }
      })
    })
    return {
      total,
      pct: total > 0 ? Math.round(greens / total * 100) : 0,
      mediaGols: total > 0 ? Math.round(totalGols / total * 10) / 10 : 0,
    }
  }, [linhas, colunas])

  function aplicar() { setFiltrosAtivos({ ...filtros }) }
  function limpar() { setFiltros({ ...FILTRO_VAZIO }); setFiltrosAtivos({ ...FILTRO_VAZIO }) }

  const c = {
    bg2: '#ffffff', bg3: '#f0f0f0', bg4: '#e0e0e0', borda: '#cccccc',
    verde: '#1a7a3a', vermelho: '#c0392b',
    verdeClaro: '#1a7a3a', vermelhoClaro: '#c0392b',
    texto: '#111111', texto2: '#333333', amarelo: '#b8600c', azul: '#1565c0',
  }

  const sel: any = { background: c.bg3, border: `1px solid ${c.borda}`, color: c.texto, padding: '6px 10px', fontSize: '13px', borderRadius: '4px', outline: 'none', cursor: 'pointer' }

  // Hora atual da Bet365 (vem da API no campo horas[0])
  const horaAtualBet = horas && horas.length > 0 ? parseInt(String(horas[0])) : new Date().getHours()
  const minAtual = new Date().getMinutes()

  function proximaHora(minuto: string): string {
    const minNum = parseInt(minuto)
    const h = minNum > minAtual ? horaAtualBet : (horaAtualBet + 1) % 24
    return `${String(h).padStart(2, '0')}:${String(minNum).padStart(2, '0')}`
  }

  function horaLinha(idx: number): string {
    if (horas && horas.length > idx) return String(horas[idx]).padStart(2, '0')
    return String((horaAtualBet - idx + 24) % 24).padStart(2, '0')
  }

  // Melhores entradas
  const melhores = tendencias
    .filter(t => t.probabilidade >= 60 && t.confianca >= 65)
    .sort((a, b) => (b.probabilidade + b.confianca) - (a.probabilidade + a.confianca))
    .slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* STATS + LIGAS */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        {/* Cards pequenos */}
        {[
          { lbl: 'GREENS', val: `${stats20.pct}%` },
          { lbl: 'GOLS', val: String(stats20.mediaGols) },
          { lbl: 'PARTIDAS', val: String(stats20.total) },
        ].map(s => (
          <div key={s.lbl} style={{ background: '#1565c0', border: `1px solid #1040a0`, borderRadius: '6px', padding: '5px 10px' }}>
            <div style={{ fontSize: '9px', color: '#aaccff', letterSpacing: '1px' }}>{s.lbl}</div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>{s.val}</div>
          </div>
        ))}

        {/* LIGAS */}
        {ligas && ligas.map(l => (
          <button key={l} onClick={() => onTrocarLiga && onTrocarLiga(l)} style={{
            padding: '5px 12px', border: 'none', borderRadius: '6px',
            background: liga === l ? '#1a7a3a' : '#1565c0',
            color: '#fff', fontWeight: 700, fontSize: '11px',
            letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.2s',
          }}>
            {l.toUpperCase()}
          </button>
        ))}

        {/* IA BOTÕES */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
          <button onClick={() => setMostrarIA(!mostrarIA)} style={{ padding: '5px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '11px', background: mostrarIA ? '#1a7a3a' : '#1565c0', color: '#fff' }}>
            IA {mostrarIA ? 'ON' : 'OFF'}
          </button>
          {mostrarIA && ([1,2,3] as const).map(t => (
            <button key={t} onClick={() => setTipoIA(t)} style={{ padding: '5px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '11px', background: tipoIA === t ? '#1a7a3a' : '#1565c0', color: '#fff' }}>
              TIPO {t}
            </button>
          ))}
        </div>
      </div>

      {/* PAINÉIS AZUIS — MELHORES TIMES */}
      <div style={{ background: '#1565c0', border: `1px solid #1040a0`, borderRadius: '8px', padding: '10px 14px' }}>
        {/* Botões seletor */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          {([
            { key: 'casa', lbl: '🏠 VITÓRIA CASA' },
            { key: 'fora', lbl: '✈️ VITÓRIA FORA' },
            { key: 'gols', lbl: '⚽ MAIS GOLS' },
          ] as const).map(b => (
            <button key={b.key} onClick={() => setPainelAtivo(b.key)} style={{
              padding: '5px 14px', border: 'none', borderRadius: '4px',
              cursor: 'pointer', fontWeight: 700, fontSize: '11px',
              background: painelAtivo === b.key ? '#1a7a3a' : '#2979ff',
              color: '#fff', transition: 'all 0.2s',
            }}>
              {b.lbl}
            </button>
          ))}
        </div>

        {/* Conteúdo do painel ativo */}
        <div style={{ background: '#fff', borderRadius: '6px', padding: '10px 12px' }}>
          {painelAtivo === 'casa' && (
            <>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#1a7a3a', letterSpacing: '2px', marginBottom: '8px' }}>🏠 MELHORES MINUTOS — VITÓRIA CASA (últ. 20h)</div>
              {melhoresParaApostar.melhorCasa.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #eee', fontSize: '12px' }}>
                  <span style={{ color: i < 3 ? '#1565c0' : '#111', fontWeight: i === 0 ? 700 : 500 }}>MIN {t.min}</span>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ color: '#666', fontSize: '11px' }}>{t.total}j</span>
                    <span style={{ color: '#1a7a3a', fontWeight: 700 }}>{t.pctCasa}% casa vence</span>
                  </div>
                </div>
              ))}
            </>
          )}
          {painelAtivo === 'fora' && (
            <>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#c0392b', letterSpacing: '2px', marginBottom: '8px' }}>✈️ MELHORES MINUTOS — VITÓRIA FORA (últ. 20h)</div>
              {melhoresParaApostar.melhorFora.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #eee', fontSize: '12px' }}>
                  <span style={{ color: i < 3 ? '#1565c0' : '#111', fontWeight: i === 0 ? 700 : 500 }}>MIN {t.min}</span>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ color: '#666', fontSize: '11px' }}>{t.total}j</span>
                    <span style={{ color: '#c0392b', fontWeight: 700 }}>{t.pctFora}% fora vence</span>
                  </div>
                </div>
              ))}
            </>
          )}
          {painelAtivo === 'gols' && (
            <>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#1565c0', letterSpacing: '2px', marginBottom: '8px' }}>⚽ MINUTOS COM MAIS GOLS (últ. 20h)</div>
              {melhoresParaApostar.maisGols.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #eee', fontSize: '12px' }}>
                  <span style={{ color: i < 3 ? '#1565c0' : '#111', fontWeight: i === 0 ? 700 : 500 }}>MIN {t.min}</span>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ color: '#666', fontSize: '11px' }}>{t.total}j</span>
                    <span style={{ color: '#1565c0', fontWeight: 700 }}>{t.mediaGols} gols/jogo | {t.pctOver}% over2.5</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ background: '#ffd600', border: `1px solid #e6c000`, borderRadius: '8px', padding: '12px 16px' }}>
        <div style={{ fontSize: '10px', color: '#333', letterSpacing: '2px', marginBottom: '10px', fontWeight: 700 }}>FILTROS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#111', fontWeight: 700, minWidth: '50px' }}>OVER</span>
            <select style={{ flex: 1, background: '#fff', border: `1px solid #ccc`, color: '#111', padding: '8px', fontSize: '13px', borderRadius: '4px', outline: 'none' }} value={filtros.over} onChange={e => setFiltros(p => ({ ...p, over: e.target.value }))}>
              <option value="">—</option>
              {['0.5','1.5','2.5','3.5'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#111', fontWeight: 700, minWidth: '50px' }}>UNDER</span>
            <select style={{ flex: 1, background: '#fff', border: `1px solid #ccc`, color: '#111', padding: '8px', fontSize: '13px', borderRadius: '4px', outline: 'none' }} value={filtros.under} onChange={e => setFiltros(p => ({ ...p, under: e.target.value }))}>
              <option value="">—</option>
              {['1.5','2.5','3.5'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#111', fontWeight: 700, minWidth: '50px' }}>AMBAS</span>
            <select style={{ flex: 1, background: '#fff', border: `1px solid #ccc`, color: '#111', padding: '8px', fontSize: '13px', borderRadius: '4px', outline: 'none' }} value={filtros.ambas} onChange={e => setFiltros(p => ({ ...p, ambas: e.target.value }))}>
              <option value="">—</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#111', fontWeight: 700, minWidth: '50px' }}>RESULT.</span>
            <select style={{ flex: 1, background: '#fff', border: `1px solid #ccc`, color: '#111', padding: '8px', fontSize: '13px', borderRadius: '4px', outline: 'none' }} value={filtros.resultado} onChange={e => setFiltros(p => ({ ...p, resultado: e.target.value }))}>
              <option value="">—</option>
              <option value="casa">Casa</option>
              <option value="empate">Empate</option>
              <option value="fora">Fora</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={aplicar} style={{ flex: 1, background: '#1a7a3a', color: '#fff', border: 'none', padding: '10px', fontWeight: 700, fontSize: '13px', borderRadius: '4px', cursor: 'pointer' }}>FILTRAR</button>
          <button onClick={limpar} style={{ flex: 1, background: '#fff', color: '#333', border: `1px solid #ccc`, padding: '10px', fontSize: '13px', borderRadius: '4px', cursor: 'pointer' }}>LIMPAR</button>
        </div>

      {/* MELHORES ENTRADAS */}
      {mostrarIA && melhores.length > 0 && (
        <div style={{ background: '#1a7a3a', border: `1px solid #1a7a3a`, borderRadius: '6px', padding: '6px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff', letterSpacing: '1px' }}>MELHORES ENTRADAS — PRÓXIMA PARTIDA</span>
            <span style={{ fontSize: '10px', color: '#ccffcc' }}>IA TIPO {tipoIA}</span>
            {liga && <span style={{ fontSize: '10px', background: '#ffffff33', color: '#fff', border: `1px solid #ffffff44`, borderRadius: '3px', padding: '1px 6px', fontWeight: 700 }}>{liga.toUpperCase()}</span>}
          </div>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
            {melhores.map((t, i) => (
              <div key={i} style={{ background: '#ffffff', border: `1px solid #cccccc`, borderRadius: '4px', padding: '4px 8px', flex: '1', minWidth: '90px' }}>
                <div style={{ fontSize: '9px', color: '#333333' }}>MIN {t.minuto} <span style={{ color: '#1565c0', fontWeight: 700 }}>→ {proximaHora(t.minuto)}</span></div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#111111' }}>{t.mercado}</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#1565c0', fontFamily: 'monospace', lineHeight: 1.1 }}>{t.probabilidade}%</div>
                <div style={{ fontSize: '9px', color: '#1a7a3a', fontWeight: 700 }}>Conf: {t.confianca}%</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '9px', color: '#ccffcc', marginTop: '4px' }}>⚠️ Aposte apenas quando prob ≥ 65% E confiança ≥ 70%</div>
        </div>
      )}

      {/* GRADE */}
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '11px', width: '100%' }}>
          <thead>
            {/* % por coluna */}
            <tr>
              <th style={{ background: c.bg2, border: `1px solid ${c.borda}`, padding: '3px 5px', color: c.verdeClaro, fontSize: '10px', position: 'sticky', left: 0, zIndex: 3, minWidth: '24px' }}>H</th>
              {colStats.map(cs => (
                <th key={cs.col} style={{ background: c.bg2, border: `1px solid ${c.borda}`, padding: '2px 3px', textAlign: 'center', minWidth: '42px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: cs.pct >= 50 ? c.verdeClaro : c.vermelhoClaro }}>{cs.pct}%</div>
                  <div style={{ fontSize: '9px', color: c.texto2 }}>{cs.total}</div>
                </th>
              ))}
              <th style={{ background: c.bg2, border: `1px solid ${c.borda}`, padding: '2px 3px', color: c.texto2, fontSize: '9px', minWidth: '42px', textAlign: 'center' }}>% | G</th>
            </tr>

            {/* IA Tendência */}
            {mostrarIA && (
              <tr>
                <th style={{ background: '#1565c0', border: `1px solid #cccccc`, padding: '2px 4px', color: '#fff', fontSize: '9px', position: 'sticky', left: 0, zIndex: 3, height: '24px' }}>IA T{tipoIA}</th>
                {cols.map(col => {
                  const t = tendencias.find(t => t.minuto === col.replace('tempo', ''))
                  return (
                    <td key={col} title={t?.motivo} style={{ background: '#1565c0', border: `1px solid #cccccc`, padding: '1px 2px', textAlign: 'center', height: '24px' }}>
                      {t && temFiltro ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#fff', lineHeight: '1.2', background: '#1565c0', borderRadius: '2px', padding: '0 2px' }}>{t.probabilidade}%</span>
                          <span style={{ fontSize: '9px', color: '#fff', lineHeight: '1.2' }}>{t.confianca}%</span>
                        </div>
                      ) : t ? (
                        <span style={{ fontSize: '8px', color: '#fff', fontWeight: 600 }}>{t.mercado}</span>
                      ) : <span style={{ color: '#ffffff44' }}>—</span>}
                    </td>
                  )
                })}
                <td style={{ background: '#1565c0', border: `1px solid #cccccc`, height: '24px' }} />
              </tr>
            )}

            {/* Minutos */}
            <tr>
              <th style={{ background: c.bg3, border: `1px solid ${c.borda}`, padding: '3px 5px', color: c.texto2, fontSize: '9px', position: 'sticky', left: 0, zIndex: 3 }}>MIN</th>
              {cols.map(col => (
                <th key={col} style={{ background: c.bg3, border: `1px solid ${c.borda}`, padding: '3px 3px', color: c.texto2, fontSize: '9px', textAlign: 'center' }}>
                  {col.replace('tempo', '')}
                </th>
              ))}
              <th style={{ background: c.bg3, border: `1px solid ${c.borda}`, padding: '3px 3px', color: c.texto2, fontSize: '9px', textAlign: 'center', minWidth: '42px' }}>% | G</th>
            </tr>
          </thead>

          <tbody>
            {linhas.slice(0, 20).map((linha, idx) => {
              const ls = linhaStats[idx]
              return (
                <tr key={idx}>
                  <td style={{ background: '#f0f0f0', border: `1px solid #cccccc`, padding: '0 4px', color: '#1a7a3a', fontWeight: 700, fontSize: '11px', position: 'sticky', left: 0, textAlign: 'center', fontFamily: 'monospace', height: '20px' }}>
                    {horaLinha(idx)}
                  </td>
                  {cols.map(col => {
                    const p = extrairPlacar(linha[col] as string)
                    const isGreen = p !== null && temFiltro && passaFiltro(p, filtrosAtivos)
                    return (
                      <td key={col} style={{ padding: '0', border: `1px solid #cccccc`, textAlign: 'center', height: '20px' }}>
                        {p ? (
                          <span style={{
                            display: 'block', width: '100%', height: '100%',
                            lineHeight: '20px',
                            fontWeight: 700, fontSize: '11px', fontFamily: 'monospace',
                            background: isGreen ? '#1a7a3a' : '#c0392b',
                            color: '#fff', textAlign: 'center',
                          }}>
                            {p.texto}
                          </span>
                        ) : <span style={{ color: '#cccccc', fontSize: '9px' }}>—</span>}
                      </td>
                    )
                  })}
                  <td style={{ background: '#f0f0f0', border: `1px solid #cccccc`, padding: '0 4px', textAlign: 'center', height: '20px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: ls.pct >= 50 ? '#1a7a3a' : '#c0392b' }}>{ls.pct}%</span>
                    <span style={{ fontSize: '9px', color: '#333', marginLeft: '2px' }}>{ls.totalGols}g</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* LEGENDA */}
      {mostrarIA && (
        <div style={{ background: '#f0f0f0', border: `1px solid #cccccc`, borderRadius: '6px', padding: '8px 14px', fontSize: '11px', color: '#333' }}>
          <span style={{ color: '#1565c0', fontWeight: 700 }}>IA TIPO {tipoIA} </span>
          {tipoIA === 1 && '— Análise das últimas 3 linhas (60 partidas)'}
          {tipoIA === 2 && '— Análise das últimas 5 linhas (100 partidas)'}
          {tipoIA === 3 && '— Análise das últimas 8 linhas (160 partidas)'}
          {!temFiltro && <span style={{ marginLeft: '12px', color: '#b8600c' }}>← Selecione um filtro para ver probabilidade por minuto</span>}
        </div>
      )}
    </div>
  )
}
