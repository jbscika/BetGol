import { useState, useEffect } from 'react'
import { Partida } from '../pages/Dashboard'

interface Props {
  linhas: Partida[]
  colunas?: string[]
}

interface Padrao {
  descricao: string
  minutoEntrada: string
  mercado: string
  greens: number
  entradas: number
  pct: number
  tipo: string
}

const COLS_DEFAULT = ['tempo01','tempo04','tempo07','tempo10','tempo13','tempo16','tempo19','tempo22','tempo25','tempo28','tempo31','tempo34','tempo37','tempo40','tempo43','tempo46','tempo49','tempo52','tempo55','tempo58']

function extrairPlacar(val: string | null): { casa: number; fora: number; gols: number; texto: string } | null {
  if (!val) return null
  const linha = val.split('</br>')[0].split('<br>')[0].trim()
  const m = linha.match(/(\d+)\s*-\s*(\d+)/)
  if (!m) return null
  const casa = parseInt(m[1]), fora = parseInt(m[2])
  return { casa, fora, gols: casa + fora, texto: casa + '-' + fora }
}

function verificarMercado(p: { casa: number; fora: number; gols: number }, mercado: string): boolean {
  switch (mercado) {
    case 'OVER 2.5': return p.gols > 2.5
    case 'UNDER 2.5': return p.gols < 2.5
    case 'OVER 1.5': return p.gols > 1.5
    case 'AMBAS SIM': return p.casa > 0 && p.fora > 0
    case 'AMBAS NAO': return !(p.casa > 0 && p.fora > 0)
    case 'CASA': return p.casa > p.fora
    case 'EMPATE': return p.casa === p.fora
    case 'FORA': return p.fora > p.casa
    default: return false
  }
}

// Threshold minimo por mercado - ambas marcam tem distribuicao diferente de over/under
function thresholdMercado(mercado: string): number {
  if (mercado === 'AMBAS SIM' || mercado === 'AMBAS NAO') return 65
  if (mercado === 'EMPATE') return 60
  if (mercado === 'CASA' || mercado === 'FORA') return 62
  return 70 // OVER/UNDER
}

function minEntradasMercado(mercado: string): number {
  if (mercado === 'AMBAS SIM' || mercado === 'AMBAS NAO') return 5
  return 6
}

function buscarPadroesAuto(linhas: Partida[], colunas: string[]): Padrao[] {
  const MERCADOS = ['OVER 2.5', 'UNDER 2.5', 'OVER 1.5', 'AMBAS SIM', 'AMBAS NAO', 'CASA', 'EMPATE', 'FORA']
  const padroes: Padrao[] = []

  // === TIPO 1: Apos placar X no MIN A, pula N minutos, mercado Y ===
  for (let colIdx = 0; colIdx < colunas.length; colIdx++) {
    const col = colunas[colIdx]

    for (let pulos = 1; pulos <= 6; pulos++) {
      const colAlvoIdx = colIdx + pulos
      if (colAlvoIdx >= colunas.length) continue
      const colAlvo = colunas[colAlvoIdx]

      const porPlacar: Record<string, { casa: number; fora: number; gols: number }[]> = {}

      for (let i = 0; i < linhas.length; i++) {
        const p = extrairPlacar(linhas[i][col] as string)
        if (!p) continue
        const pAlvo = extrairPlacar(linhas[i][colAlvo] as string)
        if (!pAlvo) continue
        if (!porPlacar[p.texto]) porPlacar[p.texto] = []
        porPlacar[p.texto].push(pAlvo)
      }

      for (const [placar, resultados] of Object.entries(porPlacar)) {
        const n = resultados.length
        for (const mercado of MERCADOS) {
          const minEnt = minEntradasMercado(mercado)
          if (n < minEnt) continue
          const greens = resultados.filter(r => verificarMercado(r, mercado)).length
          const pct = Math.round(greens / n * 100)
          const threshold = thresholdMercado(mercado)
          if (pct >= threshold && greens >= minEnt - 1) {
            padroes.push({
              descricao: `Apos ${placar} no MIN ${col.replace('tempo', '')}`,
              minutoEntrada: colAlvo.replace('tempo', ''),
              mercado,
              greens,
              entradas: n,
              pct,
              tipo: 'placar',
            })
          }
        }
      }
    }
  }

  // === TIPO 2: Sequencia na mesma linha - MIN A tem X, MIN B tende a ter Y ===
  // Analisa: se col A tem determinado padrao (OVER/UNDER/AMBAS), col B tende a ter qual mercado
  const GATILHOS = [
    { nome: 'OVER 2.5',  check: (p: any) => p.gols > 2.5 },
    { nome: 'UNDER 2.5', check: (p: any) => p.gols < 2.5 },
    { nome: 'AMBAS SIM', check: (p: any) => p.casa > 0 && p.fora > 0 },
    { nome: 'AMBAS NAO', check: (p: any) => !(p.casa > 0 && p.fora > 0) },
    { nome: 'CASA',      check: (p: any) => p.casa > p.fora },
    { nome: 'EMPATE',    check: (p: any) => p.casa === p.fora },
    { nome: 'FORA',      check: (p: any) => p.fora > p.casa },
  ]

  for (let colIdx = 0; colIdx < colunas.length - 1; colIdx++) {
    const colAnt = colunas[colIdx]
    for (let pulos = 1; pulos <= 4; pulos++) {
      const colAlvoIdx = colIdx + pulos
      if (colAlvoIdx >= colunas.length) continue
      const colAlvo = colunas[colAlvoIdx]

      for (const gatilho of GATILHOS) {
        // Coletar resultados quando gatilho se confirma na mesma linha
        const resultados: { casa: number; fora: number; gols: number }[] = []

        for (let i = 0; i < linhas.length; i++) {
          const pAnt = extrairPlacar(linhas[i][colAnt] as string)
          if (!pAnt || !gatilho.check(pAnt)) continue
          const pAlvo = extrairPlacar(linhas[i][colAlvo] as string)
          if (!pAlvo) continue
          resultados.push(pAlvo)
        }

        const n = resultados.length
        for (const mercado of MERCADOS) {
          // Nao repetir gatilho == mercado (OVER->OVER nao e interessante)
          if (gatilho.nome === mercado) continue
          const minEnt = minEntradasMercado(mercado)
          if (n < minEnt) continue
          const greens = resultados.filter(r => verificarMercado(r, mercado)).length
          const pct = Math.round(greens / n * 100)
          const threshold = thresholdMercado(mercado)
          if (pct >= threshold && greens >= minEnt - 1) {
            padroes.push({
              descricao: `Quando MIN ${colAnt.replace('tempo','')} e ${gatilho.nome}`,
              minutoEntrada: colAlvo.replace('tempo', ''),
              mercado,
              greens,
              entradas: n,
              pct,
              tipo: 'sequencia',
            })
          }
        }
      }
    }
  }

  // === TIPO 3: Sequencia entre linhas - linha anterior MIN A, linha atual MIN B ===
  for (let colIdx = 0; colIdx < colunas.length; colIdx++) {
    const col = colunas[colIdx]

    for (const gatilho of GATILHOS) {
      const resultados: { casa: number; fora: number; gols: number }[] = []

      for (let i = 1; i < linhas.length; i++) {
        const pAnt = extrairPlacar(linhas[i][col] as string) // linha anterior
        if (!pAnt || !gatilho.check(pAnt)) continue
        const pAtual = extrairPlacar(linhas[i - 1][col] as string) // linha atual mesma coluna
        if (!pAtual) continue
        resultados.push(pAtual)
      }

      const n = resultados.length
      for (const mercado of MERCADOS) {
        if (gatilho.nome === mercado) continue
        const minEnt = minEntradasMercado(mercado)
        if (n < minEnt) continue
        const greens = resultados.filter(r => verificarMercado(r, mercado)).length
        const pct = Math.round(greens / n * 100)
        const threshold = thresholdMercado(mercado)
        if (pct >= threshold && greens >= minEnt - 1) {
          padroes.push({
            descricao: `Apos ${gatilho.nome} na hora anterior`,
            minutoEntrada: col.replace('tempo', ''),
            mercado,
            greens,
            entradas: n,
            pct,
            tipo: 'hora',
          })
        }
      }
    }
  }

  // Remover duplicatas, ordenar e limitar
  const vistos = new Set<string>()
  return padroes
    .filter(p => {
      const chave = p.descricao + '|' + p.mercado + '|' + p.minutoEntrada
      if (vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })
    .sort((a, b) => b.pct - a.pct || b.greens - a.greens)
    .slice(0, 15)
}

function analisarGeral(linhas: Partida[], colunas: string[]) {
  const ultimas = linhas.slice(0, 24)
  const placares: { casa: number; fora: number; gols: number }[] = []

  ultimas.forEach(linha => {
    colunas.forEach(col => {
      const p = extrairPlacar(linha[col] as string)
      if (p) placares.push(p)
    })
  })

  const total = placares.length
  if (total === 0) return null

  const over25 = Math.round(placares.filter(p => p.gols > 2.5).length / total * 100)
  const under25 = Math.round(placares.filter(p => p.gols < 2.5).length / total * 100)
  const ambas = Math.round(placares.filter(p => p.casa > 0 && p.fora > 0).length / total * 100)
  const media = Math.round(placares.reduce((s, p) => s + p.gols, 0) / total * 10) / 10

  const contagem: Record<string, number> = {}
  placares.forEach(p => {
    const k = p.casa + '-' + p.fora
    contagem[k] = (contagem[k] || 0) + 1
  })
  const frequentes = Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([placar, count]) => ({ placar, count }))

  return { over25, under25, ambas, media, total, frequentes }
}

const COR_PCT = (pct: number) =>
  pct >= 85 ? '#00e676' : pct >= 75 ? '#69f0ae' : pct >= 65 ? '#b8960c' : '#ff3d5a'

const COR_TIPO = (tipo: string) =>
  tipo === 'placar' ? '#00d4ff' : tipo === 'sequencia' ? '#ce93d8' : '#ffd600'

export default function IATendencia({ linhas, colunas }: Props) {
  const [padroes, setPadroes] = useState<Padrao[]>([])
  const [geral, setGeral] = useState<any>(null)
  const [buscando, setBuscando] = useState(false)
  const cols = colunas && colunas.length > 0 ? colunas : COLS_DEFAULT

  useEffect(() => {
    if (linhas.length < 5) return
    setBuscando(true)
    setTimeout(() => {
      setPadroes(buscarPadroesAuto(linhas, cols))
      setGeral(analisarGeral(linhas, cols))
      setBuscando(false)
    }, 100)
  }, [linhas, colunas])

  const C = {
    bg: '#0a0e1a', surface: '#0f1629', surface2: '#141d35',
    border: '#1e2d4a', accent: '#00d4ff', green: '#00e676',
    red: '#ff3d5a', yellow: '#ffd600', text: '#ffffff',
  }

  if (!geral) return (
    <div style={{ textAlign: 'center', padding: '40px', color: '#ffffff', background: C.surface, borderRadius: '8px' }}>
      Sem dados suficientes para analise
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: "'JetBrains Mono', monospace" }}>

      {/* RESUMO GERAL */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '12px 16px' }}>
        <div style={{ fontSize: '9px', color: C.accent, letterSpacing: '2px', marginBottom: '10px', fontWeight: 700 }}>
          RESUMO GERAL - ULTIMAS 24H ({geral.total} partidas)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
          {[
            { lbl: 'OVER 2.5',  val: geral.over25 + '%', cor: geral.over25 >= 50 ? C.green : C.red },
            { lbl: 'UNDER 2.5', val: geral.under25 + '%', cor: geral.under25 >= 50 ? C.green : C.red },
            { lbl: 'AMBAS SIM', val: geral.ambas + '%',   cor: geral.ambas >= 45 ? C.green : C.red },
            { lbl: 'MEDIA GOLS',val: String(geral.media), cor: C.yellow },
          ].map(s => (
            <div key={s.lbl} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: '8px', color: C.text, letterSpacing: '1px', marginBottom: '4px' }}>{s.lbl}</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: s.cor }}>{s.val}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '9px', color: C.text, letterSpacing: '1px', marginBottom: '6px' }}>PLACARES MAIS FREQUENTES</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {geral.frequentes.map((p: any) => (
              <div key={p.placar} style={{ background: '#6b000044', border: '1px solid #ff3d5a44', borderRadius: '4px', padding: '3px 10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: C.text }}>{p.placar}</span>
                <span style={{ fontSize: '10px', color: C.red }}>{p.count}x</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PADROES */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '9px', color: C.accent, letterSpacing: '2px', fontWeight: 700 }}>
            PADROES DETECTADOS ({padroes.length})
          </div>
          {buscando && <span style={{ fontSize: '9px', color: C.yellow }}>Analisando...</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            {[
              { cor: COR_TIPO('placar'),    lbl: 'PLACAR' },
              { cor: COR_TIPO('sequencia'), lbl: 'SEQUENCIA' },
              { cor: COR_TIPO('hora'),      lbl: 'HORA ANT' },
            ].map(l => (
              <span key={l.lbl} style={{ fontSize: '8px', color: l.cor, border: `1px solid ${l.cor}44`, borderRadius: '3px', padding: '1px 6px' }}>{l.lbl}</span>
            ))}
          </div>
        </div>

        {padroes.length === 0 && !buscando && (
          <div style={{ textAlign: 'center', padding: '20px', color: C.text, fontSize: '11px' }}>
            Nenhum padrao forte encontrado ainda
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {padroes.map((p, i) => (
            <div key={i} style={{
              background: C.surface2, border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${COR_TIPO(p.tipo)}`,
              borderRadius: '6px', padding: '7px 12px',
              display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '8px', color: COR_TIPO(p.tipo), fontWeight: 700, minWidth: '62px' }}>
                {p.tipo.toUpperCase()}
              </span>
              <span style={{ fontSize: '10px', color: C.text, flex: 1, minWidth: '160px' }}>{p.descricao}</span>
              <span style={{ fontSize: '9px', color: C.accent, fontWeight: 700 }}>MIN {p.minutoEntrada}</span>
              <span style={{ fontSize: '10px', fontWeight: 800, color: C.green, minWidth: '90px' }}>{p.mercado}</span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: COR_PCT(p.pct) }}>{p.pct}%</span>
                <span style={{ fontSize: '9px', color: C.text }}>{p.greens}/{p.entradas}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
