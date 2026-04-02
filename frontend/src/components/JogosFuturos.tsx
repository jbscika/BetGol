import { useMemo } from 'react'
import { Partida } from '../pages/Dashboard'

interface Props {
  linhas: Partida[]
  colunas: string[]
}

export default function JogosFuturos({ linhas, colunas }: Props) {
  const jogosProjetados = useMemo(() => {
    if (!linhas || linhas.length === 0) return []

    const stats: Record<string, { j: number; o25: number; amb: number }> = {}
    const futuros: any[] = []

    // 1. MAPEIA O HISTÓRICO COMPLETO (Para ter dados de todos os times da grade)
    linhas.forEach(linha => {
      colunas.forEach(col => {
        const val = linha[col] as string
        if (!val || !val.includes('-')) return 
        
        // Limpa HTML e pega os nomes e placar
        const texto = val.replace(/<[^>]*>/g, ' ').trim()
        const m = texto.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/)
        if (!m) return

        const tA = m[1].trim().toLowerCase()
        const tB = m[4].trim().toLowerCase()
        const gA = parseInt(m[2]), gB = parseInt(m[3])
        
        const reg = (t: string, f: number, s: number) => {
          if (!stats[t]) stats[t] = { j: 0, o25: 0, amb: 0 }
          stats[t].j++
          if (f + s > 2.5) stats[t].o25++
          if (f > 0 && s > 0) stats[t].amb++
        }
        reg(tA, gA, gB); reg(tB, gB, gA)
      })
    })

    // 2. BUSCA ATIVA POR QUALQUER JOGO SEM PLACAR (Varre as 3 primeiras linhas)
    linhas.slice(0, 3).forEach(linha => {
      colunas.forEach(col => {
        const val = (linha[col] as string) || ''
        
        // REGRA: Se não tem o traço "-" entre números, é um jogo que vai acontecer
        const temPlacar = /\d\s*-\s*\d/.test(val)
        
        if (!temPlacar && val.length > 5) {
          const textoLimpo = val.replace(/<[^>]*>/g, ' ').trim()
          // Divide por "v", "x", "vs" ou espaços duplos
          const partes = textoLimpo.split(/\s+(?:v|x|vs)\s+/i)
          
          if (partes.length >= 2) {
            const nomeA = partes[0].trim()
            const nomeB = partes[1].trim()
            const keyA = nomeA.toLowerCase()
            const keyB = nomeB.toLowerCase()

            // Calcula a probabilidade se tiver dados, senão baseia na média da liga
            const pOver = stats[keyA] && stats[keyB] 
              ? Math.round(((stats[keyA].o25 / stats[keyA].j) + (stats[keyB].o25 / stats[keyB].j)) / 2 * 100) 
              : 50 // Média padrão se o time for novo

            const pAmbas = stats[keyA] && stats[keyB] 
              ? Math.round(((stats[keyA].amb / stats[keyA].j) + (stats[keyB].amb / stats[keyB].j)) / 2 * 100) 
              : 45

            futuros.push({
              id: `${nomeA}-${nomeB}-${col}`,
              min: col.replace('tempo', ''),
              tA: nomeA,
              tB: nomeB,
              pOver,
              pAmbas
            })
          }
        }
      })
    })

    // Remove duplicados (mesmo jogo em colunas diferentes) e pega os 6 primeiros
    return futuros
      .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
      .sort((a, b) => parseInt(a.min) - parseInt(b.min)) // Ordena por minuto
      .slice(0, 6)
  }, [linhas, colunas])

  if (jogosProjetados.length === 0) return null

  return (
    <div style={{ background: '#fff', border: '2px solid #1a7a3a', borderRadius: '12px', padding: '15px', marginBottom: '15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', background: '#1a7a3a', borderRadius: '50%' }} />
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#1a7a3a' }}>PRÓXIMOS 6 JOGOS (ANÁLISE DE TENDÊNCIA)</h3>
        </div>
        <span style={{ fontSize: '10px', color: '#666', fontWeight: 600 }}>ATUALIZAÇÃO AUTOMÁTICA</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        {jogosProjetados.map((j) => (
          <div key={j.id} style={{ border: '1px solid #eee', borderRadius: '10px', padding: '10px', background: '#fafafa' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#1a7a3a' }}>MINUTO {j.min}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, margin: '8px 0', height: '32px', overflow: 'hidden' }}>{j.tA} x {j.tB}</div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <div style={{ flex: 1, background: '#1a7a3a', color: '#fff', borderRadius: '6px', textAlign: 'center', padding: '4px' }}>
                <div style={{ fontSize: '7px', fontWeight: 700 }}>OVER 2.5</div>
                <div style={{ fontSize: '13px', fontWeight: 900 }}>{j.pOver}%</div>
              </div>
              <div style={{ flex: 1, background: '#1d4ed8', color: '#fff', borderRadius: '6px', textAlign: 'center', padding: '4px' }}>
                <div style={{ fontSize: '7px', fontWeight: 700 }}>AMBAS</div>
                <div style={{ fontSize: '13px', fontWeight: 900 }}>{j.pAmbas}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
