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

    ultimos.forEach((r) => {
      let tipo = ''
      if (r.placar_casa > r.placar_fora) tipo = 'Casa'
      else if (r.placar_fora > r.placar_casa) tipo = 'Fora'
      else tipo = 'Empate'

      if (tipo === tipoAtual) {
        contador++
      } else {
