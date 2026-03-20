const express = require('express');
const cors = require('cors');
const { db } = require('./firebase');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'BetGol API rodando!' });
});

// Recebe dados da extensão Chrome
app.post('/capturar', async (req, res) => {
  try {
    const partida = req.body;
    if (!partida || !partida.liga || !partida.id_evento) {
      return res.status(400).json({ erro: 'Dados inválidos' });
    }

    // Salva partida no Firestore
    await db.collection('partidas').doc(`${partida.liga}-${partida.id_evento}`).set(partida, { merge: true });
    console.log(`Partida salva: ${partida.time_casa} vs ${partida.time_fora} - ${partida.liga}`);

    // Atualiza análise da liga
    await analisarPadroes(partida.liga);
