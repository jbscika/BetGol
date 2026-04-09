import { useState, useMemo } from 'react'

interface Props {
  linhas: any[] // Os dados brutos que vêm do Firebase
  colunas: string[]
  liga?: string
  ligas?: string[]
  onTrocarLiga?: (liga: string) => void
}

export default function GradeResultados({ linhas, colunas, liga, ligas, onTrocarLiga }: Props) {
  
  // 1. Definição das colunas de minutos (padrão Bet365)
  const cols = ['01','04','07','10','13','16','19','22','25','28','31','34','37','40','43','46','49','52','55','58'];

  // 2. Lógica para organizar os dados em 24 linhas (uma para cada hora)
  const gradeOrganizada = useMemo(() => {
    const horas: Record<string, any> = {};

    // Inicializa as 24 horas do dia vazias
    for (let i = 0; i < 24; i++) {
      const h = String(i).padStart(2, '0');
      horas[h] = {};
    }

    // Preenche as horas com os jogos que vieram do banco
    linhas.forEach(partida => {
      // Tenta descobrir a hora e o minuto pelo ID do evento ou data
      // Exemplo de id_evento esperado: "192691912" (os últimos 2 dígitos costumam ser o minuto)
      // Ou usamos o campo 'data_evento' se ele estiver formatado
      const idStr = String(partida.id_evento || "");
      const minuto = idStr.slice(-2); // Pega os últimos 2 números como minuto
      
      // Aqui precisamos de uma lógica para saber a hora. 
      // Se você tiver o campo 'hora' no Firebase, usamos ele:
      const hora = partida.hora || "00"; 

      if (horas[hora]) {
        horas[hora][minuto] = partida;
      }
    });

    return horas;
  }, [linhas]);

  if (!linhas || linhas.length === 0) {
    return (
      <div style={{ padding: '20px', background: '#fff', border: '1px solid #ddd', textAlign: 'center' }}>
        <strong>Aguardando dados da liga: {liga}...</strong>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      
      {/* SELEÇÃO DE LIGAS */}
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        {ligas?.map(l => (
          <button 
            key={l} 
            onClick={() => onTrocarLiga?.(l)}
            style={{
              padding: '10px 15px',
              border: 'none',
              borderRadius: '5px',
              background: liga === l ? '#1565c0' : '#e0e0e0',
              color: liga === l ? '#fff' : '#333',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* GRADE DE RESULTADOS (TABELA) */}
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '8px', border: '1px solid #ccc' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>Hora</th>
              {cols.map(min => (
                <th key={min} style={{ padding: '10px', border: '1px solid #ddd' }}>{min}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(gradeOrganizada).reverse().map(hora => (
              <tr key={hora}>
                <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold', background: '#f9f9f9' }}>
                  {hora}h
                </td>
                {cols.map(min => {
                  const jogo = gradeOrganizada[hora][min];
                  
                  // Tenta pegar o placar (seja objeto ou string)
                  let placarExibicao = "-";
                  let corFundo = "#fff";

                  if (jogo) {
                    if (jogo.placar_casa !== undefined) {
                      placarExibicao = `${jogo.placar_casa}-${jogo.placar_fora}`;
                      const totalGols = Number(jogo.placar_casa) + Number(jogo.placar_fora);
                      if (totalGols > 2) corFundo = "#e8f5e9"; // Verde para Over 2.5
                    } else if (typeof jogo.placar === 'string') {
                      placarExibicao = jogo.placar;
                    }
                  }

                  return (
                    <td key={min} style={{ 
                      padding: '8px', 
                      border: '1px solid #ddd', 
                      textAlign: 'center',
                      background: corFundo
                    }}>
                      {placarExibicao}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
