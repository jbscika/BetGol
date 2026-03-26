const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { db } = require('./firebase');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const SLUGS_LIGA = {
  'Copa do Mundo': 'copa',
  'Euro Cup': 'euro',
  'Premier League': 'premier',
  'Super Liga': 'super',
};

app.get('/', (req, res) => {
  res.json({ status: 'BetGol API rodando!' });
});

// Proxy para API do AnaliseTips
app.get('/resultados', async (req, res) => {
  try {
    const liga = req.query.liga || 'Copa do Mundo';
    const slug = SLUGS_LIGA[liga] || 'copa';
    const token = process.env.ANALISETIPS_TOKEN;

    if (!token) {
      return res.status(500).json({ error: 'Token não configurado' });
    }

    const url = `https://robots.analisetips.com/api/tabela?bet=365&league=${slug}&page=1&rows=720&method=resultsBoth`;

    const resp = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Origin': 'https://v2.analisetips.com',
        'Referer': 'https://v2.analisetips.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'x-requested-with': 'XMLHttpRequest',
      },
      timeout: 15000,
    });

    res.json(resp.data);
  } catch (e) {
    console.error('Erro ao buscar AnaliseTips:', e.message);
    res.status(500).json({ error: 'Erro ao buscar dados', message: e.message });
  }
});

// Recebe dados da extensão Chrome
app.post('/capturar', async (req, res) => {
  try {
    const partida = req.body;
    if (!partida || !partida.liga || !partida.id_evento) {
      return res.status(400).json({ erro: 'Dados inválidos' });
    }
    await db.collection('partidas').doc(`${partida.liga}-${partida.id_evento}`).set(partida, { merge: true });
    console.log(`Partida salva: ${partida.time_casa} vs ${partida.time_fora} - ${partida.liga}`);
    res.json({ sucesso: true });
  } catch (e) {
    console.error('Erro ao salvar partida:', e);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BetGol backend rodando na porta ${PORT}`);
});
