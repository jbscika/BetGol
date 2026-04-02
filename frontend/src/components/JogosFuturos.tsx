import { useMemo } from 'react'
import { Partida } from '../pages/Dashboard'

interface Props {
  linhas: Partida[]
  colunas: string[]
}

export default function JogosFuturos({ linhas, colunas }: Props) {
  const jogosProjetados = useMemo(() => {
    if (!linhas || linhas.length === 0) return []

    const statsTimes: Record<string, { j: number; o25: number; amb: number }> = {}
    const confrontosFuturos: any[] = []

    // 1. MAPEIA TUDO QUE JÁ TEM PLACAR (HISTÓRICO)
    linhas.forEach(linha => {
      colunas.forEach(col => {
        const val = linha[col] as string
        if (!val || !val.includes('-')) return 
        
        const partes = val.split('</br>')[0].trim()
        const m = partes.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/)
        if (!m) return

        const tA = m[1].trim().toLowerCase()
        const tB = m[4].trim().toLowerCase()
        const gA = parseInt(m[2]), gB = parseInt(m[3])
        
        const reg = (t: string, f: number, s: number) => {
          if (!statsTimes[t]) statsTimes[t] = { j: 0, o25: 0, amb: 0 }
          statsTimes[t].j++
          if (f + s > 2.5) statsTimes[t].o25++
          if (f > 0 && s > 0) statsTimes[t].amb++
        }
        reg(tA, gA, gB); reg(tB, gB, gA)
      })
    })

    // 2. BUSCA JOGOS FUTUROS EM QUALQUER LUGAR DA GRADE
    // Vamos olhar as primeiras 3 linhas para garantir
    linhas.slice(0, 3).forEach(linha => {
      colunas.forEach(col => {
        const val = linha[col] as string
        if (!val) return
        
        // Se NÃO tem o padrão "número - número", é um jogo futuro
        const temPlacar = /\d\s*-\s*\d/.test(val)
        
        if (!temPlacar) {
          const limpo = val.split('</br>')[0].trim()
          const partes = limpo.split(/\s+(?:v|x|vs)\s+/i)
          
          if (partes.length === 2) {
            const tC = partes[0].trim().toLowerCase()
            const tF = partes[1].trim().toLowerCase()

            if (statsTimes[tC] && statsTimes[tF]) {
              const pOver = Math.round(((statsTimes[tC].o25 / statsTimes[tC].j) + (statsTimes[tF].o25 / statsTimes[tF].j)) / 2 * 100)
              const pAmbas = Math.round(((statsTimes[tC].amb / statsTimes[tC].j) + (statsTimes[tF].amb / statsTimes[tF].j)) / 2 * 100)
              
              confrontosFuturos.push({
                min: col.replace('tempo', ''),
                tCasa: partes[0].trim(),
                tFora: partes[1].trim(),
                pOver,
                pAmbas
              })
            }
          }
        }
      })
    })

    // Remove duplicados e pega os 4 primeiros
    return confrontosFuturos.filter((v, i, a) => a.findIndex(t => (t.tCasa === v.tCasa)) === i).slice(0, 4)
  }, [linhas, colunas])

  if (jogosProjetados.length === 0) {
    return (
      <div style={{ background: '#fff9e6', border: '1px solid #ffe58f', borderRadius: '8px', padding: '15px', marginBottom: '10px', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', color: '#856404', fontWeight: 700 }}>⚠️ NENHUM JOGO FUTURO IDENTIFICADO</div>
        <p style={{ fontSize: '11px', color: '#856404', margin: '5px 0 0' }}>Certifique-se de que a extensão está enviando os jogos que ainda vão começar.</p>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '2px solid #1a7a3a', borderRadius: '12px', padding: '15px', marginBottom: '15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
        <div style={{ width: '10px', height: '10px', background: '#1a7a3a', borderRadius: '50%' }} />
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#1a7a3a' }}>PRÓXIMOS JOGOS (TENDÊNCIA IA)</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {jogosProjetados.map((j, i) => (
          <div key={i} style={{ background: '#fcfcfc', border: '1px solid #eee', borderRadius: '10px', padding: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#666', marginBottom: '5px' }}>MINUTO {j.min}</div>
            <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '10px' }}>{j.tCasa} x {j.tFora}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1, background: '#1a7a3a', padding: '8px', borderRadius: '6px', textAlign: 'center', color: '#fff' }}>
                <div style={{ fontSize: '9px', fontWeight: 700 }}>OVER 2.5</div>
                <div style={{ fontSize: '16px', fontWeight: 900 }}>{j.pOver}%</div>
              </div>
              <div style={{ flex: 1, background: '#1d4ed8', padding: '8px', borderRadius: '6px', textAlign: 'center', color: '#fff' }}>
                <div style={{ fontSize: '9px', fontWeight: 700 }}>AMBAS</div>
                <div style={{ fontSize: '16px', fontWeight: 900 }}>{j.pAmbas}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
