import { useState, useEffect } from 'react'
import { Partida } from '../pages/Dashboard'

interface Props {
  linhas: Partida[]
  colunas?: string[]
}

interface Analise {
  totalPartidas: number
  over05: number; over15: number; over25: number; over35: number
  under15: number; under25: number; under35: number
  ambasSim: number; ambasNao: number
  casa: number; empate: number; fora: number
  sequenciaAtual: string
  sequenciaTamanho: number
  placaresMaisFrequentes: { placar: string; count: number }[]
  mediagols: number
  previsao: {
    mercado: string
    probabilidade: number
    confianca: 'ALTA' | 'MEDIA' | 'BAIXA'
    motivo: string
  }[]
}

const HORARIOS_DEFAULT = ['01','04','07','10','13','16','19','22','25','28','31','34','37','40','43','46','49','52','55','58']

function extrairPlacar(val: string | null): { casa: number; fora: number } | null {
  if (!val) return null
  const linha = val.split('</br>')[0].split('<br>')[0].split('\n')[0]
  const m = linha.match(/(\d+)\s*-\s*(\d+)/)
  if (!m) return null
  return { casa: parseInt(m[1]), fora: parseInt(m[2]) }
}

function analisarPartidas(linhas: Partida[], colunas: string[]): Analise {
  const ultimas24 = linhas.slice(0, 24)
  const placares: { casa: number; fora: number }[] = []

  ultimas24.forEach(linha => {
    colunas.forEach(col => {
      const p = extrairPlacar(linha[col] as string)
      if (p) placares.push(p)
    })
  })

  const total = placares.length
  if (total === 0) return gerarAnaliseVazia()

  // Contadores
  let over05 = 0, over15 = 0, over25 = 0, over35 = 0
  let under15 = 0, under25 = 0, under35 = 0
  let ambasSim = 0, ambasNao = 0
  let casa = 0, empate = 0, fora = 0
  let totalGols = 0
  const contagemPlacares: Record<string, number> = {}

  placares.forEach(p => {
    const gols = p.casa + p.fora
    totalGols += gols
    if (gols > 0.5) over05++
    if (gols > 1.5) over15++
    if (gols > 2.5) over25++
    if (gols > 3.5) over35++
    if (gols < 1.5) under15++
    if (gols < 2.5) under25++
    if (gols < 3.5) under35++
    if (p.casa > 0 && p.fora > 0) ambasSim++
    else ambasNao++
    if (p.casa > p.fora) casa++
    else if (p.casa === p.fora) empate++
    else fora++
    const key = `${p.casa}-${p.fora}`
    contagemPlacares[key] = (contagemPlacares[key] || 0) + 1
  })

  // Sequência atual (últimas partidas em ordem)
  const ultimasPartidas: { casa: number; fora: number }[] = []
  for (const linha of ultimas24.slice(0, 5)) {
    for (const col of colunas) {
      const p = extrairPlacar(linha[col] as string)
      if (p) ultimasPartidas.push(p)
    }
  }

  // Detectar sequência atual
  let sequenciaAtual = ''
  let sequenciaTamanho = 0
  const recentes = ultimasPartidas.slice(0, 10).reverse()
  for (const p of recentes) {
    const gols = p.casa + p.fora
    const tipo = gols > 2.5 ? 'OVER' : 'UNDER'
    if (sequenciaAtual === '') {
      sequenciaAtual = tipo
      sequenciaTamanho = 1
    } else if (tipo === sequenciaAtual) {
      sequenciaTamanho++
    } else {
      break
    }
  }

  // Placares mais frequentes
  const placaresMaisFrequentes = Object.entries(contagemPlacares)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([placar, count]) => ({ placar, count }))

  const pctOver25 = Math.round((over25 / total) * 100)
  const pctUnder25 = Math.round((under25 / total) * 100)
  const pctAmbasSim = Math.round((ambasSim / total) * 100)
  const pctCasa = Math.round((casa / total) * 100)
  const pctEmpate = Math.round((empate / total) * 100)
  const pctFora = Math.round((fora / total) * 100)

  // Gerar previsões com base nos padrões
  const previsao: Analise['previsao'] = []

  // Over/Under
  const overConfianca = sequenciaAtual === 'UNDER' && sequenciaTamanho >= 3
    ? 'ALTA' : pctOver25 > 55 ? 'MEDIA' : 'BAIXA'
  previsao.push({
    mercado: 'OVER 2.5',
    probabilidade: sequenciaAtual === 'UNDER' && sequenciaTamanho >= 3
      ? Math.min(pctOver25 + (sequenciaTamanho * 5), 90)
      : pctOver25,
    confianca: overConfianca,
    motivo: sequenciaAtual === 'UNDER' && sequenciaTamanho >= 3
      ? `${sequenciaTamanho} UNDERs seguidos — correção esperada`
      : `${pctOver25}% das partidas foram OVER 2.5 nas últimas 24h`,
  })

  previsao.push({
    mercado: 'UNDER 2.5',
    probabilidade: sequenciaAtual === 'OVER' && sequenciaTamanho >= 3
      ? Math.min(pctUnder25 + (sequenciaTamanho * 5), 90)
      : pctUnder25,
    confianca: sequenciaAtual === 'OVER' && sequenciaTamanho >= 3
      ? 'ALTA' : pctUnder25 > 55 ? 'MEDIA' : 'BAIXA',
    motivo: sequenciaAtual === 'OVER' && sequenciaTamanho >= 3
      ? `${sequenciaTamanho} OVERs seguidos — correção esperada`
      : `${pctUnder25}% das partidas foram UNDER 2.5 nas últimas 24h`,
  })

  previsao.push({
    mercado: 'AMBAS MARCAM SIM',
    probabilidade: pctAmbasSim,
    confianca: pctAmbasSim > 60 ? 'ALTA' : pctAmbasSim > 45 ? 'MEDIA' : 'BAIXA',
    motivo: `${pctAmbasSim}% das partidas tiveram ambas marcando`,
  })

  previsao.push({
    mercado: 'VITÓRIA CASA',
    probabilidade: pctCasa,
    confianca: pctCasa > 50 ? 'MEDIA' : 'BAIXA',
    motivo: `${pctCasa}% de vitórias da casa nas últimas 24h`,
  })

  previsao.push({
    mercado: 'EMPATE',
    probabilidade: pctEmpate,
    confianca: pctEmpate > 30 ? 'MEDIA' : 'BAIXA',
    motivo: `${pctEmpate}% de empates nas últimas 24h`,
  })

  previsao.push({
    mercado: 'VITÓRIA FORA',
    probabilidade: pctFora,
    confianca: pctFora > 40 ? 'MEDIA' : 'BAIXA',
    motivo: `${pctFora}% de vitórias visitantes nas últimas 24h`,
  })

  // Ordenar por probabilidade
  previsao.sort((a, b) => b.probabilidade - a.probabilidade)

  return {
    totalPartidas: total,
    over05: Math.round((over05 / total) * 100),
    over15: Math.round((over15 / total) * 100),
    over25: pctOver25,
    over35: Math.round((over35 / total) * 100),
    under15: Math.round((under15 / total) * 100),
    under25: pctUnder25,
    under35: Math.round((under35 / total) * 100),
    ambasSim: pctAmbasSim,
    ambasNao: Math.round((ambasNao / total) * 100),
    casa: pctCasa,
    empate: pctEmpate,
    fora: pctFora,
    sequenciaAtual,
    sequenciaTamanho,
    placaresMaisFrequentes,
    mediagols: Math.round((totalGols / total) * 10) / 10,
    previsao,
  }
}

function gerarAnaliseVazia(): Analise {
  return {
    totalPartidas: 0, over05: 0, over15: 0, over25: 0, over35: 0,
    under15: 0, under25: 0, under35: 0, ambasSim: 0, ambasNao: 0,
    casa: 0, empate: 0, fora: 0, sequenciaAtual: '', sequenciaTamanho: 0,
    placaresMaisFrequentes: [], mediagols: 0, previsao: [],
  }
}

function BarraProgresso({ pct, cor }: { pct: number; cor: string }) {
  return (
    <div style={{ background: '#1a1a25', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        background: cor, borderRadius: '4px',
        transition: 'width 0.5s ease',
      }} />
    </div>
  )
}

const COR_CONFIANCA = {
  ALTA: '#00ff88',
  MEDIA: '#f5c518',
  BAIXA: '#e8334a',
}

export default function IATendencia({ linhas, colunas }: Props) {
  const [analise, setAnalise] = useState<Analise>(gerarAnaliseVazia())
  const cols = colunas && colunas.length > 0 ? colunas : HORARIOS_DEFAULT

  useEffect(() => {
    if (linhas.length > 0) {
      setAnalise(analisarPartidas(linhas, cols))
    }
  }, [linhas, colunas])

  if (analise.totalPartidas === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#8888aa' }}>
        Sem dados suficientes para análise
      </div>
    )
  }

  return (
    <div>
      {/* HEADER */}
      <div style={{
        background: '#12121a', border: '1px solid #2a2a3a',
        borderRadius: '8px', padding: '16px', marginBottom: '14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '12px',
      }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8888aa', letterSpacing: '2px', marginBottom: '4px' }}>
            IA TENDÊNCIA
          </div>
          <div style={{ fontSize: '13px', color: '#e0e0f0' }}>
            Análise das últimas 24h · <span style={{ color: '#00ff88' }}>{analise.totalPartidas} partidas</span>
          </div>
        </div>
        {analise.sequenciaAtual && (
          <div style={{
            background: analise.sequenciaAtual === 'OVER' ? '#e8334a22' : '#1a6fff22',
            border: `1px solid ${analise.sequenciaAtual === 'OVER' ? '#e8334a' : '#1a6fff'}`,
            borderRadius: '6px', padding: '8px 14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '11px', color: '#8888aa', marginBottom: '2px' }}>SEQUÊNCIA ATUAL</div>
            <div style={{
              fontSize: '20px', fontWeight: 'bold',
              color: analise.sequenciaAtual === 'OVER' ? '#e8334a' : '#1a6fff',
            }}>
              {analise.sequenciaTamanho}x {analise.sequenciaAtual}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>

        {/* PREVISÕES */}
        <div style={{
          background: '#12121a', border: '1px solid #2a2a3a',
          borderRadius: '8px', padding: '16px',
        }}>
          <div style={{ fontSize: '11px', color: '#8888aa', letterSpacing: '2px', marginBottom: '14px' }}>
            PREVISÃO PRÓXIMA PARTIDA
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {analise.previsao.map((p, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 'bold', padding: '2px 6px',
                      borderRadius: '3px', background: COR_CONFIANCA[p.confianca] + '22',
                      color: COR_CONFIANCA[p.confianca], letterSpacing: '1px',
                    }}>
                      {p.confianca}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#e0e0f0' }}>
                      {p.mercado}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '18px', fontWeight: 'bold',
                    color: p.probabilidade >= 60 ? '#00ff88' : p.probabilidade >= 45 ? '#f5c518' : '#8888aa',
                  }}>
                    {p.probabilidade}%
                  </span>
                </div>
                <BarraProgresso
                  pct={p.probabilidade}
                  cor={p.probabilidade >= 60 ? '#00ff88' : p.probabilidade >= 45 ? '#f5c518' : '#e8334a'}
                />
                <div style={{ fontSize: '11px', color: '#8888aa', marginTop: '3px' }}>
                  {p.motivo}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* OVER/UNDER */}
          <div style={{
            background: '#12121a', border: '1px solid #2a2a3a',
            borderRadius: '8px', padding: '16px',
          }}>
            <div style={{ fontSize: '11px', color: '#8888aa', letterSpacing: '2px', marginBottom: '12px' }}>
              OVER / UNDER (24H)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { label: 'Over 0.5', pct: analise.over05, cor: '#00ff88' },
                { label: 'Under 1.5', pct: analise.under15, cor: '#1a6fff' },
                { label: 'Over 1.5', pct: analise.over15, cor: '#00ff88' },
                { label: 'Under 2.5', pct: analise.under25, cor: '#1a6fff' },
                { label: 'Over 2.5', pct: analise.over25, cor: '#00ff88' },
                { label: 'Under 3.5', pct: analise.under35, cor: '#1a6fff' },
                { label: 'Over 3.5', pct: analise.over35, cor: '#00ff88' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                    <span style={{ color: '#8888aa' }}>{item.label}</span>
                    <span style={{ color: item.cor, fontWeight: 'bold' }}>{item.pct}%</span>
                  </div>
                  <BarraProgresso pct={item.pct} cor={item.cor} />
                </div>
              ))}
            </div>
          </div>

          {/* RESULTADO + AMBAS */}
          <div style={{
            background: '#12121a', border: '1px solid #2a2a3a',
            borderRadius: '8px', padding: '16px',
          }}>
            <div style={{ fontSize: '11px', color: '#8888aa', letterSpacing: '2px', marginBottom: '12px' }}>
              RESULTADO + AMBAS (24H)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Casa', pct: analise.casa, cor: '#00ff88' },
                { label: 'Empate', pct: analise.empate, cor: '#f5c518' },
                { label: 'Fora', pct: analise.fora, cor: '#1a6fff' },
                { label: 'Ambas Sim', pct: analise.ambasSim, cor: '#e8334a' },
                { label: 'Ambas Não', pct: analise.ambasNao, cor: '#8888aa' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                    <span style={{ color: '#8888aa' }}>{item.label}</span>
                    <span style={{ color: item.cor, fontWeight: 'bold' }}>{item.pct}%</span>
                  </div>
                  <BarraProgresso pct={item.pct} cor={item.cor} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PLACARES MAIS FREQUENTES + MÉDIA */}
        <div style={{
          background: '#12121a', border: '1px solid #2a2a3a',
          borderRadius: '8px', padding: '16px',
        }}>
          <div style={{ fontSize: '11px', color: '#8888aa', letterSpacing: '2px', marginBottom: '12px' }}>
            PLACARES MAIS FREQUENTES (24H)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {analise.placaresMaisFrequentes.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  background: '#e8334a', color: '#fff',
                  padding: '4px 10px', borderRadius: '4px',
                  fontWeight: 'bold', fontSize: '14px',
                  minWidth: '50px', textAlign: 'center',
                }}>
                  {p.placar}
                </span>
                <div style={{ flex: 1 }}>
                  <BarraProgresso
                    pct={Math.round((p.count / analise.totalPartidas) * 100)}
                    cor='#e8334a'
                  />
                </div>
                <span style={{ fontSize: '12px', color: '#8888aa', minWidth: '30px', textAlign: 'right' }}>
                  {p.count}x
                </span>
              </div>
            ))}
          </div>
          <div style={{
            background: '#1a1a25', borderRadius: '6px',
            padding: '12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '11px', color: '#8888aa', letterSpacing: '1px', marginBottom: '4px' }}>
              MÉDIA DE GOLS
            </div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f5c518' }}>
              {analise.mediagols}
            </div>
            <div style={{ fontSize: '11px', color: '#8888aa' }}>por partida nas últimas 24h</div>
          </div>
        </div>
      </div>
    </div>
  )
}
