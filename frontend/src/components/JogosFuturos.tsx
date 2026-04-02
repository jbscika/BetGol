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

    // Função para limpar o nome do time (remove HTML, espaços e deixa minúsculo)
    const limpar = (t: string) => t.replace(/<[^>]*>/g, '').split(/\d/)[0].trim().toLowerCase()

    // 1. MAPEIA HISTÓRICO
    linhas.forEach(linha => {
      colunas.forEach(col => {
        const val = linha[col] as string
        if (!val || !val.includes('-')) return 
        
        const texto = val.replace(/<[^>]*>/g, ' ').trim()
        const m = texto.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/)
        if (!m) return

        const tA = limpar(m[1]), tB = limpar(m[4])
        const gA = parseInt(m[2]), gB = parseInt(m[3])
        
        const reg = (t: string, f: number, s: number) => {
          if (!t) return
          if (!stats[t]) stats[t] = { j: 0, o25: 0, amb: 0 }
          stats[t].j++
          if (f + s > 2.5) stats[t].o25++
          if (f > 0 && s > 0) stats[t].amb++
        }
        reg(tA, gA, gB); reg(tB, gB, gA)
      })
    })

    // 2. BUSCA JOGOS FUTUROS (Qualquer um sem o traço de placar)
    // Varre as primeiras 2 linhas da grade
    linhas.slice(0, 2).forEach(linha => {
      colunas.forEach(col => {
        const val = (linha[col] as string) || ''
        if (!val || val.includes('-') || val.length < 5) return 
        
        const textoLimpo = val.replace(/<[^>]*>/g, ' ').trim()
        // Tenta separar por qualquer coisa que pareça um separador (v, x, vs)
        const partes = textoLimpo.split(/\s+(?:v|x|vs)\s+/i)
        
        if (partes.length >= 2) {
          const nomeA = partes[0].trim()
          const nomeB = partes[1].trim()
          const tA = limpar(nomeA), tB = limpar(nomeB)

          if (stats[tA] && stats[tB]) {
            const pOver = Math.round(((stats[tA].o25 / stats[tA].j) + (stats[tB].o25 / stats[tB].j)) / 2 * 100)
            const pAmbas = Math.round(((stats[tA].amb / stats[tA].j) + (stats[tB].amb / stats[tB].j)) / 2 * 100)
            futuros.push({ min: col.replace('tempo', ''), tA: nomeA, tB: nomeB, pOver, pAmbas })
          }
        }
      })
    })

    return futuros.filter((v, i, a) => a.findIndex(t => t.tA === v.tA) === i).slice(0, 4)
  }, [linhas, colunas])

  if (jogosProjetados.length === 0) return null // Se não achar nada, ele se esconde

  return (
    <div style={{ background: '#fff', border: '2px solid #1a7a3a', borderRadius: '12px', padding: '15px', marginBottom: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div style={{ width: '10px', height: '10px', background: '#1a7a3a', borderRadius: '50%' }} />
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#1a7a3a' }}>PROXIMOS JOGOS COM TENDÊNCIA</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
        {jogosProjetados.map((j, i) => (
          <div key={i} style={{ border: '1px solid #f0f0f0', borderRadius: '10px', padding: '10px', background: '#fafafa' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#666' }}>MINUTO {j.min}</div>
            <div style={{ fontSize: '12px', fontWeight: 700, margin: '8px 0' }}>{j.tA} x {j.tB}</div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <div style={{ flex: 1, background: '#1a7a3a', padding: '5px', borderRadius: '6px', textAlign: 'center', color: '#fff' }}>
                <div style={{ fontSize: '8px' }}>OVER 2.5</div>
                <div style={{ fontSize: '14px', fontWeight: 900 }}>{j.pOver}%</div>
              </div>
              <div style={{ flex: 1, background: '#1d4ed8', padding: '5px', borderRadius: '6px', textAlign: 'center', color: '#fff' }}>
                <div style={{ fontSize: '8px' }}>AMBAS</div>
                <div style={{ fontSize: '14px', fontWeight: 900 }}>{j.pAmbas}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
