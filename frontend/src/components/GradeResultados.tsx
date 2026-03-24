import { useState } from 'react'
import { Partida } from '../pages/Dashboard'

interface Props {
  linhas: Partida[]
  colunas: string[]
}

interface Filtros {
  over: string
  under: string
  ambas: string
  resultado: string
}

const HORARIOS = ['01','04','07','10','13','16','19','22','25','28','31','34','37','40','43','46','49','52','55','58']

function extrairPlacar(val: string | null): { casa: number; fora: number; texto: string } | null {
  if (!val) return null
  const linha = val.split('<br>')[0].split('\n')[0]
  const m = linha.match(/(\d+)\s*-\s*(\d+)/)
  if (!m) return null
  return { casa: parseInt(m[1]), fora: parseInt(m[2]), texto: `${m[1]}-${m[2]}` }
}

function verificarFiltro(placar: { casa: number; fora: number }, filtros: Filtros): boolean {
  const { casa, fora } = placar
  const total = casa + fora

  if (filtros.over) {
    const n = parseFloat(filtros.over)
    if (total <= n) return false
  }
  if (filtros.under) {
    const n = parseFloat(filtros.under)
    if (total >= n) return false
  }
  if (filtros.ambas === 'sim' && !(casa > 0 && fora > 0)) return false
  if (filtros.ambas === 'nao' && casa > 0 && fora > 0) return false
  if (filtros.resultado === 'casa' && casa <= fora) return false
  if (filtros.resultado === 'empate' && casa !== fora) return false
  if (filtros.resultado === 'fora' && fora <= casa) return false

  return true
}

export default function GradeResultados({ linhas }: Props) {
  const [filtros, setFiltros] = useState<Filtros>({ over: '', under: '', ambas: '', resultado: '' })
  const [filtrosAtivos, setFiltrosAtivos] = useState<Filtros>({ over: '', under: '', ambas: '', resultado: '' })

  const temFiltro = Object.values(filtrosAtivos).some(v => v !== '')

  // Calcular stats
  let totalCelulas = 0
  let totalDestaque = 0
  linhas.forEach(linha => {
    HORARIOS.forEach(h => {
      const placar = extrairPlacar(linha[`tempo${h}`] as string)
      if (placar) {
        totalCelulas++
        if (temFiltro && verificarFiltro(placar, filtrosAtivos)) totalDestaque++
      }
    })
  })
  const pct = totalCelulas > 0 ? Math.round((totalDestaque / totalCelulas) * 100) : 0

  function aplicar() {
    setFiltrosAtivos({ ...filtros })
  }

  function limpar() {
    const vazio = { over: '', under: '', ambas: '', resultado: '' }
    setFiltros(vazio)
    setFiltrosAtivos(vazio)
  }

  const selectStyle: React.CSSProperties = {
    background: '#1a1a25',
    border: '1px solid #2a2a3a',
    color: '#e0e0f0',
    padding: '6px 10px',
    fontSize: '13px',
    borderRadius: '4px',
    outline: 'none',
    cursor: 'pointer',
  }

  return (
    <div>
      {/* FILTROS */}
      <div style={{
        background: '#12121a',
        border: '1px solid #2a2a3a',
        borderRadius: '8px',
        padding: '14px 16px',
        marginBottom: '14px',
      }}>
        <div style={{ fontSize: '11px', color: '#8888aa', letterSpacing: '2px', marginBottom: '10px' }}>
          FILTROS
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#8888aa', fontWeight: 'bold' }}>OVER</span>
            <select style={selectStyle} value={filtros.over} onChange={e => setFiltros(f => ({ ...f, over: e.target.value }))}>
              <option value="">—</option>
              <option value="0.5">0.5</option>
              <option value="1.5">1.5</option>
              <option value="2.5">2.5</option>
              <option value="3.5">3.5</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#8888aa', fontWeight: 'bold' }}>UNDER</span>
            <select style={selectStyle} value={filtros.under} onChange={e => setFiltros(f => ({ ...f, under: e.target.value }))}>
              <option value="">—</option>
              <option value="1.5">1.5</option>
              <option value="2.5">2.5</option>
              <option value="3.5">3.5</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#8888aa', fontWeight: 'bold' }}>AMBAS</span>
            <select style={selectStyle} value={filtros.ambas} onChange={e => setFiltros(f => ({ ...f, ambas: e.target.value }))}>
              <option value="">—</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#8888aa', fontWeight: 'bold' }}>RESULTADO</span>
            <select style={selectStyle} value={filtros.resultado} onChange={e => setFiltros(f => ({ ...f, resultado: e.target.value }))}>
              <option value="">—</option>
              <option value="casa">Casa</option>
              <option value="empate">Empate</option>
              <option value="fora">Fora</option>
            </select>
          </div>
          <button
            onClick={aplicar}
            style={{
              background: '#f5c518', color: '#000',
              border: 'none', padding: '7px 18px',
              fontWeight: 'bold', fontSize: '13px',
              letterSpacing: '1px', borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            FILTRAR
          </button>
          <button
            onClick={limpar}
            style={{
              background: 'transparent', color: '#8888aa',
              border: '1px solid #2a2a3a', padding: '7px 14px',
              fontSize: '13px', borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            LIMPAR
          </button>
        </div>
      </div>

      {/* STATS */}
      {temFiltro && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {[
            { valor: totalCelulas, label: 'PARTIDAS' },
            { valor: totalDestaque, label: 'DESTAQUES' },
            { valor: pct + '%', label: 'TAXA FILTRO' },
          ].map(s => (
            <div key={s.label} style={{
              background: '#12121a', border: '1px solid #2a2a3a',
              borderRadius: '6px', padding: '10px 16px',
            }}>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#00ff88' }}>{s.valor}</div>
              <div style={{ fontSize: '11px', color: '#8888aa', letterSpacing: '1px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* INFO + LEGENDA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', color: '#8888aa' }}>{linhas.length} rodadas</span>
        <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: '#8888aa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: '#e8334a' }} />
            Normal
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: '#f5c518' }} />
            Filtrado
          </div>
        </div>
      </div>

      {/* GRADE */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{
                background: '#12121a', color: '#00ff88',
                padding: '8px 10px', border: '1px solid #2a2a3a',
                fontSize: '11px', letterSpacing: '1px',
                position: 'sticky', left: 0, zIndex: 2,
                minWidth: '50px',
              }}>
                HORA
              </th>
              {HORARIOS.map(h => (
                <th key={h} style={{
                  background: '#1a1a25', color: '#8888aa',
                  padding: '8px 6px', border: '1px solid #2a2a3a',
                  fontSize: '11px', letterSpacing: '1px',
                  minWidth: '58px', whiteSpace: 'nowrap',
                }}>
                  {h}min
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, idx) => (
              <tr key={idx}>
                <td style={{
                  background: '#1a1a25', color: '#00ff88',
                  padding: '3px 8px', border: '1px solid #2a2a3a',
                  fontWeight: 'bold', fontSize: '13px',
                  position: 'sticky', left: 0, zIndex: 1,
                  textAlign: 'center',
                }}>
                  {String(idx).padStart(2, '0')}
                </td>
                {HORARIOS.map(h => {
                  const val = linha[`tempo${h}`] as string | null
                  const placar = extrairPlacar(val)
                  const destaque = temFiltro && placar ? verificarFiltro(placar, filtrosAtivos) : false
                  return (
                    <td key={h} style={{
                      padding: '3px 4px',
                      border: '1px solid rgba(255,255,255,0.04)',
                      textAlign: 'center',
                    }}>
                      {placar ? (
                        <span
                          title={val?.replace(/<[^>]+>/g, ' ') || ''}
                          style={{
                            display: 'inline-block',
                            padding: '3px 6px',
                            borderRadius: '3px',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            letterSpacing: '0.5px',
                            background: destaque ? '#f5c518' : '#e8334a',
                            color: destaque ? '#000' : '#fff',
                            minWidth: '42px',
                            textAlign: 'center',
                            cursor: 'default',
                          }}
                        >
                          {placar.texto}
                        </span>
                      ) : (
                        <span style={{ color: '#2a2a3a', fontSize: '10px' }}>—</span>
                      )}
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
