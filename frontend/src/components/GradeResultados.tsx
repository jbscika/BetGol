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

// === FUNÇÃO DE EXTRAÇÃO ADAPTADA PARA O NOVO BANCO ===
function extrairPlacar(val: any): PlacarInfo | null {
  if (!val) return null
  let casa = 0, fora = 0

  if (typeof val === 'object' && val.placar_casa !== undefined) {
    casa = parseInt(val.placar_casa)
    fora = parseInt(val.placar_fora)
  } else if (typeof val === 'string') {
    const linha = val.split('</br>')[0].split('<br>')[0].trim()
    const m = linha.match(/(\d+)\s*-\s*(\d+)/)
    if (!m) return null
    casa = parseInt(m[1]); fora = parseInt(m[2])
  } else return null

  const gols = casa + fora
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

// === LÓGICA DE IA ORIGINAL (MANTIDA) ===
function calcularIA(linhas: Partida[], colunas: string[], tipoIA: number, filtroAtivo: typeof FILTRO_VAZIO): Tendencia[] {
  const resultado: Tendencia[] = []
  const temFiltro = Object.values(filtroAtivo).some(v => v !== '')
  const qtd = tipoIA === 1 ? 2 : tipoIA === 2 ? 3 : 4
  const linhasComp = linhas.slice(0, qtd)
  const linhasHist = linhas.slice(0, Math.min(linhas.length, 48))

  const histMap: Record<string, (PlacarInfo | null)[]> = {}
  colunas.forEach(col => { histMap[col] = linhasHist.map(l => extrairPlacar(l[col])) })

  colunas.forEach((col, colIdx) => {
    const histCompleto = histMap[col]
    const validos = histCompleto.filter(Boolean) as PlacarInfo[]
    if (validos.length < 5) return
    const min = col.replace('tempo', '')
    const n = validos.length

    const pO25 = Math.round(validos.filter(p => p.over25).length / n * 100)
    const mediaG = Math.round(validos.reduce((s, p) => s + p.gols, 0) / n * 10) / 10
    const mediaGols2 = validos.reduce((s, p) => s + p.gols * p.gols, 0) / n
    const varGols = mediaGols2 - mediaG * mediaG
    const estabilidade = varGols < 1.5 ? 1.15 : varGols > 3.0 ? 0.85 : 1.0

    const placares = linhasComp.map(l => extrairPlacar(l[col]))
    const atual = placares[0]
    if (!atual) return

    let boost = 0
    const motivos: string[] = []

    if (pO25 < 40) { boost += 10; motivos.push('Devendo Over') }
    
    const baseO25 = Math.min(Math.max(pO25 + boost, 8), 94)
    let mercado = baseO25 > 50 ? 'OVER 2.5' : 'UNDER 2.5'
    
    resultado.push({ minuto: min, mercado, probabilidade: Math.round(baseO25), confianca: Math.round(60 * estabilidade), motivo: motivos.join('|') })
  })
  return resultado
}

export default function GradeResultados({ linhas, colunas, horas, liga, ligas, onTrocarLiga, dadosTodasLigas }: Props) {
  const [filtros, setFiltros] = useState({ ...FILTRO_VAZIO })
  const [filtrosAtivos, setFiltrosAtivos] = useState({ ...FILTRO_VAZIO })
  const [tipoIA, setTipoIA] = useState<1 | 2 | 3>(1)
  const [mostrarIA, setMostrarIA] = useState(true)
  const [painelAtivo, setPainelAtivo] = useState<'casa' | 'fora' | 'gols'>('casa')
  const [agora, setAgora] = useState(new Date())

  const cols = colunas.length > 0 ? colunas : ['tempo01','tempo04','tempo07','tempo10','tempo13','tempo16','tempo19','tempo22','tempo25','tempo28','tempo31','tempo34','tempo37','tempo40','tempo43','tempo46','tempo49','tempo52','tempo55','tempo58']
  const linhas20 = linhas.slice(0, 20)

  // Memoização das Anomalias e Cruzamentos (O "recheio" do arquivo enorme)
  const anomalias = useMemo(() => {
    return cols.map(col => {
      const hist = linhas.slice(0, 48).map(l => extrairPlacar(l[col])).filter(Boolean) as PlacarInfo[]
      if (hist.length < 10) return null
      const pctHist = Math.round(hist.filter(p => p.over25).length / hist.length * 100)
      const pctRecente = Math.round(hist.slice(0, 3).filter(p => p.over25).length / 3 * 100)
      if (Math.abs(pctRecente - pctHist) < 40) return null
      return { minuto: col.replace('tempo', ''), pctHistorico: pctHist, pctRecente, desvio: Math.abs(pctRecente - pctHist), mercado: pctHist > 50 ? 'OVER 2.5' : 'UNDER 2.5', forca: 'ALTA' }
    }).filter(Boolean).slice(0, 5) as any[]
  }, [linhas, colunas])

  const cruzamentoLigas = useMemo(() => {
    if (!dadosTodasLigas) return []
    const res: any[] = []
    Object.entries(dadosTodasLigas).forEach(([nome, dados]) => {
      if (nome === liga) return
      const pctOutra = Math.round(dados.slice(0, 5).filter(l => extrairPlacar(l[cols[0]])?.over25).length / 5 * 100)
      if (pctOutra > 70) res.push({ liga: nome, minuto: 'Geral', sinal: 'OVER 2.5', pct: pctOutra })
    })
    return res.slice(0, 3)
  }, [dadosTodasLigas, liga])

  const stats20 = useMemo(() => {
    let t = 0, g = 0; 
    linhas20.forEach(l => cols.forEach(c => { const p = extrairPlacar(l[c]); if(p){ t++; if(p.over25) g++ } }))
    return { pct: t > 0 ? Math.round(g/t*100) : 0, total: t }
  }, [linhas, colunas])

  function horaLinha(idx: number): string {
    const h = horas && horas.length > 0 ? parseInt(String(horas[0])) : agora.getHours()
    return String((h - idx + 24) % 24).padStart(2, '0')
  }

  const azul = '#1565c0', verde = '#1a7a3a', vermelho = '#c0392b'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', paddingBottom: '50px' }}>
      
      {/* 1. TOPO: STATS E LIGAS */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ background: azul, color: '#fff', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px' }}>ESTATÍSTICA GERAL</div>
          <div style={{ fontSize: '18px', fontWeight: 900 }}>{stats20.pct}% OVER</div>
        </div>
        {ligas?.map(l => (
          <button key={l} onClick={() => onTrocarLiga?.(l)} style={{ padding: '10px 15px', borderRadius: '8px', border: 'none', background: l === liga ? verde : '#ccc', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      {/* 2. ANOMALIAS E CRUZAMENTOS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {anomalias.length > 0 && (
          <div style={{ background: '#fff3e0', border: '1px solid #ff9800', padding: '10px', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#e65100' }}>ANOMALIAS (MUDANÇA DE CICLO)</div>
            {anomalias.map((a, i) => <div key={i} style={{ fontSize: '11px', padding: '3px 0' }}>Min {a.minuto}: <b>{a.mercado}</b> (Desvio {a.desvio}%)</div>)}
          </div>
        )}
        {cruzamentoLigas.length > 0 && (
          <div style={{ background: '#f3e5f5', border: '1px solid #9c27b0', padding: '10px', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#6a1b9a' }}>OUTRAS LIGAS QUENTES</div>
            {cruzamentoLigas.map((c, i) => <div key={i} style={{ fontSize: '11px' }}>{c.liga}: {c.pct}% Recente</div>)}
          </div>
        )}
      </div>

      {/* 3. GRADE DE RESULTADOS */}
      <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #ddd', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              <th style={{ padding: '10px', border: '1px solid #eee' }}>Hora</th>
              {cols.map(c => <th key={c} style={{ padding: '10px', border: '1px solid #eee' }}>{c.replace('tempo', '')}</th>)}
            </tr>
          </thead>
          <tbody>
            {linhas20.map((l, idx) => (
              <tr key={idx}>
                <td style={{ textAlign: 'center', fontWeight: 'bold', background: '#fcfcfc', border: '1px solid #eee' }}>{horaLinha(idx)}</td>
                {cols.map(c => {
                  const p = extrairPlacar(l[c])
                  const pass = p ? passaFiltro(p, filtrosAtivos) : false
                  return (
                    <td key={c} style={{ 
                      textAlign: 'center', padding: '8px', border: '1px solid #eee',
                      background: p?.over25 ? '#e8f5e9' : '#fff',
                      color: p?.over25 ? '#2e7d32' : '#333',
                      fontWeight: pass ? '900' : 'normal',
                      boxShadow: pass ? 'inset 0 0 0 2px #ffd600' : 'none'
                    }}>
                      {p ? p.texto : '-'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. IA DE ENTRADAS (PRÓXIMOS JOGOS) */}
      <div style={{ background: '#2196f3', color: '#fff', padding: '15px', borderRadius: '12px' }}>
        <div style={{ fontWeight: 800, marginBottom: '10px' }}>IA - ENTRADAS SUGERIDAS</div>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
          {calcularIA(linhas, cols, tipoIA, filtrosAtivos).slice(0, 12).map((t, i) => (
            <div key={i} style={{ background: '#fff', color: '#333', padding: '10px', borderRadius: '8px', minWidth: '110px' }}>
              <div style={{ fontSize: '14px', fontWeight: 900 }}>{t.minuto}'</div>
              <div style={{ fontSize: '11px', color: verde, fontWeight: 800 }}>{t.mercado}</div>
              <div style={{ fontSize: '10px', color: '#999' }}>{t.probabilidade}% acerto</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
