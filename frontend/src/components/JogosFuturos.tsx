import { useMemo } from 'react'
import { Partida } from '../pages/Dashboard'

interface Props {
  linhas: Partida[]
  colunas: string[]
  horas?: string[]
}

export default function JogosFuturos({ linhas, colunas, horas }: Props) {
  const horaAtual = horas && horas.length > 0 ? parseInt(String(horas[0])) : new Date().getHours()
  const minAtual = new Date().getMinutes()

  function proximaHora(minuto: string): string {
    const minNum = parseInt(minuto)
    const h = minNum > minAtual ? horaAtual : (horaAtual + 1) % 24
    return `${String(h).padStart(2, '0')}:${String(minNum).padStart(2, '0')}`
  }

  const resultado = useMemo(() => {
    if (!linhas || linhas.length === 0) return []

    // Montar estatísticas históricas por time
    const stats: Record<string, { j: number; o25: number; amb: number; gols: number }> = {}

    linhas.slice(0, 48).forEach(linha => {
      colunas.forEach(col => {
        const val = linha[col] as string
        if (!val) return
        const texto = val.split('</br>')[0].split('<br>')[0].trim()
        // Formato com placar: "Time A 2 - 1 Time B"
        const m = texto.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/)
        if (!m) return
        const tA = m[1].trim(), tB = m[4].trim()
        const gA = parseInt(m[2]), gB = parseInt(m[3])

        ;[tA, tB].forEach((t, idx) => {
          const gF = idx === 0 ? gA : gB
          const gC = idx === 0 ? gB : gA
          if (!stats[t]) stats[t] = { j: 0, o25: 0, amb: 0, gols: 0 }
          stats[t].j++
          stats[t].gols += gF
          if (gF + gC > 2.5) stats[t].o25++
          if (gF > 0 && gC > 0) stats[t].amb++
        })
      })
    })

    // Encontrar jogos futuros (sem placar definido)
    const futuros: {
      min: string; hora: string; tA: string; tB: string
      pOver: number; pAmbas: number; pCasa: number; pFora: number
    }[] = []

    for (const linha of linhas.slice(0, 3)) {
      for (const col of colunas) {
        const val = linha[col] as string
        if (!val) continue
        const texto = val.split('</br>')[0].split('<br>')[0].trim()

        // Jogo futuro: tem dois times mas SEM placar numérico (ex: "Marrocos - Bélgica" ou "Marrocos - Bélgica OUT")
        const comPlacar = texto.match(/\d+\s*-\s*\d+/)
        if (comPlacar) continue // já tem placar, pula

        // Tenta extrair dois times separados por " - "
        const partes = texto.split(/\s+-\s+/)
        if (partes.length < 2) continue
        const tA = partes[0].trim()
        const tB = partes[1].replace(/\s*OUT\s*$/i, '').trim()
        if (!tA || !tB || tA.length < 2 || tB.length < 2) continue

        const sA = stats[tA]
        const sB = stats[tB]

        const pOver = sA && sB && sA.j > 0 && sB.j > 0
          ? Math.round(((sA.o25 / sA.j) + (sB.o25 / sB.j)) / 2 * 100)
          : 50
        const pAmbas = sA && sB && sA.j > 0 && sB.j > 0
          ? Math.round(((sA.amb / sA.j) + (sB.amb / sB.j)) / 2 * 100)
          : 45
        const pCasa = sA && sA.j > 0
          ? Math.round(sA.o25 / sA.j * 100) // proxy: usa over como indicador de força
          : 45
        const pFora = sB && sB.j > 0
          ? Math.round(sB.o25 / sB.j * 100)
          : 45

        const min = col.replace('tempo', '')
        futuros.push({ min, hora: proximaHora(min), tA, tB, pOver, pAmbas, pCasa, pFora })

        if (futuros.length >= 6) break
      }
      if (futuros.length >= 6) break
    }

    return futuros
  }, [linhas, colunas])

  if (resultado.length === 0) return null

  return (
    <div style={{ background: '#fff', border: '2px solid #1565c0', borderRadius: '10px', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div style={{ width: '8px', height: '8px', background: '#1565c0', borderRadius: '50%' }} />
        <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: '#1565c0', letterSpacing: '2px' }}>
          ANÁLISE: PRÓXIMOS JOGOS
        </h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '8px' }}>
        {resultado.map((j, i) => (
          <div key={i} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '10px', background: '#f8f8f8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#1565c0' }}>MIN {j.min}</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#1a7a3a' }}>→ {j.hora}</span>
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#111', marginBottom: '8px' }}>
              {j.tA} <span style={{ color: '#999' }}>x</span> {j.tB}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <div style={{ background: '#1a7a3a', color: '#fff', borderRadius: '4px', textAlign: 'center', padding: '4px' }}>
                <div style={{ fontSize: '7px', opacity: 0.8 }}>OVER 2.5</div>
                <div style={{ fontSize: '13px', fontWeight: 900 }}>{j.pOver}%</div>
              </div>
              <div style={{ background: '#1565c0', color: '#fff', borderRadius: '4px', textAlign: 'center', padding: '4px' }}>
                <div style={{ fontSize: '7px', opacity: 0.8 }}>AMBAS</div>
                <div style={{ fontSize: '13px', fontWeight: 900 }}>{j.pAmbas}%</div>
              </div>
              <div style={{ background: '#f0f0f0', color: '#111', borderRadius: '4px', textAlign: 'center', padding: '4px', border: '1px solid #ddd' }}>
                <div style={{ fontSize: '7px', color: '#666' }}>CASA ({j.tA.split(' ')[0]})</div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#1a7a3a' }}>{j.pCasa}%</div>
              </div>
              <div style={{ background: '#f0f0f0', color: '#111', borderRadius: '4px', textAlign: 'center', padding: '4px', border: '1px solid #ddd' }}>
                <div style={{ fontSize: '7px', color: '#666' }}>FORA ({j.tB.split(' ')[0]})</div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#c0392b' }}>{j.pFora}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
      }
