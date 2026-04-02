import { useMemo } from 'react'
import { Partida } from '../pages/Dashboard'

interface Props {
  linhas: Partida[]
  colunas: string[]
  horas?: string[]
}

export default function JogosFuturos({ linhas, colunas, horas }: Props) {
  const jogosProjetados = useMemo(() => {
    if (!linhas || linhas.length === 0) return []

    const proximaLinha = linhas[0] 
    const historico = linhas.slice(0, 20) 
    const confrontosFuturos: any[] = []

    const statsTimes: Record<string, { jogos: number; golsFeitos: number; golsSofridos: number; over25: number; ambas: number }> = {}

    // Processa histórico para gerar as probabilidades
    historico.forEach(linha => {
      colunas.forEach(col => {
        const val = linha[col] as string
        if (!val) return
        const partes = val.split('</br>')[0].trim()
        const m = partes.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/)
        if (!m) return
        const [, tA, gAStr, gBStr, tB] = m
        const gA = parseInt(gAStr), gB = parseInt(gBStr)
        
        const registrar = (t: string, fez: number, sofreu: number) => {
          if (!statsTimes[t]) statsTimes[t] = { jogos: 0, golsFeitos: 0, golsSofridos: 0, over25: 0, ambas: 0 }
          statsTimes[t].jogos++
          statsTimes[t].golsFeitos += fez
          statsTimes[t].golsSofridos += sofreu
          if (fez + sofreu > 2.5) statsTimes[t].over25++
          if (fez > 0 && sofreu > 0) statsTimes[t].ambas++
        }
        registrar(tA.trim(), gA, gB)
        registrar(tB.trim(), gB, gA)
      })
    })

    // Gera as projeções para a linha atual
    colunas.forEach(col => {
      const val = proximaLinha[col] as string
      if (!val || val.includes('-')) return // Pula se já tiver placar
      
      const times = val.split('</br>')[0].trim()
      const m = times.match(/^(.+?)\s+[vx]\s+(.+)$/i) || times.match(/^(.+?)\s{2,}(.+)$/)
      
      if (m && statsTimes[m[1].trim()] && statsTimes[m[2].trim()]) {
        const tC = m[1].trim(), tF = m[2].trim()
        const sC = statsTimes[tC], sF = statsTimes[tF]

        const pOver = Math.round(((sC.over25 / sC.jogos) + (sF.over25 / sF.jogos)) / 2 * 100)
        const pAmbas = Math.round(((sC.ambas / sC.jogos) + (sF.ambas / sF.jogos)) / 2 * 100)

        confrontosFuturos.push({
          minuto: col.replace('tempo', ''),
          timeCasa: tC,
          timeFora: tF,
          probOver: pOver,
          probAmbas: pAmbas,
          cor: pOver > 70 ? '#1a7a3a' : '#444'
        })
      }
    })

    return confrontosFuturos.slice(0, 4) 
  }, [linhas, colunas])

  if (jogosProjetados.length === 0) return null

  return (
    <div style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '20px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
        <div style={{ width: '12px', height: '12px', background: '#1a7a3a', borderRadius: '50%' }} />
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#111', letterSpacing: '1px' }}>
          PROJEÇÕES DE INTELIGÊNCIA (PRÓXIMOS JOGOS)
        </h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
        {jogosProjetados.map((j, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>
              <span>MINUTO {j.minuto}</span>
              <span style={{ color: '#1a7a3a' }}>LIVE</span>
            </div>
            
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '12px', textAlign: 'center' }}>
              {j.timeCasa} <span style={{ color: '#999', margin: '0 4px' }}>vs</span> {j.timeFora}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '6px', background: '#f0fdf4', borderRadius: '6px' }}>
                <div style={{ fontSize: '9px', color: '#166534', fontWeight: 700 }}>OVER 2.5</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1a7a3a' }}>{j.probOver}%</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '6px', background: '#eff6ff', borderRadius: '6px' }}>
                <div style={{ fontSize: '9px', color: '#1e40af', fontWeight: 700 }}>AMBAS</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1d4ed8' }}>{j.probAmbas}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
