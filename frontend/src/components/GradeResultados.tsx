import { useState, useMemo } from 'react'

interface Props {
  linhas: any[]
  colunas: string[]
  horas?: string[]
  liga?: string
  ligas?: string[]
  onTrocarLiga?: (liga: string) => void
  dadosTodasLigas?: Record<string, any[]>
}

interface PlacarInfo {
  casa: number; fora: number; texto: string; gols: number
  over05: boolean; over15: boolean; over25: boolean; over35: boolean
  ambasSim: boolean; casaVence: boolean; empate: boolean; foraVence: boolean
}

// === FUNÇÃO DE EXTRAÇÃO (LÊ OS DADOS DO FIREBASE SEM QUEBRAR SUA LÓGICA) ===
function extrairPlacar(item: any, col: string): PlacarInfo | null {
  if (!item) return null
  // Busca o dado na coluna específica (tempo01, tempo04...)
  const dado = item[col]
  if (!dado) return null

  let casa = 0, fora = 0

  if (typeof dado === 'object' && dado.placar_casa !== undefined) {
    casa = parseInt(dado.placar_casa)
    fora = parseInt(dado.placar_fora)
  } else if (typeof dado === 'string') {
    const m = dado.match(/(\d+)\s*-\s*(\d+)/)
    if (!m) return null
    casa = parseInt(m[1]); fora = parseInt(m[2])
  } else return null

  const gols = casa + fora
  return {
    casa, fora, gols, texto: `${casa}-${fora}`,
    over05: gols > 0.5, over15: gols > 1.5, over25: gols > 2.5, over35: gols > 3.5,
    ambasSim: casa > 0 && fora > 0,
    casaVence: casa > fora, empate: casa === fora, foraVence: fora > casa,
  }
}

export default function GradeResultados({ linhas, colunas, liga, ligas, onTrocarLiga, dadosTodasLigas }: Props) {
  // Configuração de colunas padrão se não vierem do Pai
  const cols = colunas?.length > 0 ? colunas : ['tempo01','tempo04','tempo07','tempo10','tempo13','tempo16','tempo19','tempo22','tempo25','tempo28','tempo31','tempo34','tempo37','tempo40','tempo43','tempo46','tempo49','tempo52','tempo55','tempo58']

  // === 1. SUA LÓGICA DE ANOMALIAS (RESTAURADA) ===
  const anomalias = useMemo(() => {
    return cols.map(col => {
      const hist = linhas.map(l => extrairPlacar(l, col)).filter(Boolean) as PlacarInfo[]
      if (hist.length < 10) return null
      const pctHist = Math.round(hist.filter(p => p.over25).length / hist.length * 100)
      const pctRecente = Math.round(hist.slice(0, 3).filter(p => p.over25).length / 3 * 100)
      if (Math.abs(pctRecente - pctHist) < 35) return null
      return { minuto: col.replace('tempo', ''), desvio: Math.abs(pctRecente - pctHist), tipo: pctRecente > pctHist ? 'Alta' : 'Baixa' }
    }).filter(Boolean)
  }, [linhas, cols])

  // === 2. SUA LÓGICA DE CRUZAMENTO DE LIGAS (RESTAURADA) ===
  const cruzamentoLigas = useMemo(() => {
    if (!dadosTodasLigas) return []
    return Object.entries(dadosTodasLigas).map(([nome, data]) => {
      if (nome === liga) return null
      const overs = data.filter(d => {
          // Lógica de contagem de overs rápida para cruzamento
          const casa = d.placar_casa || 0
          const fora = d.placar_fora || 0
          return (Number(casa) + Number(fora)) > 2.5
      }).length
      return { nome, pct: Math.round((overs / (data.length || 1)) * 100) }
    }).filter(Boolean)
  }, [dadosTodasLigas, liga])

  // === 3. ORGANIZAÇÃO DA GRADE (HORA X MINUTO) ===
  const gradeOrganizada = useMemo(() => {
    const horas: Record<string, any> = {}
    for (let i = 0; i < 24; i++) {
        horas[String(i).padStart(2, '0')] = {}
    }
    
    linhas.forEach(item => {
        const h = item.hora || (item.horario ? item.horario.split(':')[0] : null)
        const m = item.minuto || (item.horario ? item.horario.split(':')[1] : null)
        if (h && m && horas[h]) {
            horas[h][`tempo${m}`] = item
        }
    })
    return horas
  }, [linhas])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px', background: '#f0f2f5', minHeight: '100vh' }}>
      
      {/* HEADER E FILTROS */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, color: '#1a237e', fontSize: '20px' }}>Dashboard Pro: {liga}</h1>
          <p style={{ margin: '5px 0 0', color: '#666', fontSize: '13px' }}>Analisando {linhas.length} entradas no banco de dados local.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {ligas?.map(l => (
            <button key={l} onClick={() => onTrocarLiga?.(l)} style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', background: liga === l ? '#1a237e' : '#e0e0e0', color: liga === l ? '#fff' : '#333', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s' }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* PAINEL DE INSIGHTS (ANOMALIAS E LIGAS) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div style={{ background: '#fff', padding: '15px', borderRadius: '12px', borderLeft: '6px solid #ff9800' }}>
          <strong style={{ color: '#e65100', display: 'block', marginBottom: '10px' }}>⚡ ANOMALIAS DE CICLO</strong>
          <div style={{ fontSize: '12px' }}>
            {anomalias.length > 0 ? anomalias.map((a: any, i) => (
              <div key={i} style={{ marginBottom: '4px' }}>• Minuto <strong>{a.minuto}</strong> com variação de {a.desvio}% (Tendência {a.tipo}).</div>
            )) : "Padrões de mercado estáveis nas últimas horas."}
          </div>
        </div>
        <div style={{ background: '#fff', padding: '15px', borderRadius: '12px', borderLeft: '6px solid #673ab7' }}>
          <strong style={{ color: '#512da8', display: 'block', marginBottom: '10px' }}>🌐 TENDÊNCIA GLOBAL (OUTRAS LIGAS)</strong>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {cruzamentoLigas.map((c: any, i) => (
              <div key={i} style={{ background: '#ede7f6', padding: '8px', borderRadius: '6px', fontSize: '11px' }}>
                {c.nome}: <strong>{c.pct}% Over</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* GRADE DE RESULTADOS PRINCIPAL */}
      <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', border: '1px solid #ddd' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#1a237e', color: '#fff' }}>
              <th style={{ padding: '12px', border: '1px solid #283593' }}>HORA</th>
              {cols.map(c => <th key={c} style={{ padding: '12px', border: '1px solid #283593' }}>{c.replace('tempo', '')}</th>)}
            </tr>
          </thead>
          <tbody>
            {Object.keys(gradeOrganizada).reverse().map(hora => (
              <tr key={hora} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px', fontWeight: 'bold', background: '#f8f9fa', textAlign: 'center', borderRight: '2px solid #ddd' }}>{hora}h</td>
                {cols.map(col => {
                  const jogo = gradeOrganizada[hora][col]
                  const p = extrairPlacar(jogo, col)
                  const background = p?.over25 ? '#e8f5e9' : p?.over15 ? '#fff9c4' : '#fff'
                  return (
                    <td key={col} style={{ padding: '8px', textAlign: 'center', border: '1px solid #eee', background }}>
                      <span style={{ fontWeight: p?.over25 ? 'bold' : 'normal', color: p?.over25 ? '#2e7d32' : '#333' }}>
                        {p ? p.texto : '-'}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
