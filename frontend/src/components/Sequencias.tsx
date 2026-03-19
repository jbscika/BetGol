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

interface Sequencia {
  tipo: string
  quantidade: number
  cor: string
  emoji: string
}

function Sequencias({ resultados }: Props) {
  if (!resultados.length) return null

  const ultimos = [...resultados].slice(-20)

  function detectarSequencias(): Sequencia[] {
    const sequencias: Sequencia[] = []
    let tipoAtual = ''
    let contador = 0

    ultimos.forEach(r => {
      let tipo = ''
      if (r.placar_casa > r.placar_fora) tipo = 'Casa'
      else if (r.placar_fora > r.placar_casa) tipo = 'Fora'
      else tipo = 'Empate'

      if (tipo === tipoAtual) {
        contador++
      } else {
        if (contador >= 2) {
          sequencias.push({
            tipo: tipoAtual,
            quantidade: contador,
            cor: tipoAtual === 'Casa' ? '#00ff88' : tipoAtual === 'Fora' ? '#ff4444' : '#ffaa00',
            emoji: tipoAtual === 'Casa' ? '🏠' : tipoAtual === 'Fora' ? '✈️' : '🤝',
          })
        }
        tipoAtual = tipo
        contador = 1
      }
    })

    if (contador >= 2) {
      sequencias.push({
        tipo: tipoAtual,
        quantidade: contador,
        cor: tipoAtual === 'Casa' ? '#00ff88' : tipoAtual === 'Fora' ? '#ff4444' : '#ffaa00',
        emoji: tipoAtual === 'Casa' ? '🏠' : tipoAtual === 'Fora' ? '✈️' : '🤝',
      })
    }

    return sequencias
  }

  const sequencias = detectarSequencias()

  const ultimoResultado = ultimos[ultimos.length - 1]
  let tendencia = ''
  let corTendencia = ''
  if (ultimoResultado) {
    if (ultimoResultado.placar_casa > ultimoResultado.placar_fora) {
      tendencia = '🏠 Última: Vitória Casa'
      corTendencia = '#00ff88'
    } else if (ultimoResultado.placar_fora > ultimoResultado.placar_casa) {
      tendencia = '✈️ Última: Vitória Fora'
      corTendencia = '#ff4444'
    } else {
      tendencia = '🤝 Última: Empate'
      corTendencia = '#ffaa00'
    }
  }

  return (
    <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '20px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: '#fff' }}>
        🔁 Sequências detectadas (últimas 20 partidas)
      </h2>

      {tendencia && (
        <div style={{
          background: '#0f1117',
          borderRadius: '8px',
