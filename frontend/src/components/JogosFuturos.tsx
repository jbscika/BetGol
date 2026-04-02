import { useMemo } from 'react'
import { Partida } from '../pages/Dashboard'

interface Props {
  linhas: Partida[]
  colunas: string[]
}

export default function JogosFuturos({ linhas, colunas }: Props) {
  const jogosProjetados = useMemo(() => {
    if (!linhas || linhas.length === 0) return []

    const proximaLinha = linhas[0] 
    const historico = linhas.slice(0, 30) 
    const confrontosFuturos: any[] = []
    const statsTimes: Record<string, { j: number; gf: number; gs: number; o25: number; amb: number }> = {}

    // 1. MAPEIA O HISTÓRICO (Para saber quem é bom e quem é ruim)
    historico.forEach(linha => {
      colunas.forEach(col => {
        const val = linha[col] as string
        if (!val || !val.includes('-')) return 
        const partes = val.split('</br>')[0].trim()
        const m = partes.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/)
        if (!m) return
        const [, tA, gA, gB, tB] = [m[1].trim(), parseInt(m[2]), parseInt(m[3]), m[4].trim()]
        
        const reg = (t: string, f: number, s: number) => {
          if (!statsTimes[t]) statsTimes[t] = { j: 0, gf: 0, gs: 0, o25: 0, amb: 0 }
          statsTimes[t].j++; statsTimes[t].gf += f; statsTimes[t].gs += s
          if (f + s > 2.5) statsTimes[t].o25++
          if (f > 0 && s > 0) statsTimes[t].amb++
        }
        reg(tA, gA, gB); reg(tB, gB, gA)
      })
    })

    // 2. BUSCA JOGOS FUTUROS (Qualquer célula que NÃO tenha o " - ")
    colunas.forEach(col => {
      const val = proximaLinha[col] as string
      if (!val || val.includes(' - ')) return 
      
      const limpo = val.split('</br>')[0].trim()
      // Tenta separar por " v ", " x ", " VS " ou espaços duplos
      const m = limpo.match(/^(.+?)\s+(?:v|x|vs)\s+(.+)$/i) || limpo.match(/^(.+?)\s{2,}(.+)$/)
      
      if (m) {
        const tC = m[1].trim(), tF = m[2].trim()
        if (statsTimes[tC] && statsTimes[tF]) {
          const pOver = Math.round(((statsTimes[tC].o25 / statsTimes[tC].j) + (statsTimes[tF].o25 / statsTimes[tF].j)) / 2 * 100)
          const pAmbas = Math.round(((statsTimes[tC].amb / statsTimes[tC].j) + (statsTimes[tF].amb / statsTimes[tF].j)) / 2 * 100)
          confrontosFuturos.push({ min: col.replace('tempo', ''), tC, tF, pOver, pAmbas })
        }
      }
    })

    return confrontosFuturos.slice(0, 4)
  }, [linhas, colunas])

  if (jogosProjetados.length === 0) {
    return (
      <div style={{ background: '#fdfdfd', border: '1px solid #eee', borderRadius: '8px', padding: '12px', marginBottom: '10px', textAlign: 'center' }}>
        <span style={{ fontSize: '12px', color: '#999', fontWeight: 600 }}>⏳ AGUARDANDO PRÓXIMA GRADE DA BET365...</span>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #1a7a3a33', borderRadius: '12px', padding: '15px', marginBottom: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
        <div style={{ width: '8px', height: '8px', background: '#1a7a3a', borderRadius: '50%', animation: 'blink 1.5s infinite' }} />
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#111' }}>PROJEÇÕES PARA OS PRÓXIMOS JOGOS</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {jogosProjetados.map((j, i) => (
          <div key={i} style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#1a7a3a', marginBottom: '5px' }}>MINUTO {j.min}</div>
            <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px' }}>{j.tC} x {j.tF}</div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <div style={{ flex: 1, background: '#f0fdf4', padding: '5px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: '#166534' }}>OVER 2.5</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#1a7a3a' }}>{j.pOver}%</div>
              </div>
              <div style={{ flex: 1, background: '#eff6ff', padding: '5px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: '#1e40af' }}>AMBAS</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#1d4ed8' }}>{j.pAmbas}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
