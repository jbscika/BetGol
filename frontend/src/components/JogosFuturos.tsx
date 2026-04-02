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

    // 1. MAPEIA HISTÓRICO (Ignora o que não tem placar definido)
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

    // 2. BUSCA JOGOS (Foca no padrão "Time v Time" ou "Time x Time")
    // Varremos a grade de cima para baixo
    for (const linha of linhas) {
      for (const col of colunas) {
        const val = (linha[col] as string) || ''
        const textoLimpo = val.replace(/<[^>]*>/g, ' ').trim()
        
        // NOVO FILTRO: Procura por "v", "x" ou "vs" no meio do texto
        const partes = textoLimpo.split(/\s+(?:v|x|vs)\s+/i)
        
        // Se encontramos dois nomes e o placar é 0-0 ou não existe traço
        if (partes.length >= 2) {
          const tA = partes[0].trim(), tB = partes[1].trim()
          
          // Se o jogo ainda não tem um placar real (ex: 2-1) ou é o próximo
          if (!textoLimpo.match(/[1-9]\s*-\s*\d/) && !textoLimpo.match(/\d\s*-\s*[1-9]/)) {
            const kA = tA.toLowerCase(), kB = tB.toLowerCase()

            const pOver = stats[kA] && stats[kB] 
              ? Math.round(((stats[kA].o25 / stats[kA].j) + (stats[kB].o25 / stats[kB].j)) / 2 * 100) 
              : 50
            const pAmbas = stats[kA] && stats[kB] 
              ? Math.round(((stats[kA].amb / stats[kA].j) + (stats[kB].amb / stats[kB].j)) / 2 * 100) 
              : 45

            encontrados.push({
              id: `${tA}-${tB}-${col}`,
              min: col.replace('tempo', ''),
              tA, tB, pOver, pAmbas
            })
          }
        }
        if (encontrados.length >= 6) break
      }
      if (encontrados.length >= 6) break
    }

    return encontrados.slice(0, 6)
  }, [linhas, colunas])

  if (jogosProjetados.length === 0) return null

  return (
    <div style={{ background: '#fff', border: '2px solid #1a7a3a', borderRadius: '12px', padding: '15px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div style={{ width: '8px', height: '8px', background: '#1a7a3a', borderRadius: '50%' }} />
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#1a7a3a' }}>ANÁLISE: PRÓXIMOS 6 JOGOS</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        {jogosProjetados.map((j) => (
          <div key={j.id} style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '10px', background: '#fafafa' }}>
            <div style={{ fontSize: '9px', fontWeight: 800, color: '#666' }}>MINUTO {j.min}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, margin: '5px 0' }}>{j.tA} x {j.tB}</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <div style={{ flex: 1, background: '#1a7a3a', color: '#fff', borderRadius: '4px', textAlign: 'center', padding: '4px' }}>
                <div style={{ fontSize: '7px' }}>OVER 2.5</div>
                <div style={{ fontSize: '12px', fontWeight: 900 }}>{j.pOver}%</div>
              </div>
              <div style={{ flex: 1, background: '#1d4ed8', color: '#fff', borderRadius: '4px', textAlign: 'center', padding: '4px' }}>
                <div style={{ fontSize: '7px' }}>AMBAS</div>
                <div style={{ fontSize: '12px', fontWeight: 900 }}>{j.pAmbas}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
