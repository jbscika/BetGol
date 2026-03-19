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

function GradeResultados({ resultados }: Props) {
  function corCelula(casa: number, fora: number) {
    if (casa > fora) return '#1a5c2a'
    if (fora > casa) return '#5c1a1a'
    return '#5c4a1a'
  }

  function corTexto(casa: number, fora: number) {
    if (casa > fora) return '#00ff88'
    if (fora > casa) return '#ff4444'
    return '#ffaa00'
  }

  if (!resultados.length) {
    return (
      <div style={{ padding: '24px', background: '#1a1d27', borderRadius: '12px', textAlign: 'center', color: '#888' }}>
        Nenhum resultado encontrado
      </div>
    )
  }

  return (
    <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '20px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: '#fff' }}>
        📊 Grade de Resultados
      </h2>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {resultados.map((r, i) => (
            <div
              key={i}
              title={`Rodada ${r.rodada} — ${r.data}`}
              style={{
                width: '52px',
                height: '36px',
                borderRadius: '6px',
                background: corCelula(r.placar_casa, r.placar_fora),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 'bold',
                color: corTexto(r.placar_casa, r.placar_fora),
                cursor: 'default',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {r.placar_casa}-{r.placar_fora}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px', marginTop: '16px', fontSize: '12px' }}>
        <span style={{ color: '#00ff88' }}>■ Vitória Casa</span>
        <span style={{ color: '#ff4444' }}>■ Vitória Fora</span>
        <span style={{ color: '#ffaa00' }}>■ Empate</span>
      </div>
    </div>
  )
}

export default GradeResultados
