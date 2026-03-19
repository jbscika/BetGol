interface Resultado {
  placar_casa: number
  placar_fora: number
  liga: string
  rodada: number
  data: string
}

interface Props {
  resultados: Resultado[]
}

function Estatisticas({ resultados }: Props) {
  if (!resultados.length) return null

  const total = resultados.length
  const vitoriasCasa = resultados.filter(r => r.placar_casa > r.placar_fora).length
  const vitoriasFora = resultados.filter(r => r.placar_fora > r.placar_casa).length
  const empates = resultados.filter(r => r.placar_casa === r.placar_fora).length

  const pctCasa = ((vitoriasCasa / total) * 100).toFixed(1)
  const pctFora = ((vitoriasForaTotal / total) * 100).toFixed(1)
  const pctEmpate = ((empates / total) * 100).toFixed(1)

  const placaresContagem: Record<string, number> = {}
  resultados.forEach(r => {
    const placar = `${r.placar_casa}-${r.placar_fora}`
    placaresContagem[placar] = (placaresContagem[placar] || 0) + 1
  })

  const placaresOrdenados = Object.entries(placaresContagem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const cards = [
    { label: 'Vitória Casa', valor: vitoriasCasa, pct: pctCasa, cor: '#00ff88' },
    { label: 'Vitória Fora', valor: vitoriasForaTotal, pct: pctFora, cor: '#ff4444' },
    { label: 'Empates', valor: empates, pct: pctEmpate, cor: '#ffaa00' },
  ]

  return (
    <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '20px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: '#fff' }}>
        📈 Estatísticas — {total} partidas
      </h2>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {cards.map(card => (
          <div
            key={card.label}
            style={{
              flex: '1',
              minWidth: '140px',
              background: '#0f1117',
              borderRadius: '10px',
              padding: '16px',
              borderLeft: `4px solid ${card.cor}`,
            }}
          >
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>{card.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: card.cor }}>{card.pct}%</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{card.valor} partidas</div>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#fff' }}>
        🏆 Placares mais frequentes
      </h3>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {placaresOrdenados.map(([placar, count]) => (
          <div
            key={placar}
            style={{
              background: '#0f1117',
              borderRadius: '8px',
              padding: '8px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>{placar}</span>
            <span style={{ fontSize: '11px', color: '#888' }}>{count}x</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Estatisticas
