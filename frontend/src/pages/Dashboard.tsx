import { useState, useEffect } from 'react'
import GradeResultados from '../components/GradeResultados'
import Estatisticas from '../components/Estatisticas'
import Sequencias from '../components/Sequencias'
import Sugestoes from '../components/Sugestoes'

function Dashboard() {
  const [ligaSelecionada, setLigaSelecionada] = useState('Express Cup')
  const [resultados, setResultados] = useState([])
  const [analise, setAnalise] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)

  const ligas = [
    'Express Cup',
    'Copa do Mundo',
    'Euro Cup',
    'Super Liga Sul-Americana',
    'Premier League',
  ]

  useEffect(() => {
    buscarDados()
    const intervalo = setInterval(buscarDados, 60 * 1000)
    return () => clearInterval(intervalo)
  }, [ligaSelecionada])

  async function buscarDados() {
    try {
      setCarregando(true)
      const API = (import.meta as any).env.VITE_API_URL

      const [resResultados, resAnalise] = await Promise.all([
        fetch(`${API}/resultados?liga=${encodeURIComponent(ligaSelecionada)}`),
        fetch(`${API}/analise?liga=${encodeURIComponent(ligaSelecionada)}`),
      ])

      const dadosResultados = await resResultados.json()
      const dadosAnalise = await resAnalise.json()

      setResultados(dadosResultados)
      setAnalise(dadosAnalise)
    } catch (erro) {
      console.error('Erro ao buscar dados:', erro)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#00ff88' }}>
            ⚽ BetGol
          </h1>
          <span style={{ color: '#888', fontSize: '14px' }}>Análise de Futebol Virtual</span>
        </div>
        <div style={{ fontSize: '12px', color: '#555', background: '#1a1d27', padding: '6px 12px', borderRadius: '20px' }}>
          🔄 Atualiza a cada 1 min
        </div>
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
          <Sugestoes analise={analise} liga={ligaSelecionada} />
          <GradeResultados resultados={resultados} />
          <Estatisticas resultados={resultados} />
          <Sequencias resultados={resultados} />
        </div>
      )}
    </div>
  )
}

export default Dashboard
