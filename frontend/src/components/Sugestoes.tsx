interface Sugestao {
  mercado: string
  entrada: string
  confianca: number
  historico: string
}

interface Analise {
  liga: string
  total_partidas: number
  atualizado: string
  sugestoes: Sugestao[]
  mensagem?: string
}

interface Props {
  analise: Analise | null
  liga: string
}

function Sugestoes({ analise, liga }: Props) {
  function corConfianca(pct: number) {
    if (pct >= 70) return '#00ff88'
    if (pct >= 55) return '#ffaa00'
    return '#ff4444'
  }

  function emojiMercado(mercado: string) {
    if (mercado === '1X2') return '⚽'
    if (mercado === 'Ambas Marcam') return '🥅'
    if (mercado === 'Gols') return '📊'
    if (mercado === 'Placar Correto') return '🎯'
    return '📌'
  }

  if (!analise) {
    return (
      <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: '#fff' }}>
          🤖 Sugestões de Entrada — {liga}
        </h2>
        <div style={{ color: '#888', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
          Aguardando dados... Abra a Bet365 com a extensão ativa para começar a coletar!
        </div>
      </div>
    )
  }

  if (analise.mensagem) {
    return (
      <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: '#fff' }}>
          🤖 Sugestões de Entrada — {liga}
        </h2>
        <div style={{ color: '#888', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
          {analise.mensagem}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>
          🤖 Sugestões de Entrada — {liga}
        </h2>
        <span style={{ fontSize: '11px', color: '#555' }}>
          Base: {analise.total_partidas} partidas
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {analise.sugestoes && analise.sugestoes.map((s, i) => (
          <div
            key={i}
            style={{
              background: '#0f1117',
              borderRadius: '10px',
              padding: '16px',
              borderLeft: `4px solid ${corConfianca(Number(s.confianca))}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#888', background: '#1a1d27', padding: '3px 8px', borderRadius: '20px' }}>
                {emojiMercado(s.mercado)} {s.mercado}
              </span>
              <span style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: corConfianca(Number(s.confianca)),
              }}>
                {s.confianca}%
              </span>
            </div>

            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>
              {s.entrada}
            </div>

            <div style={{ fontSize: '11px', color: '#555' }}>
              📈 Histórico: {s.historico}
            </div>

            <div style={{
              marginTop: '4px',
              height: '4px',
              background: '#1a1d27',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${s.confianca}%`,
                background: corConfianca(Number(s.confianca)),
                borderRadius: '2px',
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Sugestoes
