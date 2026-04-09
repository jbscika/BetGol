const axios = require('axios');

const BET365_COOKIE = process.env.BET365_COOKIE;

const LIGAS = {
  'Express Cup':            'C20940364',
  'Copa do Mundo':          'C20120650',
  'Euro Cup':               'C20700663',
  'Super Liga Sul-Americana': 'C20849528',
  'Premier League':         'C20120653',
};

// =========================================================================
// FUNÇÃO: Busca dados brutos da bet365 para uma liga
// =========================================================================
async function buscarResultados(ligaId) {
  try {
    const url = `https://www.bet365.bet.br/virtualsportscontentapi/coupon?lid=33&zid=0&pd=%23AC%23B146%23${ligaId}%23D1%23&cid=28&cgid=1&ctid=28`;
    const response = await axios.get(url, {
      headers: {
        'Cookie': BET365_COOKIE,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.bet365.bet.br/',
        'Origin': 'https://www.bet365.bet.br',
        'Sec-Ch-Ua': '"Chromium";v="146", "Not_A Brand";v="24", "Google Chrome";v="146"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'Connection': 'keep-alive',
      },
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    console.error(`Erro ao buscar liga ${ligaId}: ${error.message}`);
    return null;
  }
}

// =========================================================================
// FUNÇÃO: Converte odd fracionária "6/1" para decimal
// =========================================================================
function oddParaDecimal(odd) {
  if (!odd) return 999;
  const parts = odd.split('/');
  if (parts.length !== 2) return 999;
  const num = parseFloat(parts[0]);
  const den = parseFloat(parts[1]);
  if (isNaN(num) || isNaN(den) || den === 0) return 999;
  return (num / den) + 1;
}

// =========================================================================
// FUNÇÃO: Parseia o texto bruto da bet365 e extrai dados da partida
// =========================================================================
function parsearPartida(texto, liga) {
  try {
    const eventoMatch = texto.match(/\|EV;ID=E(\d+);/);
    if (!eventoMatch) return null;
    const idEvento = eventoMatch[1];

    // Extrai data_evento
    let dataEvento = null;
    const dataMatch1 = texto.match(/CM=.*?~(\d{14})/);
    const dataMatch2 = texto.match(/ST=(\d{14})/);
    const dataMatch3 = texto.match(/;TU=(\d{14})/);
    if (dataMatch1) dataEvento = dataMatch1[1];
    else if (dataMatch2) dataEvento = dataMatch2[1];
    else if (dataMatch3) dataEvento = dataMatch3[1];
    if (!dataEvento) {
      const fb = texto.match(/(\d{14})/);
      if (fb) dataEvento = fb[1];
    }

    // Extrai hora e minuto
    let hora = null, minuto = null, horario = null;
    if (dataEvento && dataEvento.length >= 12) {
      hora = dataEvento.substring(8, 10);
      minuto = dataEvento.substring(10, 12);
      horario = `${hora}:${minuto}`;
    }

    // Extrai times e odds do resultado final
    const blocoResultado = texto.match(/NA=Resultado Final[\s\S]*?(?=\|MG;)/);
    let timeCasa = null, timeFora = null, oddCasa = null, oddEmpate = null, oddFora = null;
    if (blocoResultado) {
      const paMatches = [...blocoResultado[0].matchAll(/\|PA;ID=\d+;NA=([^;]+);SU=\d;OD=(\d+\/\d+);/g)];
      if (paMatches[0]) { timeCasa = paMatches[0][1]; oddCasa = paMatches[0][2]; }
      if (paMatches[1]) { oddEmpate = paMatches[1][2]; }
      if (paMatches[2]) { timeFora = paMatches[2][1]; oddFora = paMatches[2][2]; }
    }

    // Extrai ambas marcam
    let ambasSim = null, ambasNao = null;
    const blocoAmbas = texto.match(/NA=Para o Time Marcar[\s\S]*?(?=\|MG;)/);
    if (blocoAmbas) {
      const simMatch = blocoAmbas[0].match(/NA=Sim;SY=dc;PY=_d;CN=1;\|PA;ID=\d+;OD=(\d+\/\d+)/);
      const naoMatch = blocoAmbas[0].match(/NA=N[^;]+o;SY=dc;PY=_d;CN=1;\|PA;ID=\d+;OD=(\d+\/\d+)/);
      if (simMatch) ambasSim = simMatch[1];
      if (naoMatch) ambasNao = naoMatch[1];
    }

    // Extrai over/under 2.5
    let mais25 = null, menos25 = null;
    const blocoGols = texto.match(/NA=2\.5[\s\S]*?NA=Mais de;SY=dg[\s\S]*?OD=(\d+\/\d+)[\s\S]*?NA=Menos de;SY=dg[\s\S]*?OD=(\d+\/\d+)/);
    if (blocoGols) { mais25 = blocoGols[1]; menos25 = blocoGols[2]; }

    // Extrai placares possíveis
    const placares = [];
    const blocoPlacares = texto.match(/NA=Resultado Correto;[\s\S]*?(?=\|MG;SY=dz;NA=Resultado Correto - Grupo)/);
    if (blocoPlacares) {
      const ms = [...blocoPlacares[0].matchAll(/NA=(\d+-\d+);HD=;HA=;OD=(\d+\/\d+);SU=\d;/g)];
      for (const m of ms) placares.push({ placar: m[1], odd: m[2] });
    }

    // =========================================================================
    // DETERMINA O PLACAR MAIS PROVÁVEL (menor odd = mais provável)
    // =========================================================================
    let placarMaisProvavel = null;
    if (placares.length > 0) {
      const ordenados = [...placares].sort((a, b) => oddParaDecimal(a.odd) - oddParaDecimal(b.odd));
      placarMaisProvavel = ordenados[0].placar;
    }

    // Slot tempoXX
    const slot = minuto ? `tempo${String(parseInt(minuto)).padStart(2, '0')}` : null;

    const partida = {
      liga,
      id_evento: idEvento,
      data_evento: dataEvento,
      timestamp: new Date().toISOString(),
      hora,
      minuto,
      horario,
      time_casa: timeCasa || 'Casa',
      time_fora: timeFora || 'Fora',
      odd_casa: oddCasa,
      odd_empate: oddEmpate,
      odd_fora: oddFora,
      ambas_marcam_sim: ambasSim,
      ambas_marcam_nao: ambasNao,
      mais_2_5: mais25,
      menos_2_5: menos25,
      placares,
      placar_previsto: placarMaisProvavel,
    };

    // Adiciona o slot tempoXX com o placar previsto
    if (slot && placarMaisProvavel) {
      partida[slot] = placarMaisProvavel;
    }

    return partida;
  } catch (e) {
    console.error('Erro ao parsear partida:', e);
    return null;
  }
}

// =========================================================================
// FUNÇÃO: Busca e parseia todas as ligas
// =========================================================================
async function buscarTodasLigas() {
  const resultados = {};
  for (const nome in LIGAS) {
    const id = LIGAS[nome];
    console.log(`Buscando liga: ${nome}...`);
    const dados = await buscarResultados(id);
    if (dados) {
      const partida = parsearPartida(dados, nome);
      if (partida) {
        resultados[nome] = partida;
        console.log(`✓ ${nome}: ${partida.time_casa} x ${partida.time_fora} às ${partida.horario} | Previsto: ${partida.placar_previsto}`);
      }
    }
  }
  return resultados;
}

module.exports = { buscarTodasLigas, parsearPartida };
