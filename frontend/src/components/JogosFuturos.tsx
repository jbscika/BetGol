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
    const encontrados: any[] = []

    // 1. LIMPEZA E MAPEAMENTO DO HISTÓRICO
    linhas.forEach(linha => {
      colunas.forEach(col => {
        const val = linha[col] as string
        if (!val || !val.includes('-')) return 
        
        const texto = val.replace(/<[^>]*>/g, ' ').trim()
        const m = texto.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/)
        if (!m) return

        const tA = m[1].trim().toLowerCase(), tB = m[4].trim().toLowerCase()
        const gA = parseInt(m[2]), gB = parseInt(m[3])
        
        const reg = (t: string, f: number, s: number) => {
          if (!stats[t]) stats[t] = { j: 0, o25: 0, amb: 0 }
          stats[t].j++; if (f + s > 2.5) stats[t].o25++; if (f > 0 && s > 0) stats[t].amb++
        }
        reg(tA, gA, gB); reg(tB, gB, gA)
      })
    })

    // 2. BUSCA QUALQUER JOGO SEM PLACAR (PRÓXIMOS 6)
    // Varremos as 3 primeiras linhas para garantir que pegamos os próximos horários
    for (let i = 0; i < Math.min(linhas.length, 3); i++) {
      const linha = linhas[i]
      for (const col of colunas) {
        const val = (linha[col] as string) || ''
        
        // Se tem letra e NÃO tem o traço "-", tratamos como jogo futuro
        if (/[a-zA-Z]/.test(val) && !val.includes('-')) {
          const limpo = val.replace(/<[^>]*>/g, ' ').trim()
          const partes = limpo.split(/\s+(?:v|x|vs)\s+/i)
          
          if (partes.length >= 2) {
            const nA = partes[0].trim(), nB = partes[1].trim()
            const kA = nA.toLowerCase(), kB = nB.toLowerCase()

            // Cálculo ou Média se o time for novo no histórico
            const pOver = stats[kA] && stats[kB] 
              ? Math.round(((stats[kA].o25 / stats[kA].j) + (stats[kB].o25 / stats[kB].j)) / 2 * 100) 
              : 50
            const pAmbas = stats[kA] && stats[kB] 
              ? Math.round(((stats[kA].amb / stats[kA].j) + (stats[kB].amb / stats[kB].j)) / 2 * 100) 
              : 45

            encontrados.push({
              id: `${nA}-${nB}-${col}`,
              min: col.replace('tempo', ''),
              tA: nA, tB: nB, pOver, pAmbas
            })
          }
        }
        if (encontrados.length >= 12) break // Pega uma reserva maior para filtrar
      }
    }

    // Remove duplicados e retorna exatamente 6
    return encontrados
      .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
      .slice(0, 6)
  }, [linhas, colunas])

  // Se não encontrar nada, mostra um aviso discreto para sabermos que o componente carregou
  if (jogosProjetados.length === 0) {
    return (
      <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee', textAlign: 'center' }}>
        <span style={{ fontSize: '11px', color: '#999' }}>🔍 RASTREADOR ATIVO: AGUARDANDO JOGOS FUTUROS NA GRADE...</span>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '2px solid #1a7a3a', borderRadius: '12px', padding: '15px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div style={{ width: '8px', height: '8px', background: '#1a7a3a', borderRadius: '50%', animation: 'blink 1s infinite' }} />
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#1a7a3a' }}>RADAR: PRÓXIMOS 6 JOGOS</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
        {jogosProjetados.map((j) => (
          <div key={j.id} style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '10px', background: '#fafafa' }}>
            <div style={{ fontSize: '9px', fontWeight: 800, color: '#666' }}>MIN {j.min}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, margin: '5px 0', height: '30px', overflow: 'hidden' }}>{j.tA} x {j.tB}</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <div style={{ flex: 1, background: '#1a7a3a', color: '#fff', borderRadius: '4px', textAlign: 'center', padding: '4px' }}>
                <div style={{ fontSize: '7px' }}>O2.5</div>
                <div style={{ fontSize: '12px', fontWeight: 900 }}>{j.pOver}%</div>
              </div>
              <div style={{ flex: 1, background: '#1d4ed8', color: '#fff', borderRadius: '4px', textAlign: 'center', padding: '4px' }}>
                <div style={{ fontSize: '7px' }}>AMB</div>
                <div style={{ fontSize: '12px', fontWeight: 900 }}>{j.pAmbas}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
