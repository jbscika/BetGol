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
  sequencia?: number
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

  const histMap: Record<string, (PlacarInfo | null)[]> = {}
  colunas.forEach(col => {
    histMap[col] = []
    for (let i = 0; i < horas; i++) histMap[col].push(extrairPlacar(linhas[i]?.[col] as string))
  })

  colunas.forEach((col) => {
    const hist = histMap[col]
    const validos = hist.filter(Boolean) as PlacarInfo[]
    if (validos.length < 5) return

    const min = col.replace('tempo', '')
    const n = validos.length

    const pO15 = Math.round(validos.filter(p => p.over15).length / n * 100)
    const pO25 = Math.round(validos.filter(p => p.over25).length / n * 100)
    const pAmbas = Math.round(validos.filter(p => p.ambasSim).length / n * 100)
    const pCasa = Math.round(validos.filter(p => p.casaVence).length / n * 100)

    let seq = 0; let dir: boolean | null = null
    for (const p of hist) {
      if (!p) continue
      if (dir === null) { dir = p.over25; seq = 1 }
      else if (p.over25 === dir) seq++
      else break
    }

    let probFinal = 0
    let mercadoNome = ''

    if (temFiltro) {
      probFinal = Math.round(validos.filter(p => passaFiltro(p, filtroAtivo)).length / n * 100)
      mercadoNome = "FILTRO ATIVO"
    } else {
      const opcoes = [
        { nome: 'OVER 1.5', prob: pO15 },
        { nome: 'OVER 2.5', prob: pO25 },
        { nome: 'AMBAS SIM', prob: pAmbas },
        { nome: 'CASA', prob: pCasa },
      ].sort((a, b) => b.prob - a.prob)
      mercadoNome = opcoes[0].nome
      probFinal = opcoes[0].prob
    }

    resultado.push({
      minuto: min, mercado: mercadoNome,
      probabilidade: probFinal, confianca: 88,
      motivo: `Seq:${seq}`, sequencia: seq
    })
  })
  return resultado
}

export default function GradeResultados({ linhas, colunas }: Props) {
  const [filtrosAtivos] = useState({ ...FILTRO_VAZIO })
  const [tipoIA, setTipoIA] = useState<1 | 2 | 3>(1)
  const [mostrarIA, setMostrarIA] = useState(true)

  const cols = colunas.length > 0 ? colunas : ['tempo01','tempo04','tempo07','tempo10','tempo13','tempo16','tempo19','tempo22','tempo25','tempo28','tempo31','tempo34','tempo37','tempo40','tempo43','tempo46','tempo49','tempo52','tempo55','tempo58']

  const c = {
    bg2: '#0d1214', bg4: '#1a2328', borda: '#1e2d33',
    verde: '#3d604a', vermelho: '#8c3a3a', // Tons Suaves Restaurados
    verdeClaro: '#66bb6a', vermelhoClaro: '#ef5350',
    amarelo: '#ffd54f', azul: '#64b5f6',
  }

  const colStats = useMemo(() => cols.map(col => {
    let total = 0, greens = 0
    linhas.forEach(linha => {
      const p = extrairPlacar(linha[col] as string)
      if (p) { total++; if (p.over25) greens++ }
    })
    return { col, total, greens, pct: total > 0 ? Math.round(greens / total * 100) : 0 }
  }), [linhas, colunas])

  const linhaStats = useMemo(() => linhas.map((linha) => {
    let total = 0, greens = 0, totalGols = 0
    cols.forEach(col => {
      const p = extrairPlacar(linha[col] as string)
      if (p) { total++; totalGols += p.gols; if (p.over25) greens++ }
    })
    return { total, greens, pct: total > 0 ? Math.round(greens / total * 100) : 0, totalGols }
  }), [linhas, colunas])

  const tendencias = useMemo(() => {
    if (!mostrarIA || linhas.length < 5) return []
    return calcularIA(linhas, cols, tipoIA, filtrosAtivos)
  }, [linhas, colunas, tipoIA, mostrarIA, filtrosAtivos])

  const melhores = tendencias.filter(t => t.probabilidade >= 70).sort((a, b) => b.probabilidade - a.probabilidade).slice(0, 5)

  const agora = new Date()
  const horaAtual = agora.getHours()
  const minAtual = agora.getMinutes()
  function proximaHora(minuto: string): string {
    const minNum = parseInt(minuto)
    const h = minNum > minAtual ? horaAtual : (horaAtual + 1) % 24
    return `${String(h).padStart(2, '0')}:${String(minNum).padStart(2, '0')}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {/* HEADER STATS */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
         <button onClick={() => setMostrarIA(!mostrarIA)} style={{ background: mostrarIA ? c.verdeClaro : c.bg4, color: mostrarIA ? '#000' : '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>IA {mostrarIA ? 'ON' : 'OFF'}</button>
         {[1, 2, 3].map(t => (
           <button key={t} onClick={() => setTipoIA(t as any)} style={{ background: tipoIA === t ? c.azul : c.bg4, color: tipoIA === t ? '#000' : '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>TIPO {t}</button>
         ))}
      </div>

      {/* MELHORES ENTRADAS - RESTAURADO CONFORME IMAGEM */}
      {mostrarIA && melhores.length > 0 && (
        <div style={{ background: '#0a1a11', border: `2px solid ${c.verdeClaro}`, borderRadius: '8px', padding: '10px', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.verdeClaro }}></div>
            <span style={{ color: c.verdeClaro, fontWeight: 'bold', fontSize: '12px' }}>MELHORES ENTRADAS — PRÓXIMA PARTIDA</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {melhores.map((t, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${c.verdeClaro}44`, borderRadius: '6px', padding: '8px', minWidth: '140px', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#fff', marginBottom: '4px' }}>
                  <span>MIN {t.minuto}</span>
                  <span style={{ color: c.amarelo }}>➔ {proximaHora(t.minuto)}</span>
                </div>
                <div style={{ color: c.amarelo, fontWeight: 'bold', fontSize: '11px' }}>{t.mercado}</div>
                <div style={{ color: c.azul, fontSize: '18px', fontWeight: '900' }}>{t.probabilidade}%</div>
                <div style={{ fontSize: '9px', color: c.verdeClaro, marginTop: '2px' }}>Conf: {t.confianca}%</div>
                <div style={{ fontSize: '9px', color: '#ffffff99' }}>{t.motivo}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '8px', fontSize: '10px', color: c.amarelo }}>⚠️ Aposte apenas quando prob ≥ 65% E confiança ≥ 70%</div>
        </div>
      )}

      {/* GRADE DE RESULTADOS */}
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '800px' }}>
          <thead>
            <tr style={{ background: c.bg2 }}>
              <th style={{ border: `1px solid ${c.borda}`, padding: '4px', color: c.verdeClaro, fontSize: '10px' }}>H</th>
              {colStats.map(cs => (
                <th key={cs.col} style={{ border: `1px solid ${c.borda}`, padding: '4px', textAlign: 'center' }}>
                  <div style={{ color: cs.pct >= 50 ? c.verdeClaro : c.vermelhoClaro, fontSize: '10px' }}>{cs.pct}%</div>
                  <div style={{ color: '#fff', fontSize: '8px' }}>{cs.total}</div>
                </th>
              ))}
              <th style={{ border: `1px solid ${c.borda}`, padding: '4px', color: '#fff', fontSize: '9px' }}>%|GOLS</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, idx) => (
              <tr key={idx} style={{ height: '22px' }}>
                <td style={{ border: `1px solid ${c.borda}`, textAlign: 'center', color: c.verdeClaro, fontSize: '10px', fontWeight: 'bold' }}>{String((horaAtual - idx + 24) % 24).padStart(2, '0')}</td>
                {cols.map(col => {
                  const p = extrairPlacar(linha[col] as string)
                  return (
                    <td key={col} style={{ border: `1px solid ${c.borda}`, textAlign: 'center', padding: '1px' }}>
                      {p ? (
                        <div style={{ background: p.over25 ? c.verde : c.vermelho, color: '#fff', fontSize: '10px', fontWeight: 'bold', borderRadius: '2px', padding: '2px 0' }}>{p.texto}</div>
                      ) : '-'}
                    </td>
                  )
                })}
                <td style={{ border: `1px solid ${c.borda}`, textAlign: 'center', fontSize: '10px' }}>
                  <span style={{ color: linhaStats[idx].pct >= 50 ? c.verdeClaro : c.vermelhoClaro, fontWeight: 'bold' }}>{linhaStats[idx].pct}%</span>
                  <span style={{ color: '#fff', fontSize: '8px' }}> {linhaStats[idx].totalGols}g</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
