import React, { useState, useMemo } from 'react'

// --- INTERFACES ---
export interface Partida {
  [key: string]: string | number | undefined;
}

interface Props {
  linhas: Partida[]
  colunas: string[]
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

// --- HELPERS DE LÓGICA ---
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

  colunas.forEach((col) => {
    const hist = linhas.map(l => extrairPlacar(l[col] as string)).filter(Boolean) as PlacarInfo[]
    if (hist.length < 5) return
    const n = hist.length

    let probFinal = 0
    let mercadoNome = "OVER 2.5"
    let motivo = ""

    // Se houver filtro ativo, a IA foca no filtro do usuário
    if (temFiltro) {
        probFinal = Math.round(hist.filter(p => passaFiltro(p, filtroAtivo)).length / n * 100)
        mercadoNome = "FILTRO"
        motivo = "Baseado nos critérios ativos"
    } else {
        // Lógicas diferentes por TIPO de IA
        switch(tipoIA) {
            case 1: // T1: MÉDIA GLOBAL (VOLUME)
                probFinal = Math.round(hist.filter(p => p.over25).length / n * 100)
                motivo = "Tendência Histórica"
                break;
            case 2: // T2: ANÁLISE DE SEQUÊNCIA (ATRASO)
                let seqSemOver = 0
                for (const p of hist) { if (!p.over25) seqSemOver++; else break }
                probFinal = seqSemOver >= 3 ? 88 : 45
                motivo = `${seqSemOver} jogos s/ Over`
                break;
            case 3: // T3: MOMENTO RECENTE (ÚLTIMOS 5)
                const ultimos5 = hist.slice(0, 5)
                probFinal = Math.round(ultimos5.filter(p => p.over25).length / 5 * 100)
                motivo = "Análise: Últimas 5h"
                break;
        }
    }

    resultado.push({
      minuto: col.replace('tempo', ''),
      mercado: mercadoNome,
      probabilidade: probFinal,
      confianca: 70 + (tipoIA * 5),
      motivo
    })
  })
  return resultado
}

// --- COMPONENTE PRINCIPAL ---
export default function GradeResultados({ linhas, colunas }: Props) {
  const [filtros, setFiltros] = useState({ ...FILTRO_VAZIO })
  const [filtrosAtivos, setFiltrosAtivos] = useState({ ...FILTRO_VAZIO })
  const [tipoIA, setTipoIA] = useState<1 | 2 | 3>(1)
  const [mostrarIA, setMostrarIA] = useState(true)

  const c = {
    bg1: '#080c0d', bg2: '#0d1214', bg3: '#131a1d', bg4: '#1a2328', borda: '#1e2d33',
    verde: '#1b3d2a', vermelho: '#3d1b1b', verdeClaro: '#00ff88', vermelhoClaro: '#ff4444',
    amarelo: '#ffd54f', azul: '#3498db', branco: '#ffffff'
  }

  const cols = colunas.length > 0 ? colunas : ['tempo01','tempo04','tempo07','tempo10','tempo13','tempo16','tempo19','tempo22','tempo25','tempo28','tempo31','tempo34','tempo37','tempo40','tempo43','tempo46','tempo49','tempo52','tempo55','tempo58']

  // LOGICA: SE FILTRO ATIVO -> 20 LINHAS. SENÃO -> TODAS.
  const isFiltrado = useMemo(() => Object.values(filtrosAtivos).some(v => v !== ''), [filtrosAtivos])
  const linhasExibidas = useMemo(() => isFiltrado ? linhas.slice(0, 20) : linhas, [linhas, isFiltrado])

  const colStats = useMemo(() => cols.map(col => {
    let total = 0, greens = 0
    linhasExibidas.forEach(linha => {
      const p = extrairPlacar(linha[col] as string)
      if (p) { total++; if (p.over25) greens++ }
    })
    return { col, total, greens, pct: total > 0 ? Math.round(greens / total * 100) : 0 }
  }), [linhasExibidas, cols])

  const tendencias = useMemo(() => {
    if (!mostrarIA || linhasExibidas.length < 2) return []
    return calcularIA(linhasExibidas, cols, tipoIA, filtrosAtivos)
  }, [linhasExibidas, cols, tipoIA, mostrarIA, filtrosAtivos])

  const melhores = useMemo(() => tendencias
    .filter(t => t.probabilidade >= 70)
    .sort((a, b) => b.probabilidade - a.probabilidade)
    .slice(0, 5), [tendencias])

  const horaAtual = new Date().getHours()

  return (
    <div style={{ background: c.bg1, color: c.branco, padding: '10px', borderRadius: '8px', fontFamily: 'sans-serif' }}>
      
      {/* HEADER STATS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ background: c.bg2, padding: '8px 15px', borderRadius: '4px', border: `1px solid ${c.borda}` }}>
           <span style={{ fontSize: '12px', fontWeight: 'bold' }}>MÉDIA GREENS: <span style={{ color: c.verdeClaro }}>42%</span></span>
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={() => setMostrarIA(!mostrarIA)} style={{ background: mostrarIA ? c.verde : c.bg4, color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>IA ON</button>
            {[1, 2, 3].map(t => (
                <button key={t} onClick={() => setTipoIA(t as any)} style={{ background: tipoIA === t ? c.azul : c.bg4, color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>TIPO {t}</button>
            ))}
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div style={{ background: c.bg2, padding: '10px', borderRadius: '6px', display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '10px', border: `1px solid ${c.borda}` }}>
        <span style={{ fontSize: '11px', color: '#607d8b', fontWeight: 'bold' }}>FILTROS</span>
        <select value={filtros.over} onChange={e => setFiltros({...filtros, over: e.target.value})} style={{ background: c.bg4, color: '#fff', border: 'none', padding: '4px' }}>
            <option value="">OVER</option><option value="1.5">1.5</option><option value="2.5">2.5</option>
        </select>
        <select value={filtros.under} onChange={e => setFiltros({...filtros, under: e.target.value})} style={{ background: c.bg4, color: '#fff', border: 'none', padding: '4px' }}>
            <option value="">UNDER</option><option value="2.5">2.5</option><option value="3.5">3.5</option>
        </select>
        <button onClick={() => setFiltrosAtivos({...filtros})} style={{ background: c.verdeClaro, color: '#000', border: 'none', padding: '6px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>FILTRAR</button>
        <button onClick={() => {setFiltros({...FILTRO_VAZIO}); setFiltrosAtivos({...FILTRO_VAZIO})}} style={{ background: 'transparent', color: '#607d8b', border: 'none', cursor: 'pointer' }}>LIMPAR</button>
      </div>

      {/* MELHORES ENTRADAS */}
      {mostrarIA && melhores.length > 0 && (
        <div style={{ border: `1px solid ${c.verdeClaro}`, borderRadius: '6px', padding: '10px', marginBottom: '15px', background: '#0a1a11' }}>
          <div style={{ color: c.verdeClaro, fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }}>● MELHORES ENTRADAS</div>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
            {melhores.map((t, i) => (
              <div key={i} style={{ background: c.bg3, padding: '8px', borderRadius: '4px', minWidth: '120px', border: `1px solid ${c.borda}` }}>
                <div style={{ fontSize: '10px' }}>MIN {t.minuto}</div>
                <div style={{ color: c.amarelo, fontWeight: 'bold', fontSize: '11px' }}>{t.mercado}</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: c.azul }}>{t.probabilidade}%</div>
                <div style={{ fontSize: '9px', opacity: 0.6 }}>{t.motivo}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABELA */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
          <thead>
            <tr style={{ background: c.bg2 }}>
              <th style={{ border: `1px solid ${c.borda}`, padding: '8px', color: c.verdeClaro }}>H</th>
              {colStats.map(cs => (
                <th key={cs.col} style={{ border: `1px solid ${c.borda}`, padding: '4px' }}>
                  <div style={{ color: cs.pct >= 50 ? c.verdeClaro : c.vermelhoClaro }}>{cs.pct}%</div>
                  <div style={{ fontSize: '8px', opacity: 0.5 }}>{cs.total}</div>
                </th>
              ))}
              <th style={{ border: `1px solid ${c.borda}`, padding: '4px' }}>%|GOLS</th>
            </tr>
          </thead>
          <tbody>
            {/* LINHA DA IA DE TENDÊNCIA */}
            {mostrarIA && (
                <tr style={{ background: 'rgba(52, 152, 219, 0.1)' }}>
                    <td style={{ border: `1px solid ${c.borda}`, color: c.azul, fontWeight: 'bold', textAlign: 'center' }}>IA T{tipoIA}</td>
                    {cols.map(col => {
                        const t = tendencias.find(x => `tempo${x.minuto}` === col)
                        return <td key={col} style={{ border: `1px solid ${c.borda}`, textAlign: 'center', color: c.azul, fontSize: '8px' }}>{t?.mercado || '--'}</td>
                    })}
                    <td style={{ border: `1px solid ${c.borda}` }}></td>
                </tr>
            )}
            {/* LINHAS DE RESULTADOS */}
            {linhasExibidas.map((linha, idx) => (
              <tr key={idx}>
                <td style={{ border: `1px solid ${c.borda}`, textAlign: 'center', fontWeight: 'bold', color: c.verdeClaro }}>{String((horaAtual - idx + 24) % 24).padStart(2, '0')}</td>
                {cols.map(col => {
                  const p = extrairPlacar(linha[col] as string)
                  const isGreen = p ? p.over25 : false
                  return (
                    <td key={col} style={{ border: `1px solid ${c.borda}`, padding: '2px' }}>
                      {p ? (
                        <div style={{ background: isGreen ? c.verde : c.vermelho, textAlign: 'center', borderRadius: '2px', padding: '4px 0', fontWeight: 'bold' }}>{p.texto}</div>
                      ) : <div style={{ textAlign: 'center' }}>-</div>}
                    </td>
                  )
                })}
                <td style={{ border: `1px solid ${c.borda}`, textAlign: 'center', fontWeight: 'bold' }}>
                    {/* Cálculo simples de % da linha apenas para exemplo */}
                    50%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
