import React, { useState, useMemo } from 'react'

// --- INTERFACES ---
export interface Partida {
  [key: string]: string | number | undefined;
}

interface Props {
  linhas: Partida[]
  colunas: string[]
}

interface PlacarInfo {
  casa: number; fora: number; texto: string; gols: number
  over05: boolean; over15: boolean; over25: boolean; over35: boolean
  under15: boolean; under25: boolean; under35: boolean
  ambasSim: boolean; ambasNao: boolean;
  casaVence: boolean; empate: boolean; foraVence: boolean
}

interface Tendencia {
  minuto: string
  mercado: string
  probabilidade: number
  confianca: number
  motivo: string
}

const FILTRO_VAZIO = { over: '', under: '', ambas: '', resultado: '' }

// --- PARSER DE PLACAR ---
function extrairPlacar(val: string | null): PlacarInfo | null {
  if (!val) return null
  const linha = val.split('</br>')[0].split('<br>')[0].trim()
  const m = linha.match(/(\d+)\s*-\s*(\d+)/)
  if (!m) return null
  const casa = parseInt(m[1]), fora = parseInt(m[2]), gols = casa + fora
  return {
    casa, fora, gols, texto: `${casa}-${fora}`,
    over05: gols > 0.5, over15: gols > 1.5, over25: gols > 2.5, over35: gols > 3.5,
    under15: gols < 1.5, under25: gols < 2.5, under35: gols < 3.5,
    ambasSim: casa > 0 && fora > 0, ambasNao: casa === 0 || fora === 0,
    casaVence: casa > fora, empate: casa === fora, foraVence: fora > casa,
  }
}

// --- LÓGICA DE FILTRO ---
function passaFiltro(p: PlacarInfo, f: typeof FILTRO_VAZIO): boolean {
  if (f.over === '0.5' && !p.over05) return false
  if (f.over === '1.5' && !p.over15) return false
  if (f.over === '2.5' && !p.over25) return false
  if (f.over === '3.5' && !p.over35) return false
  if (f.under === '1.5' && !p.under15) return false
  if (f.under === '2.5' && !p.under25) return false
  if (f.under === '3.5' && !p.under35) return false
  if (f.ambas === 'sim' && !p.ambasSim) return false
  if (f.ambas === 'nao' && !p.ambasNao) return false
  if (f.resultado === 'casa' && !p.casaVence) return false
  if (f.resultado === 'empate' && !p.empate) return false
  if (f.resultado === 'fora' && !p.foraVence) return false
  return true
}

// --- CÁLCULO DA IA ---
function calcularIA(linhas: Partida[], colunas: string[], tipoIA: number, filtroAtivo: typeof FILTRO_VAZIO): Tendencia[] {
  const resultado: Tendencia[] = []
  const temFiltro = Object.values(filtroAtivo).some(v => v !== '')

  colunas.forEach((col) => {
    const hist = linhas.map(l => extrairPlacar(l[col] as string)).filter(Boolean) as PlacarInfo[]
    if (hist.length < 3) return
    const n = hist.length

    let probFinal = 0
    let mercadoNome = ""

    const calcProb = (check: (p: PlacarInfo) => boolean) => Math.round(hist.filter(check).length / n * 100)

    if (temFiltro) {
      probFinal = calcProb(p => passaFiltro(p, filtroAtivo))
      mercadoNome = "FILTRO"
    } else {
      const opcoes = [
        { nome: 'OVER 1.5', p: calcProb(p => p.over15) },
        { nome: 'OVER 2.5', p: calcProb(p => p.over25) },
        { nome: 'UNDER 2.5', p: calcProb(p => p.under25) },
        { nome: 'AMBAS SIM', p: calcProb(p => p.ambasSim) },
      ].sort((a, b) => b.p - a.p)

      // Diferenciação das IAs
      if (tipoIA === 2) { // IA Focada em Under/Atraso
        const underOp = calcProb(p => p.under25)
        mercadoNome = underOp > 60 ? 'UNDER 2.5' : opcoes[0].nome
        probFinal = underOp > 60 ? underOp : opcoes[0].p
      } else {
        mercadoNome = opcoes[0].nome
        probFinal = opcoes[0].p
      }
    }

    resultado.push({
      minuto: col.replace('tempo', ''),
      mercado: mercadoNome,
      probabilidade: probFinal,
      confianca: 80 + tipoIA,
      motivo: tipoIA === 3 ? "Análise Curta" : "Análise Longa"
    })
  })
  return resultado
}

export default function GradeResultados({ linhas, colunas }: Props) {
  const [filtros, setFiltros] = useState({ ...FILTRO_VAZIO })
  const [filtrosAtivos, setFiltrosAtivos] = useState({ ...FILTRO_VAZIO })
  const [tipoIA, setTipoIA] = useState<1 | 2 | 3>(1)
  const [mostrarIA, setMostrarIA] = useState(true)

  const c = {
    bg1: '#080c0d', bg2: '#0d1214', bg3: '#131a1d', bg4: '#1a2328', borda: '#1e2d33',
    verde: '#1b3d2a', vermelho: '#3d1b1b', verdeClaro: '#00ff88', vermelhoClaro: '#ff4444',
    amarelo: '#ffd54f', azul: '#3498db', branco: '#ffffff'
  }

  const cols = colunas.length > 0 ? colunas : ['tempo01','tempo04','tempo07','tempo10','tempo13','tempo16','tempo19','tempo22','tempo25','tempo28','tempo31','tempo34','tempo37','tempo40','tempo43','tempo46','tempo49','tempo52','tempo55','tempo58']

  const isFiltrado = useMemo(() => Object.values(filtrosAtivos).some(v => v !== ''), [filtrosAtivos])
  const linhasExibidas = useMemo(() => isFiltrado ? linhas.slice(0, 20) : linhas, [linhas, isFiltrado])

  // ESTATÍSTICAS DA LINHA (Lado direito da tabela)
  const statsLinhas = useMemo(() => {
    return linhasExibidas.map(linha => {
      let totalGols = 0, acertos = 0, totalMinutos = 0
      cols.forEach(col => {
        const p = extrairPlacar(linha[col] as string)
        if (p) {
          totalMinutos++
          totalGols += p.gols
          // Se tiver filtro, calcula % do filtro. Se não, usa Over 2.5 como padrão.
          if (isFiltrado) { if (passaFiltro(p, filtrosAtivos)) acertos++ }
          else { if (p.over25) acertos++ }
        }
      })
      return {
        pct: totalMinutos > 0 ? Math.round((acertos / totalMinutos) * 100) : 0,
        gols: totalGols
      }
    })
  }, [linhasExibidas, cols, filtrosAtivos, isFiltrado])

  const tendencias = useMemo(() => calcularIA(linhasExibidas, cols, tipoIA, filtrosAtivos), [linhasExibidas, cols, tipoIA, filtrosAtivos])

  return (
    <div style={{ background: c.bg1, color: c.branco, padding: '10px', fontFamily: 'sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ background: c.bg2, padding: '5px 15px', borderRadius: '4px', border: `1px solid ${c.borda}`, fontSize: '12px' }}>
            MÉDIA GREENS: <span style={{ color: c.verdeClaro }}>42%</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button onClick={() => setMostrarIA(!mostrarIA)} style={{ background: mostrarIA ? c.verdeClaro : c.bg4, color: '#000', border: 'none', padding: '5px 10px', borderRadius: '4px', fontWeight: 'bold' }}>IA ON</button>
          {[1, 2, 3].map(t => (
            <button key={t} onClick={() => setTipoIA(t as any)} style={{ background: tipoIA === t ? c.azul : c.bg4, color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px' }}>TIPO {t}</button>
          ))}
        </div>
      </div>

      {/* FILTROS COMPLETOS */}
      <div style={{ background: c.bg2, padding: '10px', borderRadius: '6px', display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: '#607d8b' }}>FILTROS</span>
        <select value={filtros.over} onChange={e => setFiltros({...filtros, over: e.target.value})} style={{ background: c.bg4, color: '#fff', border: 'none' }}>
          <option value="">OVER</option>
          <option value="0.5">0.5</option><option value="1.5">1.5</option><option value="2.5">2.5</option><option value="3.5">3.5</option>
        </select>
        <select value={filtros.under} onChange={e => setFiltros({...filtros, under: e.target.value})} style={{ background: c.bg4, color: '#fff', border: 'none' }}>
          <option value="">UNDER</option>
          <option value="1.5">1.5</option><option value="2.5">2.5</option><option value="3.5">3.5</option>
        </select>
        <select value={filtros.ambas} onChange={e => setFiltros({...filtros, ambas: e.target.value})} style={{ background: c.bg4, color: '#fff', border: 'none' }}>
          <option value="">AMBAS</option>
          <option value="sim">SIM</option><option value="nao">NÃO</option>
        </select>
        <select value={filtros.resultado} onChange={e => setFiltros({...filtros, resultado: e.target.value})} style={{ background: c.bg4, color: '#fff', border: 'none' }}>
          <option value="">RESULTADO</option>
          <option value="casa">CASA</option><option value="empate">EMPATE</option><option value="fora">FORA</option>
        </select>
        <button onClick={() => setFiltrosAtivos({...filtros})} style={{ background: c.verdeClaro, color: '#000', border: 'none', padding: '5px 15px', borderRadius: '4px', fontWeight: 'bold' }}>FILTRAR</button>
        <button onClick={() => {setFiltros({...FILTRO_VAZIO}); setFiltrosAtivos({...FILTRO_VAZIO})}} style={{ background: 'transparent', color: '#607d8b', border: 'none' }}>LIMPAR</button>
      </div>

      {/* TABELA PRINCIPAL */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
          <thead>
            <tr style={{ background: c.bg2 }}>
              <th style={{ border: `1px solid ${c.borda}`, padding: '8px', color: c.verdeClaro }}>H</th>
              {cols.map(col => <th key={col} style={{ border: `1px solid ${c.borda}`, padding: '4px' }}>{col.replace('tempo','')}</th>)}
              <th style={{ border: `1px solid ${c.borda}`, padding: '4px' }}>% | GOLS</th>
            </tr>
          </thead>
          <tbody>
            {/* LINHA IA TENDÊNCIA */}
            {mostrarIA && (
              <tr style={{ background: 'rgba(52, 152, 219, 0.1)' }}>
                <td style={{ border: `1px solid ${c.borda}`, textAlign: 'center', color: c.azul, fontWeight: 'bold' }}>IA T{tipoIA}</td>
                {cols.map(col => {
                  const t = tendencias.find(x => `tempo${x.minuto}` === col)
                  return <td key={col} style={{ border: `1px solid ${c.borda}`, textAlign: 'center', color: c.azul, fontSize: '8px' }}>{t?.mercado || '--'}</td>
                })}
                <td style={{ border: `1px solid ${c.borda}` }}></td>
              </tr>
            )}
            {/* LINHAS DE DADOS */}
            {linhasExibidas.map((linha, idx) => (
              <tr key={idx}>
                <td style={{ border: `1px solid ${c.borda}`, textAlign: 'center', fontWeight: 'bold', color: c.verdeClaro }}>{idx}</td>
                {cols.map(col => {
                  const p = extrairPlacar(linha[col] as string)
                  const verde = p ? (isFiltrado ? passaFiltro(p, filtrosAtivos) : p.over25) : false
                  return (
                    <td key={col} style={{ border: `1px solid ${c.borda}`, padding: '2px' }}>
                      {p ? (
                        <div style={{ background: verde ? c.verde : c.vermelho, textAlign: 'center', borderRadius: '2px', padding: '4px 0', fontWeight: 'bold' }}>{p.texto}</div>
                      ) : '-'}
                    </td>
                  )
                })}
                {/* COLUNA % | GOLS CONSERTADA */}
                <td style={{ border: `1px solid ${c.borda}`, textAlign: 'center', fontWeight: 'bold' }}>
                  <span style={{ color: statsLinhas[idx].pct >= 50 ? c.verdeClaro : c.vermelhoClaro }}>{statsLinhas[idx].pct}%</span>
                  <span style={{ fontSize: '8px', opacity: 0.7 }}> {statsLinhas[idx].gols}g</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
