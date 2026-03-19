const axios = require('axios');

const BET365_COOKIE = process.env.BET365_COOKIE;

const LIGAS = {
  'Premier League Virtual': '88',
  'Serie A Virtual': '89',
  'La Liga Virtual': '90',
  'Bundesliga Virtual': '91',
};

async function buscarResultados(ligaId) {
  try {
    const response = await axios.get(
      `https://mobile.bet365.com/inplaydiaryapi/schedule?timezone=16&lid=${ligaId}&zid=0`,
      {
        headers: {
          'Cookie': BET365_COOKIE,
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
          'Accept': 'application/json',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error(`Erro ao buscar liga ${ligaId}:`, error.message);
    return null;
  }
}

async function buscarTodasLigas() {
  const resultados = {};
  for (const [nome, id] of Object.entries(LIGAS)) {
    const dados = await buscarResultados(id);
    if (dados) resultados[nome] = dados;
  }
  return resultados;
}

module.exports = { buscarTodasLigas };
