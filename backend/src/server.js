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
  'Super Liga Sul-Americana': 'super', // Ajustado para bater com seu background.js
  'Express Cup': 'express',
};

app.get('/', (req, res) => {
  res.json({ status: 'BetGol API rodando!' });
});

// 1. ROTA NOVA: Busca os dados que VOCÊ capturou (Sem depender de terceiros)
app.get('/resultados-locais', async (req, res) => {
  try {
    const liga = req.query.liga;
    let query = db.collection('partidas');

    // Se o frontend pedir uma liga específica, filtramos
    if (liga) {
      query = query.where('liga', '==', liga);
    }

    // Pegamos as últimas 100 partidas capturadas, ordenadas pelo tempo
    const snapshot = await query.orderBy('timestamp', 'desc').limit(100).get();
    
    const partidas = [];
    snapshot.forEach(doc => {
      partidas.push(doc.data());
    });

    res.json(partidas);
  } catch (e) {
    console.error('Erro ao buscar do Firebase:', e);
    res.status(500).json({ error: 'Erro ao buscar dados locais' });
  }
});

// 2. ROTA ANTIGA: Proxy para AnaliseTips (Pode manter por enquanto como backup)
app.get('/resultados', async (req, res) => {
  try {
    const liga = req.query.liga || 'Copa do Mundo';
    const slug = SLUGS_LIGA[liga] || 'copa';
    const token = process.env.ANALISETIPS_TOKEN;

    if (!token) return res.status(500).json({ error: 'Token não configurado' });

    const url = `https://robots.analisetips.com/api/tabela?bet=365&league=${slug}&page=1&rows=720&method=resultsBoth`;
    const resp = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 15000,
    });
    res.json(resp.data);
  } catch (e) {
    res.status(500).json({ error: 'Erro AnaliseTips' });
  }
});

// 3. ROTA DE CAPTURA: Recebe dados da extensão Chrome (Já está funcionando!)
app.post('/capturar', async (req, res) => {
  try {
    const partida = req.body;
    if (!partida || !partida.liga || !partida.id_evento) {
      return res.status(400).json({ erro: 'Dados inválidos' });
    }
    
    // Salva no Firestore usando uma ID única baseada na liga e ID do evento
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
