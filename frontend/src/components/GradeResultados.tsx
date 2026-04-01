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

  // Janela de linhas por tipo
  const janela = tipoIA === 1 ? 3 : tipoIA === 2 ? 5 : 8
  const linhasJanela = linhas.slice(0, janela)
  const todasLinhas = linhas.slice(0, Math.min(linhas.length, 48))

  colunas.forEach((col, colIdx) => {
    // Histórico completo para calcular % base
    const histCompleto: (PlacarInfo | null)[] = todasLinhas.map(l => extrairPlacar(l[col] as string))
    const validosCompleto = histCompleto.filter(Boolean) as PlacarInfo[]
    if (validosCompleto.length < 5) return

    // Histórico da janela (linhas recentes)
    const histJanela: (PlacarInfo | null)[] = linhasJanela.map(l => extrairPlacar(l[col] as string))
    const validosJanela = histJanela.filter(Boolean) as PlacarInfo[]

    const min = col.replace('tempo', '')
    const n = validosCompleto.length
    const nJ = validosJanela.length

    // % base (histórico completo)
    const pO25Base = Math.round(validosCompleto.filter(p => p.over25).length / n * 100)
    const pO15Base = Math.round(validosCompleto.filter(p => p.over15).length / n * 100)
    const pO35Base = Math.round(validosCompleto.filter(p => p.over35).length / n * 100)
    const pAmbasBase = Math.round(validosCompleto.filter(p => p.ambasSim).length / n * 100)
    const pCasaBase = Math.round(validosCompleto.filter(p => p.casaVence).length / n * 100)
    const pEmpBase = Math.round(validosCompleto.filter(p => p.empate).length / n * 100)
    const pForaBase = Math.round(validosCompleto.filter(p => p.foraVence).length / n * 100)
    const mediaGBase = Math.round(validosCompleto.reduce((s, p) => s + p.gols, 0) / n * 10) / 10

    // % da janela recente
    const pO25Jan = nJ > 0 ? Math.round(validosJanela.filter(p => p.over25).length / nJ * 100) : pO25Base
    const pAmbasJan = nJ > 0 ? Math.round(validosJanela.filter(p => p.ambasSim).length / nJ * 100) : pAmbasBase
    const mediaGJan = nJ > 0 ? Math.round(validosJanela.reduce((s, p) => s + p.gols, 0) / nJ * 10) / 10 : mediaGBase

    // Sequência atual na janela
    let seq = 0; let dir: boolean | null = null
    for (const p of histJanela) {
      if (!p) continue
      if (dir === null) { dir = p.over25; seq = 1 }
      else if (p.over25 === dir) seq++
      else break
    }

    // Variação: janela vs histórico (indica tendência)
    const varOver = pO25Jan - pO25Base // positivo = janela mais over que histórico
    const varAmbas = pAmbasJan - pAmbasBase
    const varGols = mediaGJan - mediaGBase

    // Ajuste baseado na variação e sequência
    let boost = 0

    // Se janela tem menos over que histórico → over está "devendo" → boost positivo
    if (varOver < -15) boost += 20
    else if (varOver < -8) boost += 12
    else if (varOver > 15) boost -= 15
    else if (varOver > 8) boost -= 8

    // Sequência de RED na janela → correção esperada
    if (seq >= janela && dir === false) boost += 15
    else if (seq >= Math.floor(janela * 0.7) && dir === false) boost += 10

    // Sequência de GREEN na janela → possível reversão
    if (seq >= janela && dir === true) boost -= 15
    else if (seq >= Math.floor(janela * 0.7) && dir === true) boost -= 10

    // Média de gols da janela
    if (varGols > 0.5) boost += 5
    if (varGols < -0.5) boost -= 5

    // Calcular probabilidade final
    const baseOver25 = Math.min(Math.max(pO25Base + boost, 10), 93)

    let mercadoNome = ''
    let probFinal = 0
    let confiancaFinal = 55

    if (temFiltro) {
      const greensBase = validosCompleto.filter(p => passaFiltro(p, filtroAtivo)).length
      const greensJan = validosJanela.filter(p => passaFiltro(p, filtroAtivo)).length
      const pctBase = Math.round(greensBase / n * 100)
      const pctJan = nJ > 0 ? Math.round(greensJan / nJ * 100) : pctBase
      const varFiltro = pctJan - pctBase

      const partes = []
      if (filtroAtivo.over) partes.push(`OVER ${filtroAtivo.over}`)
      if (filtroAtivo.under) partes.push(`UNDER ${filtroAtivo.under}`)
      if (filtroAtivo.ambas === 'sim') partes.push('AMBAS SIM')
      if (filtroAtivo.ambas === 'nao') partes.push('AMBAS NÃO')
      if (filtroAtivo.resultado) partes.push(filtroAtivo.resultado.toUpperCase())
      mercadoNome = partes.join(' + ')

      // Se janela tem menos green que histórico → mercado está "devendo"
      probFinal = Math.min(Math.max(pctBase + (varFiltro < -10 ? 20 : varFiltro < 0 ? 10 : varFiltro > 10 ? -10 : 0), 10), 93)
      confiancaFinal = Math.abs(varFiltro) > 15 ? 88 : Math.abs(varFiltro) > 8 ? 78 : Math.abs(probFinal - 50) > 20 ? 70 : 55
    } else {
      const opcoes = [
        { nome: 'OVER 1.5', prob: Math.min(pO15Base, 95) },
        { nome: 'OVER 2.5', prob: baseOver25 },
        { nome: 'UNDER 2.5', prob: Math.min(100 - baseOver25, 93) },
        { nome: 'OVER 3.5', prob: Math.min(pO35Base + (mediaGJan > 3 ? 8 : 0), 88) },
        { nome: 'AMBAS SIM', prob: Math.min(pAmbasBase + (varAmbas < -10 ? 15 : 0), 92) },
        { nome: 'CASA', prob: pCasaBase },
        { nome: 'EMPATE', prob: pEmpBase },
        { nome: 'FORA', prob: pForaBase },
      ].sort((a, b) => b.prob - a.prob)

      mercadoNome = opcoes[0].nome
      probFinal = Math.round(opcoes[0].prob)
      confiancaFinal = Math.abs(boost) > 15 ? 88 : Math.abs(boost) > 8 ? 78 : Math.abs(probFinal - 50) > 20 ? 70 : 55
    }

    const motivo = `Jan:${janela}L | Seq:${seq}${dir === false ? 'R' : 'G'} | Var:${varOver > 0 ? '+' : ''}${varOver}% | ${mediaGJan}g`

    resultado.push({
      minuto: min, mercado: mercadoNome,
      probabilidade: Math.round(probFinal), confianca: confiancaFinal,
      motivo,
    })
  })

  return resultado
}

export default function GradeResultados({ linhas, colunas, horas, liga, ligas, onTrocarLiga }: Props) {
  const [filtros, setFiltros] = useState({ ...FILTRO_VAZIO })
  const [filtrosAtivos, setFiltrosAtivos] = useState({ ...FILTRO_VAZIO })
  const [tipoIA, setTipoIA] = useState<1 | 2 | 3>(1)
  const [mostrarIA, setMostrarIA] = useState(true)

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

  // Melhores times para apostar (vitória casa, vitória fora, gols)
  const melhoresParaApostar = useMemo(() => {
    const times: Record<string, {
      nome: string; jogos: number; vitoriasCasa: number; jogosCasa: number
      vitoriasFor: number; jogosFora: number; gols: number
    }> = {}

    linhas20.forEach(linha => {
      cols.forEach(col => {
        const val = linha[col] as string
        if (!val) return
        const partes = val.split('</br>')[0].trim()
        const m = partes.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/)
        if (!m) return
        const [, timeA, golsA, golsB, timeB] = m
        const gA = parseInt(golsA), gB = parseInt(golsB)

        if (!times[timeA]) times[timeA] = { nome: timeA, jogos: 0, vitoriasCasa: 0, jogosCasa: 0, vitoriasFor: 0, jogosFora: 0, gols: 0 }
        if (!times[timeB]) times[timeB] = { nome: timeB, jogos: 0, vitoriasCasa: 0, jogosCasa: 0, vitoriasFor: 0, jogosFora: 0, gols: 0 }

        // Time A joga em casa
        times[timeA].jogosCasa++
        times[timeA].gols += gA
        if (gA > gB) times[timeA].vitoriasCasa++

        // Time B joga fora
        times[timeB].jogosFora++
        times[timeB].gols += gB
        if (gB > gA) times[timeB].vitoriasFor++

        times[timeA].jogos++
        times[timeB].jogos++
      })
    })

    const arr = Object.values(times).filter(t => t.jogos >= 3)

    return {
      melhorCasa: arr.filter(t => t.jogosCasa >= 2)
        .sort((a, b) => (b.vitoriasCasa / b.jogosCasa) - (a.vitoriasCasa / a.jogosCasa))
        .slice(0, 5),
      melhorFora: arr.filter(t => t.jogosFora >= 2)
        .sort((a, b) => (b.vitoriasFor / b.jogosFora) - (a.vitoriasFor / a.jogosFora))
        .slice(0, 5),
      maisGols: arr
        .sort((a, b) => (b.gols / b.jogos) - (a.gols / a.jogos))
        .slice(0, 5),
    }
  }, [linhas, colunas])
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

  // Ranking dos melhores times (últimas 20 linhas)
  const rankingTimes = useMemo(() => {
    const times: Record<string, { nome: string; vitorias: number; gols: number; jogos: number; golsSofridos: number }> = {}
    linhas20.forEach(linha => {
      cols.forEach(col => {
        const val = linha[col] as string
        if (!val) return
        const partes = val.split('</br>')[0].trim()
        // Formato: "Time A 2 - 1 Time B"
        const m = partes.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/)
        if (!m) return
        const [, timeA, golsA, golsB, timeB] = m
        const gA = parseInt(golsA), gB = parseInt(golsB)
        if (!times[timeA]) times[timeA] = { nome: timeA, vitorias: 0, gols: 0, jogos: 0, golsSofridos: 0 }
        if (!times[timeB]) times[timeB] = { nome: timeB, vitorias: 0, gols: 0, jogos: 0, golsSofridos: 0 }
        times[timeA].jogos++; times[timeA].gols += gA; times[timeA].golsSofridos += gB
        times[timeB].jogos++; times[timeB].gols += gB; times[timeB].golsSofridos += gA
        if (gA > gB) times[timeA].vitorias++
        else if (gB > gA) times[timeB].vitorias++
      })
    })
    return Object.values(times)
      .filter(t => t.jogos >= 3)
      .sort((a, b) => b.vitorias - a.vitorias || b.gols - a.gols)
      .slice(0, 8)
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

      {/* STATS */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { lbl: 'MEDIA GREENS', val: `${stats20.pct}%`, cor: '#1a7a3a' },
            { lbl: 'MÉDIA GOLS', val: String(stats20.mediaGols), cor: '#b8600c' },
            { lbl: 'PARTIDAS', val: String(stats20.total), cor: '#111111' },
          ].map(s => (
            <div key={s.lbl} style={{ background: '#1565c0', border: `1px solid #1040a0`, borderRadius: '6px', padding: '8px 14px' }}>
              <div style={{ fontSize: '10px', color: '#aaccff', letterSpacing: '2px' }}>{s.lbl}</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', fontFamily: 'monospace' }}>{s.val}</div>
            </div>
          ))}

          {/* LIGAS */}
          {ligas && ligas.map(l => (
            <button
              key={l}
              onClick={() => onTrocarLiga && onTrocarLiga(l)}
              style={{
                padding: '8px 16px',
                background: liga === l ? '#1a7a3a' : '#f0f0f0',
                border: `1px solid ${liga === l ? '#1a7a3a' : '#cccccc'}`,
                borderRadius: '6px',
                color: liga === l ? '#fff' : '#444',
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '1px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {l.toUpperCase()}
            </button>
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

      {/* FILTROS + RANKING + CONFRONTOS */}
      <div style={{ background: '#ffd600', border: `1px solid #e6c000`, borderRadius: '8px', padding: '12px 16px' }}>
        <div style={{ fontSize: '10px', color: '#333', letterSpacing: '2px', marginBottom: '10px', fontWeight: 700 }}>FILTROS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#111', fontWeight: 700 }}>OVER</span>
            <select style={{ background: '#fff', border: `1px solid #ccc`, color: '#111', padding: '6px 10px', fontSize: '13px', borderRadius: '4px', outline: 'none' }} value={filtros.over} onChange={e => setFiltros(p => ({ ...p, over: e.target.value }))}>
              <option value="">—</option>
              {['0.5','1.5','2.5','3.5'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#111', fontWeight: 700 }}>UNDER</span>
            <select style={{ background: '#fff', border: `1px solid #ccc`, color: '#111', padding: '6px 10px', fontSize: '13px', borderRadius: '4px', outline: 'none' }} value={filtros.under} onChange={e => setFiltros(p => ({ ...p, under: e.target.value }))}>
              <option value="">—</option>
              {['1.5','2.5','3.5'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#111', fontWeight: 700 }}>AMBAS</span>
            <select style={{ background: '#fff', border: `1px solid #ccc`, color: '#111', padding: '6px 10px', fontSize: '13px', borderRadius: '4px', outline: 'none' }} value={filtros.ambas} onChange={e => setFiltros(p => ({ ...p, ambas: e.target.value }))}>
              <option value="">—</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#111', fontWeight: 700 }}>RESULTADO</span>
            <select style={{ background: '#fff', border: `1px solid #ccc`, color: '#111', padding: '6px 10px', fontSize: '13px', borderRadius: '4px', outline: 'none' }} value={filtros.resultado} onChange={e => setFiltros(p => ({ ...p, resultado: e.target.value }))}>
              <option value="">—</option>
              <option value="casa">Casa</option>
              <option value="empate">Empate</option>
              <option value="fora">Fora</option>
            </select>
          </div>
          <button onClick={aplicar} style={{ background: '#1a7a3a', color: '#fff', border: 'none', padding: '7px 18px', fontWeight: 700, fontSize: '13px', borderRadius: '4px', cursor: 'pointer' }}>FILTRAR</button>
          <button onClick={limpar} style={{ background: '#fff', color: '#333', border: `1px solid #ccc`, padding: '7px 14px', fontSize: '13px', borderRadius: '4px', cursor: 'pointer' }}>LIMPAR</button>
        </div>

        {/* RANKING + CONFRONTOS lado a lado */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>

          {/* RANKING */}
          {rankingTimes.length > 0 && (
            <div style={{ flex: '1', minWidth: '280px', background: '#fff', border: `1px solid #ccc`, borderRadius: '6px', padding: '10px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#1565c0', letterSpacing: '2px', marginBottom: '8px' }}>RANKING — ÚLTIMAS 20H</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#1565c0', color: '#fff' }}>
                    {['#','TIME','J','V','GM','GS','%V'].map(h => (
                      <th key={h} style={{ padding: '3px 6px', textAlign: h === 'TIME' ? 'left' : 'center', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rankingTimes.map((t, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#f8f8f8' : '#fff', borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '3px 6px', fontWeight: 700, color: i < 3 ? '#1565c0' : '#333', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ padding: '3px 6px', fontWeight: 600, color: '#111' }}>{t.nome}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center', color: '#333' }}>{t.jogos}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 700, color: '#1a7a3a' }}>{t.vitorias}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center', color: '#1a7a3a', fontWeight: 700 }}>{t.gols}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center', color: '#c0392b' }}>{t.golsSofridos}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 700, color: '#1565c0' }}>{Math.round(t.vitorias / t.jogos * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CONFRONTOS FUTUROS */}
          {linhas.length > 0 && (() => {
            const proxima = linhas[0]
            const confrontos: { minuto: string; times: string }[] = []
            cols.forEach(col => {
              const val = proxima[col] as string
              if (!val) return
              const linha = val.split('</br>')[0].trim()
              const m = linha.match(/^(.+?)\s+\d+\s*-\s*\d+\s+(.+)$/)
              if (m) confrontos.push({ minuto: col.replace('tempo', ''), times: `${m[1]} vs ${m[2]}` })
            })
            if (confrontos.length === 0) return null
            return (
              <div style={{ flex: '1', minWidth: '220px', background: '#fff', border: `1px solid #ccc`, borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#1565c0', letterSpacing: '2px', marginBottom: '8px' }}>CONFRONTOS FUTUROS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {confrontos.map((cf, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', borderBottom: '1px solid #eee' }}>
                      <span style={{ color: '#1565c0', fontWeight: 700, fontSize: '11px', minWidth: '30px' }}>{cf.minuto}</span>
                      <span style={{ color: '#111', fontSize: '11px' }}>{cf.times}</span>
                      <span style={{ color: '#1a7a3a', fontSize: '10px', marginLeft: 'auto', fontWeight: 700 }}>→ {proximaHora(cf.minuto)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* MELHOR VITÓRIA CASA */}
          {melhoresParaApostar.melhorCasa.length > 0 && (
            <div style={{ flex: '1', minWidth: '180px', background: '#fff', border: `1px solid #ccc`, borderRadius: '6px', padding: '10px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#1a7a3a', letterSpacing: '2px', marginBottom: '8px' }}>🏠 VITÓRIA CASA</div>
              {melhoresParaApostar.melhorCasa.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #eee', fontSize: '11px' }}>
                  <span style={{ color: '#111', fontWeight: i === 0 ? 700 : 400 }}>{t.nome}</span>
                  <span style={{ color: '#1a7a3a', fontWeight: 700 }}>{Math.round(t.vitoriasCasa / t.jogosCasa * 100)}%</span>
                </div>
              ))}
            </div>
          )}

          {/* MELHOR VITÓRIA FORA */}
          {melhoresParaApostar.melhorFora.length > 0 && (
            <div style={{ flex: '1', minWidth: '180px', background: '#fff', border: `1px solid #ccc`, borderRadius: '6px', padding: '10px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#c0392b', letterSpacing: '2px', marginBottom: '8px' }}>✈️ VITÓRIA FORA</div>
              {melhoresParaApostar.melhorFora.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #eee', fontSize: '11px' }}>
                  <span style={{ color: '#111', fontWeight: i === 0 ? 700 : 400 }}>{t.nome}</span>
                  <span style={{ color: '#c0392b', fontWeight: 700 }}>{Math.round(t.vitoriasFor / t.jogosFora * 100)}%</span>
                </div>
              ))}
            </div>
          )}

          {/* MAIS GOLS */}
          {melhoresParaApostar.maisGols.length > 0 && (
            <div style={{ flex: '1', minWidth: '180px', background: '#fff', border: `1px solid #ccc`, borderRadius: '6px', padding: '10px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#1565c0', letterSpacing: '2px', marginBottom: '8px' }}>⚽ MAIS GOLS</div>
              {melhoresParaApostar.maisGols.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #eee', fontSize: '11px' }}>
                  <span style={{ color: '#111', fontWeight: i === 0 ? 700 : 400 }}>{t.nome}</span>
                  <span style={{ color: '#1565c0', fontWeight: 700 }}>{(t.gols / t.jogos).toFixed(1)}g/j</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
