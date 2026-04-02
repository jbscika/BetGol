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
    const historico = linhas.slice(0, 40) // Aumentei o histórico para mais precisão
    const confrontosFuturos: any[] = []
    const statsTimes: Record<string, { j: number; o25: number; amb: number }> = {}

    // 1. MAPEIA O HISTÓRICO (Normalizando os nomes dos times)
    historico.forEach(linha => {
      colunas.forEach(col => {
        const val = linha[col] as string
        if (!val || !val.includes('-')) return 
        
        const partes = val.split('</br>')[0].trim()
        const m = partes.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/)
        if (!m) return

        const tA = m[1].trim().toLowerCase()
        const tB = m[4].trim().toLowerCase()
        const gA = parseInt(m[2])
        const gB = parseInt(m[3])
        
        const reg = (t: string, f: number, s: number) => {
          if (!statsTimes[t]) statsTimes[t] = { j: 0, o25: 0, amb: 0 }
          statsTimes[t].j++
          if (f + s > 2.5) statsTimes[t].o25++
          if (f > 0 && s > 0) statsTimes[t].amb++
        }
        reg(tA, gA, gB)
        reg(tB, gB, gA)
      })
    })

    // 2. BUSCA JOGOS FUTUROS (Filtro mais agressivo)
    colunas.forEach(col => {
      const val = proximaLinha[col] as string
      // Se tem "-" no meio dos números, é porque já aconteceu. Se não tem, é futuro.
      if (!val || val.match(/\d\s*-\s*\d/)) return 
      
      const limpo = val.split('</br>')[0].trim()
      // Tenta quebrar por " v ", " x ", " vs " ou múltiplos espaços
      const partes = limpo.split(/\s+(?:v|x|vs)\s+/i)
      
      if (partes.length === 2) {
        const tC = partes[0].trim().toLowerCase()
        const tF = partes[1].trim().toLowerCase()

        if (statsTimes[tC] && statsTimes[tF]) {
          const pOver = Math.round(((statsTimes[tC].o25 / statsTimes[tC].j) + (statsTimes[tF].o25 / statsTimes[tF].j)) / 2 * 100)
          const pAmbas = Math.round(((statsTimes[tC].amb / statsTimes[tC].j) + (statsTimes[tF].amb / statsTimes[tF].j)) / 2 * 100)
          
          confrontosFuturos.push({
            min: col.replace('tempo', ''),
            tC: partes[0].trim(), // Nome original para exibir
            tF: partes[1].trim(),
            pOver,
            pAmbas
          })
        }
      }
    })

    return confrontosFuturos.slice(0, 4)
  }, [linhas, colunas])

  // Se a lista estiver vazia, vamos dar um "alô" mais detalhado para saber o que houve
  if (jogosProjetados.length === 0) {
    return (
      <div style={{ background: '#fff9e6', border: '1px solid #ffe58f', borderRadius: '8px', padding: '12px', marginBottom: '10px', textAlign: 'center' }}>
        <span style={{ fontSize: '12px', color: '#856404', fontWeight: 600 }}>
          ⚠️ AGUARDANDO JOGOS SEM PLACAR NA PRIMEIRA LINHA DA GRADE...
        </span>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '2px solid #1a7a3a', borderRadius: '12px', padding: '15px', marginBottom: '15px', boxShadow: '0 4px 15px rgba(26,122,58,0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
        <div style={{ width: '10px', height: '10px', background: '#1a7a3a', borderRadius: '50%' }} />
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#1a7a3a', letterSpacing: '0.5px' }}>PRÓXIMOS JOGOS COM ALTA TENDÊNCIA</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {jogosProjetados.map((j, i) => (
          <div key={i} style={{ background: '#fcfcfc', border: '1px solid #eee', borderRadius: '10px', padding: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', marginBottom: '8px' }}>MINUTO {j.min}</div>
            <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '12px', color: '#111' }}>{j.tC} <span style={{color:'#ccc'}}>x</span> {j.tF}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1, background: '#1a7a3a', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: '#fff', opacity: 0.8, fontWeight: 700 }}>OVER 2.5</div>
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#fff' }}>{j.pOver}%</div>
              </div>
              <div style={{ flex: 1, background: '#1d4ed8', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: '#fff', opacity: 0.8, fontWeight: 700 }}>AMBAS</div>
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#fff' }}>{j.pAmbas}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
