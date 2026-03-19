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
      `https://www.bet365.bet.br/virtualsportscontentapi/coupon?lid=33&zid=0&pd=%23AC%
