import { useState, useEffect } from 'react'
import GradeResultados from '../components/GradeResultados'
import Estatisticas from '../components/Estatisticas'
import Sequencias from '../components/Sequencias'

function Dashboard() {
  const [ligaSelecionada, setLigaSelecionada] = useState('Premier League Virtual')
  const [resultados, setResultados] = useState([])
  const [carregando, setCarregando] = useState(true)

  const ligas = [
    'Premier League Virtual',
    'Serie A Virtual',
    'La Liga Virtual',
    'Bundesliga Virtual',
  ]

  useEffect(() => {
    buscarDados()
    const intervalo = setInterval(buscarDados, 3 * 60 * 1000)
    return () => clearInterval(intervalo)
  }, [ligaSelecionada])

  async function buscarDados() {
    try {
      setCarregando(true)
      const resposta = await fetch(`${(import.meta as any).env.VITE_API_URL}/resultados?liga=${ligaSelecionada}`)
      const dados = await resposta.json()
      setResultados(dados)
    } catch (erro) {
      console.error('Erro ao buscar dados:', erro)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#00ff88' }}>
          ⚽ BetGol
        </h1>
        <span style={{ color: '#888', fontSize: '14px' }}>Análise de Futebol Virtual</span>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {ligas.map(liga => (
          <button
            key={liga}
            onClick={() => setLigaSelecionada(liga)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px',
              background: ligaSelecionada === liga ? '#00ff88' : '#1a1d27',
              color: ligaSelecionada === liga ? '#000' : '#fff',
              transition: 'all 0.2s',
            }}
          >
            {liga}
          </button>
        ))}
      </div>

      {carregando ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
          Carregando dados...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <GradeResultados resultados={resultados} />
          <Estatisticas resultados={resultados} />
          <Sequencias resultados={resultados} />
        </div>
      )}
    </div>
  )
}

export default Dashboard
