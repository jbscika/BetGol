const axios = require('axios');

const BET365_COOKIE = process.env.BET365_COOKIE;

const LIGAS = {
  'Express Cup': 'C20940364',
  'Copa do Mundo': 'C20120650',
  'Euro Cup': 'C20700663',
  'Super Liga Sul-Americana': 'C20849528',
  'Premier League': 'C20120653',
};

async function buscarResultados(ligaId) {
  try {
    const response = await axios.get(
      `https://www.bet365.bet.br/virtualsportscontentapi/coupon?lid=33&zid=0&pd=%23AC%23B146%23${ligaId}%23D1%23&cid=28&cgid=1&ctid=28`,
      {
        headers: {
          'Cookie': BET365_COOKIE,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'Referer': 'https://www.bet365.bet.br/',
          'Origin': 'https://www.bet365.bet.br',
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
