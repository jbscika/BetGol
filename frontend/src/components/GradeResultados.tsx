import { useState, useMemo } from 'react'
import { Partida } from '../pages/Dashboard'

interface Props {
  linhas: Partida[]
  colunas: string[]
  horas?: string[]
  liga?: string
  ligas?: string[]
  onTrocarLiga?: (liga: string) => void
  dadosTodasLigas?: Record<string, Partida[]>
}

interface PlacarInfo {
  casa: number; fora: number; texto: string; gols: number
  over05: boolean; over15: boolean; over25: boolean; over35: boolean
  ambasSim: boolean; casaVence: boolean; empate: boolean; foraVence: boolean
}

interface Tendencia {
  minuto: string; mercado: string; probabilidade: number; confianca: number; motivo: string
}

const FILTRO_VAZIO = { over: '', under: '', ambas: '', resultado: '' }

function extrairPlacar(val: string | null): PlacarInfo | null {
  if (!val) return null
  const linha = val.split('</br>')[0].split('<br>')[0].trim()
  const m = linha.match(/(\d+)\s*-\s*(\d+)/)
  if (!m) return null
  const casa = parseInt(m[1]), fora = parseInt(m[2]), gols = casa + fora
  return {
    casa, fora, gols, texto: casa + '-' + fora,
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
  // Tipo 1: atual vs 1 anterior (2 linhas)
  // Tipo 2: atual + 2 anteriores (3 linhas)
  // Tipo 3: atual + 3 anteriores (4 linhas)
  const qtd = tipoIA === 1 ? 2 : tipoIA === 2 ? 3 : 4
  const linhasComp = linhas.slice(0, qtd)
  const linhasHist = linhas.slice(0, Math.min(linhas.length, 48))

  // Pre-calcular histMap para correlacao entre colunas
  const histMap: Record<string, (PlacarInfo | null)[]> = {}
  colunas.forEach(col => { histMap[col] = linhasHist.map(l => extrairPlacar(l[col] as string)) })

  colunas.forEach((col, colIdx) => {
    const histCompleto = histMap[col]
    const validos = histCompleto.filter(Boolean) as PlacarInfo[]
    if (validos.length < 5) return

    const min = col.replace('tempo', '')
    const n = validos.length

    // === METRICA 1: % historica base ===
    const pO25 = Math.round(validos.filter(p => p.over25).length / n * 100)
    const pO15 = Math.round(validos.filter(p => p.over15).length / n * 100)
    const pO35 = Math.round(validos.filter(p => p.over35).length / n * 100)
    const pAmbas = Math.round(validos.filter(p => p.ambasSim).length / n * 100)
    const pCasa = Math.round(validos.filter(p => p.casaVence).length / n * 100)
    const pEmp = Math.round(validos.filter(p => p.empate).length / n * 100)
    const pFora = Math.round(validos.filter(p => p.foraVence).length / n * 100)
    const mediaG = Math.round(validos.reduce((s, p) => s + p.gols, 0) / n * 10) / 10

    // === METRICA 2: Peso decrescente nas linhas recentes ===
    // Linha atual = peso 4, anterior = 3, penultima = 2, antepenultima = 1
    const pesoTotal = [4, 3, 2, 1].slice(0, Math.min(qtd, linhasComp.length)).reduce((a, b) => a + b, 0)
    let scoreOver25Ponderado = 0
    linhasComp.forEach((linha, i) => {
      const p = extrairPlacar(linha[col] as string)
      const peso = [4, 3, 2, 1][i] || 1
      if (p) scoreOver25Ponderado += (p.over25 ? 1 : 0) * peso
    })
    const pctPonderado = pesoTotal > 0 ? Math.round(scoreOver25Ponderado / pesoTotal * 100) : pO25

    // === METRICA 3: Deteccao de ciclo ===
    let mudancas = 0
    let prevState = histCompleto[0]?.over25
    for (let i = 1; i < Math.min(histCompleto.length, 24); i++) {
      const p = histCompleto[i]
      if (!p) continue
      if (p.over25 !== prevState) { mudancas++; prevState = p.over25 }
    }
    const cicloMedio = mudancas > 0 ? Math.round(24 / mudancas) : 0

    // Contar sequencia atual
    let seqAtual = 0
    let dirAtual: boolean | null = null
    for (const p of histCompleto) {
      if (!p) continue
      if (dirAtual === null) { dirAtual = p.over25; seqAtual = 1 }
      else if (p.over25 === dirAtual) seqAtual++
      else break
    }

    // === METRICA 4: Correlacao com coluna anterior ===
    let corrBoost = 0
    if (colIdx > 0) {
      const colAnt = colunas[colIdx - 1]
      const histAnt = histMap[colAnt]
      let concord = 0, tot = 0
      for (let i = 0; i < Math.min(histCompleto.length, histAnt.length, 24); i++) {
        const a = histAnt[i], b = histCompleto[i]
        if (!a || !b) continue
        tot++
        if (!a.over25 && b.over25) concord++
      }
      const pCorr = tot > 0 ? concord / tot : 0
      if (histAnt[0] && !histAnt[0].over25 && pCorr > 0.55) corrBoost = Math.round(pCorr * 15)
    }

    // === METRICA 5: Analise por faixa horaria ===
    // Dividir historico em 3 faixas: recente (0-8), medio (8-24), antigo (24-48)
    const faixaRecente = histCompleto.slice(0, 8).filter(Boolean) as PlacarInfo[]
    const faixaMedio = histCompleto.slice(8, 24).filter(Boolean) as PlacarInfo[]
    const pctRecente = faixaRecente.length > 0 ? Math.round(faixaRecente.filter(p => p.over25).length / faixaRecente.length * 100) : pO25
    const pctMedio = faixaMedio.length > 0 ? Math.round(faixaMedio.filter(p => p.over25).length / faixaMedio.length * 100) : pO25
    // Tendencia: se recente < medio = over esta "devendo"
    const tendFaixas = pctMedio - pctRecente // positivo = over devendo

    // === SCORE COMPOSTO (Metrica 6) ===
    const placares = linhasComp.map(l => extrairPlacar(l[col] as string))
    const atual = placares[0]
    if (!atual) return

    let boost = 0
    let motivo = ''

    // Boost por padrao de linhas (peso decrescente)
    const desvio = pctPonderado - pO25
    if (desvio < -15) boost += 18
    else if (desvio < -8) boost += 10
    else if (desvio > 15) boost -= 15
    else if (desvio > 8) boost -= 8

    // Boost por ciclo
    if (cicloMedio > 0 && seqAtual >= cicloMedio) {
      const fatorCiclo = Math.min((seqAtual - cicloMedio + 1) * 8, 22)
      boost += dirAtual ? -fatorCiclo : fatorCiclo
      motivo = 'Ciclo:' + cicloMedio + ' Seq:' + seqAtual
    }

    // Boost por faixas horarias
    if (tendFaixas > 15) boost += 12
    else if (tendFaixas > 8) boost += 6
    else if (tendFaixas < -15) boost -= 10

    // Boost por correlacao com coluna anterior
    boost += corrBoost

    // Boost por tipo IA (padrao de linhas recentes)
    if (tipoIA === 1) {
      const ant = placares[1]
      if (ant) {
        if (atual.over25 === ant.over25) { boost += atual.over25 ? -8 : 10; motivo += '|2igual' }
        else { boost += atual.over25 ? 5 : -5; motivo += '|alternando' }
      }
    } else if (tipoIA === 2) {
      const ant1 = placares[1], ant2 = placares[2]
      if (ant1 && ant2) {
        const reds = [ant2.over25, ant1.over25, atual.over25].filter(r => !r).length
        const greens = 3 - reds
        if (reds === 3) { boost += 18; motivo += '|3xRED' }
        else if (greens === 3) { boost -= 16; motivo += '|3xGREEN' }
        else if (ant1.over25 === atual.over25) { boost += atual.over25 ? -7 : 9; motivo += '|2igual' }
      }
    } else {
      const ant1 = placares[1], ant2 = placares[2], ant3 = placares[3]
      if (ant1 && ant2 && ant3) {
        const reds = [ant3.over25, ant2.over25, ant1.over25, atual.over25].filter(r => !r).length
        const greens = 4 - reds
        if (reds === 4) { boost += 22; motivo += '|4xRED' }
        else if (greens === 4) { boost -= 18; motivo += '|4xGREEN' }
        else if (reds === 3) { boost += 14; motivo += '|3/4RED' }
        else if (greens === 3) { boost -= 12; motivo += '|3/4GREEN' }
      }
    }

    // Ajuste por media de gols
    if (mediaG > 3.0) boost -= 5
    if (mediaG < 1.5) boost += 5

    // Limitar boost total
    boost = Math.max(-30, Math.min(30, boost))

    const baseO25 = Math.min(Math.max(pO25 + boost, 10), 93)
    let mercado = '', prob = 0, conf = 55

    if (temFiltro) {
      const greens = validos.filter(p => passaFiltro(p, filtroAtivo)).length
      const pct = Math.round(greens / n * 100)
      const partes: string[] = []
      if (filtroAtivo.over) partes.push('OVER ' + filtroAtivo.over)
      if (filtroAtivo.under) partes.push('UNDER ' + filtroAtivo.under)
      if (filtroAtivo.ambas === 'sim') partes.push('AMBAS SIM')
      if (filtroAtivo.ambas === 'nao') partes.push('AMBAS NAO')
      if (filtroAtivo.resultado) partes.push(filtroAtivo.resultado.toUpperCase())
      mercado = partes.join(' + ')
      // Prob = % historica pura + boost moderado max +10
      prob = Math.min(Math.max(pct + Math.min(Math.max(boost, -10), 10), 10), 93)
      // Confianca baseada na consistencia historica real
      const dev = Math.abs(pct - 50)
      conf = n >= 30 && dev > 25 ? 80
           : n >= 20 && dev > 20 ? 70
           : n >= 10 && dev > 15 ? 62
           : 50
    } else {
      // Escolher UM mercado claro - com vantagem minima de 15% sobre o oposto
      // Over vs Under: escolhe o que tiver maior vantagem historica
      const overProb = baseO25
      const underProb = 100 - baseO25

      // So considera over se vantagem clara (>15% acima de 50)
      // So considera under se vantagem clara (>15% acima de 50)
      const opcoes: { nome: string; prob: number; vantagem: number }[] = []

      if (overProb > underProb && overProb > 55) {
        opcoes.push({ nome: 'OVER 2.5', prob: overProb, vantagem: overProb - 50 })
      } else if (underProb > overProb && underProb > 55) {
        opcoes.push({ nome: 'UNDER 2.5', prob: underProb, vantagem: underProb - 50 })
      }

      if (pO15 > 70) opcoes.push({ nome: 'OVER 1.5', prob: pO15, vantagem: pO15 - 50 })
      if (pO35 > 55) opcoes.push({ nome: 'OVER 3.5', prob: Math.min(pO35 + (mediaG > 3 ? 8 : 0), 88), vantagem: pO35 - 50 })
      if (pAmbas > 60) opcoes.push({ nome: 'AMBAS SIM', prob: Math.min(pAmbas + (boost > 10 ? 8 : 0), 92), vantagem: pAmbas - 50 })
      if (pCasa > 60) opcoes.push({ nome: 'CASA', prob: pCasa, vantagem: pCasa - 50 })
      if (pFora > 55) opcoes.push({ nome: 'FORA', prob: pFora, vantagem: pFora - 50 })

      if (opcoes.length === 0) {
        // Sem padrao claro - nao exibir nas melhores entradas
        mercado = overProb >= underProb ? 'OVER 2.5' : 'UNDER 2.5'
        prob = Math.max(overProb, underProb)
        conf = 40 // baixa confianca - nao vai aparecer nas melhores entradas
      } else {
        opcoes.sort((a, b) => b.vantagem - a.vantagem)
        mercado = opcoes[0].nome
        prob = Math.round(opcoes[0].prob)
        conf = Math.abs(boost) > 20 ? 90 : Math.abs(boost) > 14 ? 80 : Math.abs(boost) > 8 ? 70 : opcoes[0].vantagem > 25 ? 72 : opcoes[0].vantagem > 15 ? 62 : 50
      }
    }

    if (!motivo) motivo = 'Hist:' + pO25 + '% Pond:' + pctPonderado + '% Tend:' + (tendFaixas > 0 ? '+' : '') + tendFaixas + '%'

    resultado.push({ minuto: min, mercado, probabilidade: Math.round(prob), confianca: conf, motivo })
  })
  return resultado
}

export default function GradeResultados({ linhas, colunas, horas, liga, ligas, onTrocarLiga, dadosTodasLigas }: Props) {
  const [filtros, setFiltros] = useState({ ...FILTRO_VAZIO })
  const [filtrosAtivos, setFiltrosAtivos] = useState({ ...FILTRO_VAZIO })
  const [tipoIA, setTipoIA] = useState<1 | 2 | 3>(1)
  const [mostrarIA, setMostrarIA] = useState(true)
  const [painelAtivo, setPainelAtivo] = useState<'casa' | 'fora' | 'gols'>('casa')
  const [alertaSom, setAlertaSom] = useState(true)
  const [agora, setAgora] = useState(new Date())

  // Atualizar relogio a cada segundo
  useState(() => {
    const timer = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(timer)
  })

  // Horario da Bet365: hora vem da API (horas[0]), minuto/segundo do relogio local
  // A diferenca e so na hora (fuso horario) - minutos e segundos sao iguais
  const horaBet365 = horas && horas.length > 0 ? parseInt(String(horas[0])) : agora.getHours()

  const temFiltro = Object.values(filtrosAtivos).some(v => v !== '')
  const cols = colunas.length > 0 ? colunas : ['tempo01','tempo04','tempo07','tempo10','tempo13','tempo16','tempo19','tempo22','tempo25','tempo28','tempo31','tempo34','tempo37','tempo40','tempo43','tempo46','tempo49','tempo52','tempo55','tempo58']
  const linhas20 = linhas.slice(0, 20)

  const linhaStats = useMemo(() => linhas20.map((linha, idx) => {
    let total = 0, greens = 0, totalGols = 0
    cols.forEach(col => {
      const p = extrairPlacar(linha[col] as string)
      if (p) { total++; totalGols += p.gols; if (p.over25) greens++ }
    })
    return { idx, total, greens, pct: total > 0 ? Math.round(greens / total * 100) : 0, totalGols }
  }), [linhas, colunas])

  const colStats = useMemo(() => cols.map(col => {
    let total = 0, greens = 0
    linhas20.forEach(linha => {
      const p = extrairPlacar(linha[col] as string)
      if (!p) return
      total++
      if (!temFiltro) {
        if (p.over25) greens++
      } else {
        if (passaFiltro(p, filtrosAtivos)) greens++
      }
    })
    return { col, total, greens, pct: total > 0 ? Math.round(greens / total * 100) : 0 }
  }), [linhas, colunas, filtrosAtivos])

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
        min: col.replace('tempo', ''), total,
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

  // === ANALISE 4: Cruzamento entre ligas ===
  // Verificar se outras ligas estao em ciclo oposto (oportunidade de entrada)
  const cruzamentoLigas = useMemo(() => {
    if (!dadosTodasLigas || Object.keys(dadosTodasLigas).length === 0) return []
    const resultado: { liga: string; minuto: string; sinal: string; pct: number }[] = []

    Object.entries(dadosTodasLigas).forEach(([nomeLiga, linhasLiga]) => {
      if (linhasLiga.length < 5) return
      cols.forEach(col => {
        const histLigaAtual = linhas.slice(0, 8).map(l => extrairPlacar(l[col] as string)).filter(Boolean) as PlacarInfo[]
        const histOutraLiga = linhasLiga.slice(0, 8).map(l => extrairPlacar(l[col] as string)).filter(Boolean) as PlacarInfo[]
        if (histLigaAtual.length < 3 || histOutraLiga.length < 3) return

        const pctAtual = Math.round(histLigaAtual.filter(p => p.over25).length / histLigaAtual.length * 100)
        const pctOutra = Math.round(histOutraLiga.filter(p => p.over25).length / histOutraLiga.length * 100)

        // Se as ligas estao em ciclos opostos (diferenca > 40%) - sinal forte
        if (Math.abs(pctAtual - pctOutra) >= 40) {
          const min = col.replace('tempo', '')
          const ligaEmGreen = pctAtual > pctOutra ? (liga || 'atual') : nomeLiga
          resultado.push({
            liga: ligaEmGreen,
            minuto: min,
            sinal: pctAtual > pctOutra ? 'OVER 2.5' : 'UNDER 2.5',
            pct: Math.max(pctAtual, pctOutra),
          })
        }
      })
    })

    return resultado
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5)
  }, [linhas, colunas, dadosTodasLigas])

  // === ANALISE 5: Deteccao de anomalia ===
  // Minutos que sairam completamente fora do padrao historico
  const anomalias = useMemo(() => {
    return cols.map(col => {
      const histCompleto = linhas.slice(0, 48).map(l => extrairPlacar(l[col] as string)).filter(Boolean) as PlacarInfo[]
      if (histCompleto.length < 10) return null

      const pctHist = Math.round(histCompleto.filter(p => p.over25).length / histCompleto.length * 100)
      const ultimas3 = histCompleto.slice(0, 3)
      const pctRecente = Math.round(ultimas3.filter(p => p.over25).length / ultimas3.length * 100)

      const desvio = Math.abs(pctRecente - pctHist)
      if (desvio < 40) return null // So mostra se desvio for grande

      const min = col.replace('tempo', '')
      return {
        minuto: min,
        pctHistorico: pctHist,
        pctRecente,
        desvio,
        // Se historico e alto mas recente e baixo: over devendo -> apostar OVER
        mercado: pctHist > 50 && pctRecente < 30 ? 'OVER 2.5' : pctHist < 40 && pctRecente > 70 ? 'UNDER 2.5' : null,
        forca: desvio >= 60 ? 'FORTE' : 'MEDIA',
      }
    }).filter(Boolean).filter(a => a!.mercado !== null)
      .sort((a, b) => b!.desvio - a!.desvio)
      .slice(0, 5) as { minuto: string; pctHistorico: number; pctRecente: number; desvio: number; mercado: string; forca: string }[]
  }, [linhas, colunas])

  const tendencias = useMemo(() => {
    if (!mostrarIA || linhas.length < 5) return []
    return calcularIA(linhas, cols, tipoIA, filtrosAtivos)
  }, [linhas, colunas, tipoIA, mostrarIA, filtrosAtivos])

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

  const melhores = tendencias
    .filter(t => t.probabilidade >= 65 && t.confianca >= 65)
    .sort((a, b) => (b.probabilidade + b.confianca) - (a.probabilidade + a.confianca))
    .slice(0, 5)

  function aplicar() { setFiltrosAtivos({ ...filtros }) }
  function limpar() { setFiltros({ ...FILTRO_VAZIO }); setFiltrosAtivos({ ...FILTRO_VAZIO }) }

  // Aplicar filtro automaticamente ao mudar qualquer select
  function setFiltroAuto(novoFiltro: typeof FILTRO_VAZIO) {
    setFiltros(novoFiltro)
    setFiltrosAtivos(novoFiltro)
  }

  // Calcular diferenca de horario entre Bet365 e relogio local
  // horas[0] = hora atual da Bet365, agora.getHours() = hora local
  const horaBet = horaBet365
  const horaAtualBet = horaBet
  const minAtualBet = agora.getMinutes()
  const segAtualBet = agora.getSeconds()

  function proximaHora(minuto: string): string {
    const minNum = parseInt(minuto)
    const h = minNum > minAtualBet ? horaAtualBet : (horaAtualBet + 1) % 24
    return String(h).padStart(2, '0') + ':' + String(minNum).padStart(2, '0')
  }

  function countdown(minuto: string): string {
    const minNum = parseInt(minuto)
    let diffSeg = (minNum - minAtualBet) * 60 - segAtualBet
    if (diffSeg <= 0) diffSeg += 3600
    const m = Math.floor(diffSeg / 60)
    const s = diffSeg % 60
    return m + ':' + String(s).padStart(2, '0')
  }

  function horaLinha(idx: number): string {
    if (horas && horas.length > idx) return String(horas[idx]).padStart(2, '0')
    return String((horaAtualBet - idx + 24) % 24).padStart(2, '0')
  }

  // Alerta sonoro quando nova entrada de alta confianca aparece
  function tocarAlerta() {
    if (!alertaSom) return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)
    } catch (e) {}
  }

  const verde = '#1a7a3a', vermelho = '#c0392b', azul = '#1565c0'
  const bg = '#ffffff', bgLight = '#f0f0f0', border = '#cccccc'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* STATS + LIGAS + IA */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        {[
          { lbl: 'GREENS', val: stats20.pct + '%' },
          { lbl: 'GOLS', val: String(stats20.mediaGols) },
          { lbl: 'PARTIDAS', val: String(stats20.total) },
        ].map(s => (
          <div key={s.lbl} style={{ background: azul, borderRadius: '6px', padding: '5px 10px' }}>
            <div style={{ fontSize: '9px', color: '#aaccff' }}>{s.lbl}</div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>{s.val}</div>
          </div>
        ))}
        {ligas && ligas.map(l => (
          <button key={l} onClick={() => onTrocarLiga && onTrocarLiga(l)} style={{
            padding: '5px 12px', border: 'none', borderRadius: '6px',
            background: liga === l ? verde : azul,
            color: '#fff', fontWeight: 700, fontSize: '11px', cursor: 'pointer',
          }}>
            {l.toUpperCase()}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          <button onClick={() => setMostrarIA(!mostrarIA)} style={{ padding: '5px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700, fontSize: '11px', background: mostrarIA ? verde : azul, color: '#fff' }}>
            IA {mostrarIA ? 'ON' : 'OFF'}
          </button>
          {mostrarIA && ([1, 2, 3] as const).map(t => (
            <button key={t} onClick={() => setTipoIA(t)} style={{ padding: '5px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700, fontSize: '11px', background: tipoIA === t ? verde : azul, color: '#fff' }}>
              TIPO {t}
            </button>
          ))}
        </div>
      </div>

      {/* PAINEIS - MELHORES MINUTOS */}
      <div style={{ background: azul, borderRadius: '8px', padding: '4px 8px' }}>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
          {([
            { key: 'casa' as const, lbl: 'VITORIA CASA' },
            { key: 'fora' as const, lbl: 'VITORIA FORA' },
            { key: 'gols' as const, lbl: 'MAIS GOLS' },
          ]).map(b => (
            <button key={b.key} onClick={() => setPainelAtivo(b.key)} style={{
              padding: '3px 10px', border: 'none', borderRadius: '4px',
              cursor: 'pointer', fontWeight: 700, fontSize: '10px',
              background: painelAtivo === b.key ? verde : '#2979ff',
              color: '#fff',
            }}>
              {b.lbl}
            </button>
          ))}
        </div>
        <div style={{ background: '#fff', borderRadius: '6px', padding: '4px 8px' }}>
          {painelAtivo === 'casa' && (
            <div>
              <div style={{ fontSize: '9px', fontWeight: 800, color: verde, marginBottom: '4px' }}>MELHORES MINUTOS - VITORIA CASA (ult. 20h)</div>
              {melhoresParaApostar.melhorCasa.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid #eee', fontSize: '11px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ color: i < 3 ? azul : '#111', fontWeight: i === 0 ? 700 : 500 }}>MIN {t.min}</span>
                    <span style={{ color: '#999', fontSize: '10px' }}>{proximaHora(t.min)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#666', fontSize: '10px' }}>{t.total}j</span>
                    <span style={{ color: verde, fontWeight: 700 }}>{t.pctCasa}% casa vence</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {painelAtivo === 'fora' && (
            <div>
              <div style={{ fontSize: '9px', fontWeight: 800, color: vermelho, marginBottom: '4px' }}>MELHORES MINUTOS - VITORIA FORA (ult. 20h)</div>
              {melhoresParaApostar.melhorFora.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid #eee', fontSize: '11px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ color: i < 3 ? azul : '#111', fontWeight: i === 0 ? 700 : 500 }}>MIN {t.min}</span>
                    <span style={{ color: '#999', fontSize: '10px' }}>{proximaHora(t.min)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#666', fontSize: '10px' }}>{t.total}j</span>
                    <span style={{ color: vermelho, fontWeight: 700 }}>{t.pctFora}% fora vence</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {painelAtivo === 'gols' && (
            <div>
              <div style={{ fontSize: '9px', fontWeight: 800, color: azul, marginBottom: '4px' }}>MINUTOS COM MAIS GOLS (ult. 20h)</div>
              {melhoresParaApostar.maisGols.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid #eee', fontSize: '11px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ color: i < 3 ? azul : '#111', fontWeight: i === 0 ? 700 : 500 }}>MIN {t.min}</span>
                    <span style={{ color: '#999', fontSize: '10px' }}>{proximaHora(t.min)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#666', fontSize: '10px' }}>{t.total}j</span>
                    <span style={{ color: azul, fontWeight: 700 }}>{t.mediaGols} gols/j | {t.pctOver}% over2.5</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ANALISE 5: ANOMALIAS */}
      {anomalias.length > 0 && (
        <div style={{ background: '#fff3e0', border: '2px solid #ff9800', borderRadius: '8px', padding: '8px 12px' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#e65100', marginBottom: '6px', letterSpacing: '1px' }}>
            ANOMALIA DETECTADA - MERCADO FORA DO PADRAO
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {anomalias.map((a, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #ff9800', borderRadius: '6px', padding: '6px 10px', minWidth: '140px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: azul }}>MIN {a.minuto}</span>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: a.forca === 'FORTE' ? vermelho : '#e65100', background: a.forca === 'FORTE' ? '#fde8e8' : '#fff3e0', borderRadius: '3px', padding: '1px 5px' }}>{a.forca}</span>
                </div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: verde }}>{a.mercado}</div>
                <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
                  Hist: {a.pctHistorico}% | Recente: {a.pctRecente}% | Desvio: {a.desvio}%
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '9px', color: '#e65100', marginTop: '6px' }}>
            Minutos onde o resultado recente diverge fortemente do historico - correcao esperada
          </div>
        </div>
      )}

      {/* ANALISE 4: CRUZAMENTO ENTRE LIGAS */}
      {cruzamentoLigas.length > 0 && (
        <div style={{ background: '#f3e5f5', border: '2px solid #9c27b0', borderRadius: '8px', padding: '8px 12px' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#6a1b9a', marginBottom: '6px', letterSpacing: '1px' }}>
            CRUZAMENTO DE LIGAS - CICLOS OPOSTOS DETECTADOS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {cruzamentoLigas.map((c2, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #9c27b0', borderRadius: '6px', padding: '6px 10px', minWidth: '140px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#6a1b9a', marginBottom: '2px' }}>{c2.liga}</div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: verde }}>{c2.sinal}</div>
                <div style={{ fontSize: '9px', color: '#666' }}>MIN {c2.minuto} | {c2.pct}% recente</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '9px', color: '#6a1b9a', marginTop: '6px' }}>
            Ligas em ciclos opostos - entrada na liga em GREEN quando a outra esta em RED
          </div>
        </div>
      )}

      {/* FILTROS */}
      <div style={{ background: '#ffd600', borderRadius: '8px', padding: '8px 12px' }}>
        <div style={{ fontSize: '10px', color: '#333', fontWeight: 700, marginBottom: '8px' }}>FILTROS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', marginBottom: '4px' }}>
          {[
            { lbl: 'OVER', key: 'over' as const, opts: ['0.5','1.5','2.5','3.5'] },
            { lbl: 'UNDER', key: 'under' as const, opts: ['1.5','2.5','3.5'] },
          ].map(f => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: '#111', fontWeight: 700, minWidth: '40px' }}>{f.lbl}</span>
              <select style={{ flex: 1, background: '#fff', border: '1px solid #ccc', color: '#111', padding: '1px 3px', fontSize: '11px', borderRadius: '3px', outline: 'none', height: '22px' }} value={filtros[f.key]} onChange={e => setFiltroAuto({ ...filtros, [f.key]: e.target.value })}>
                <option value="">-</option>
                {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#111', fontWeight: 700, minWidth: '40px' }}>AMBAS</span>
            <select style={{ flex: 1, background: '#fff', border: '1px solid #ccc', color: '#111', padding: '1px 3px', fontSize: '11px', borderRadius: '3px', outline: 'none', height: '22px' }} value={filtros.ambas} onChange={e => setFiltroAuto({ ...filtros, ambas: e.target.value })}>
              <option value="">-</option>
              <option value="sim">Sim</option>
              <option value="nao">Nao</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#111', fontWeight: 700, minWidth: '40px' }}>RESULT.</span>
            <select style={{ flex: 1, background: '#fff', border: '1px solid #ccc', color: '#111', padding: '1px 3px', fontSize: '11px', borderRadius: '3px', outline: 'none', height: '22px' }} value={filtros.resultado} onChange={e => setFiltroAuto({ ...filtros, resultado: e.target.value })}>
              <option value="">-</option>
              <option value="casa">Casa</option>
              <option value="empate">Empate</option>
              <option value="fora">Fora</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={aplicar} style={{ flex: 1, background: verde, color: '#fff', border: 'none', padding: '5px', fontWeight: 700, fontSize: '13px', borderRadius: '4px', cursor: 'pointer' }}>FILTRAR</button>
          <button onClick={limpar} style={{ flex: 1, background: '#fff', color: '#333', border: '1px solid #ccc', padding: '5px', fontSize: '13px', borderRadius: '4px', cursor: 'pointer' }}>LIMPAR</button>
        </div>
      </div>

      {/* MELHORES ENTRADAS */}
      {mostrarIA && melhores.length > 0 && (
        <div style={{ background: verde, borderRadius: '6px', padding: '8px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff' }}>MELHORES ENTRADAS - PROXIMA PARTIDA</span>
            <span style={{ fontSize: '10px', color: '#ccffcc' }}>IA TIPO {tipoIA}</span>
            {liga && <span style={{ fontSize: '10px', background: '#ffffff33', color: '#fff', borderRadius: '3px', padding: '1px 6px', fontWeight: 700 }}>{liga.toUpperCase()}</span>}
            <button onClick={() => { setAlertaSom(!alertaSom); tocarAlerta() }} style={{ marginLeft: 'auto', background: alertaSom ? '#fff' : '#ffffff44', color: alertaSom ? verde : '#fff', border: 'none', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
              {alertaSom ? 'SOM ON' : 'SOM OFF'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
            {melhores.map((t, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '4px 8px', flex: '1', minWidth: '90px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: '#333' }}>MIN {t.minuto}</span>
                  <span style={{ fontSize: '9px', color: azul, fontWeight: 700 }}>{proximaHora(t.minuto)}</span>
                </div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#111' }}>{t.mercado}</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: azul, fontFamily: 'monospace', lineHeight: '1.1' }}>{t.probabilidade}%</div>
                <div style={{ fontSize: '9px', color: verde, fontWeight: 700 }}>Conf: {t.confianca}%</div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: vermelho, fontFamily: 'monospace' }}>
                  {countdown(t.minuto)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '9px', color: '#ccffcc', marginTop: '4px' }}>Aposte apenas quando prob &gt;= 65% E confianca &gt;= 70%</div>
        </div>
      )}

      {/* GRADE */}
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '11px', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ background: bg, border: '1px solid ' + border, padding: '3px 5px', color: verde, fontSize: '10px', position: 'sticky', left: 0, zIndex: 3, minWidth: '24px' }}>H</th>
              {colStats.map(cs => (
                <th key={cs.col} style={{ background: bg, border: '1px solid ' + border, padding: '2px 3px', textAlign: 'center', minWidth: '42px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: cs.pct >= 50 ? verde : vermelho }}>{cs.pct}%</div>
                  <div style={{ fontSize: '9px', color: '#666' }}>{cs.total}</div>
                </th>
              ))}
              <th style={{ background: bg, border: '1px solid ' + border, padding: '2px 3px', color: '#666', fontSize: '9px', minWidth: '42px', textAlign: 'center' }}>% | G</th>
            </tr>
            {mostrarIA && (
              <tr>
                <th style={{ background: azul, border: '1px solid ' + border, padding: '2px 4px', color: '#fff', fontSize: '9px', position: 'sticky', left: 0, zIndex: 3, height: '24px' }}>IA T{tipoIA}</th>
                {cols.map(col => {
                  const t = tendencias.find(t => t.minuto === col.replace('tempo', ''))
                  return (
                    <td key={col} title={t?.motivo} style={{ background: azul, border: '1px solid ' + border, padding: '1px 2px', textAlign: 'center', height: '24px' }}>
                      {t && temFiltro ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#fff', lineHeight: '1.2' }}>{t.probabilidade}%</span>
                          <span style={{ fontSize: '9px', color: '#aaffaa', lineHeight: '1.2' }}>{t.confianca}%</span>
                        </div>
                      ) : t ? (
                        <span style={{ fontSize: '8px', color: '#fff', fontWeight: 600 }}>{t.mercado}</span>
                      ) : <span style={{ color: '#ffffff44' }}>-</span>}
                    </td>
                  )
                })}
                <td style={{ background: azul, border: '1px solid ' + border, height: '24px' }} />
              </tr>
            )}
            <tr>
              <th style={{ background: bgLight, border: '1px solid ' + border, padding: '3px 5px', color: '#666', fontSize: '9px', position: 'sticky', left: 0, zIndex: 3 }}>MIN</th>
              {cols.map(col => (
                <th key={col} style={{ background: bgLight, border: '1px solid ' + border, padding: '3px 3px', color: '#666', fontSize: '9px', textAlign: 'center' }}>
                  {col.replace('tempo', '')}
                </th>
              ))}
              <th style={{ background: bgLight, border: '1px solid ' + border, padding: '3px 3px', color: '#666', fontSize: '9px', textAlign: 'center', minWidth: '42px' }}>% | G</th>
            </tr>
          </thead>
          <tbody>
            {linhas20.map((linha, idx) => {
              const ls = linhaStats[idx]
              return (
                <tr key={idx}>
                  <td style={{ background: bgLight, border: '1px solid ' + border, padding: '0 4px', color: verde, fontWeight: 700, fontSize: '11px', position: 'sticky', left: 0, textAlign: 'center', fontFamily: 'monospace', height: '20px' }}>
                    {horaLinha(idx)}
                  </td>
                  {cols.map(col => {
                    const p = extrairPlacar(linha[col] as string)
                    const isGreen = p !== null && temFiltro && passaFiltro(p, filtrosAtivos)
                    return (
                      <td key={col} style={{ padding: '0', border: '1px solid ' + border, textAlign: 'center', height: '20px' }}>
                        {p ? (
                          <span style={{ display: 'block', width: '100%', lineHeight: '20px', fontWeight: 700, fontSize: '10px', fontFamily: 'monospace', background: isGreen ? verde : vermelho, color: '#fff', textAlign: 'center' }}>
                            {p.texto}
                          </span>
                        ) : <span style={{ color: '#ccc', fontSize: '9px' }}>-</span>}
                      </td>
                    )
                  })}
                  <td style={{ background: bgLight, border: '1px solid ' + border, padding: '0 4px', textAlign: 'center', height: '20px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: ls && ls.pct >= 50 ? verde : vermelho }}>{ls ? ls.pct : 0}%</span>
                    <span style={{ fontSize: '9px', color: '#333', marginLeft: '2px' }}>{ls ? ls.totalGols : 0}g</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* LEGENDA IA */}
      {mostrarIA && (
        <div style={{ background: bgLight, border: '1px solid ' + border, borderRadius: '6px', padding: '8px 14px', fontSize: '11px', color: '#333' }}>
          <span style={{ color: azul, fontWeight: 700 }}>IA TIPO {tipoIA}: </span>
          {tipoIA === 1 && 'Compara linha atual com a anterior (2 linhas)'}
          {tipoIA === 2 && 'Compara atual + penultima + antepenultima (3 linhas)'}
          {tipoIA === 3 && 'Compara as 4 linhas mais recentes'}
          {!temFiltro && <span style={{ marginLeft: '12px', color: '#b8600c' }}>Selecione um filtro para ver probabilidade por minuto</span>}
        </div>
      )}

    </div>
  )
}
