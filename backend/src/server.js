const express = require('express');
const cors = require('cors');
const { buscarTodasLigas } = require('./api');
const { db } = require('./firebase');

const app = express();
app.use(cors());
app.use(express.json());

// Armazena última partida vista por liga
const ultimasPartidas = {};

app.get('/', (req, res) => {
  res.json({ status: 'BetGol API rodando!' });
});

app.get('/resultados', async (req, res) => {
  try {
    const liga = req.query.liga || 'Premier League';
    const limit = parseInt(req.query.limit) || 100;
    const snapshot = await db
      .collection('resultados')
      .where('liga', '==', liga)
      .orderBy('data', 'desc')
      .limit(limit)
      .get();
    const resultados = snapshot.docs.map(doc => doc.data());
    res.json(resultados);
  } catch (error) {
    console.error('Erro ao buscar resultados:', error.message);
    res.status(500).json({ erro: error.message });
  }
});

function parsearDados(texto, liga) {
  try {
    const partidas = [];
    const blocos = texto.split('|EV;');
    for (const bloco of blocos) {
      // Pega times
      const timesMatch = bloco.match(/CM=([^~]+)~([^;]+);/);
      // Pega resultado correto disponível
      const placarMatch = bloco.match(/NA=(\d+-\d+);HD=;HA=;OD=/);
      if (timesMatch) {
        const info = timesMatch[1];
        const dataStr = timesMatch[2];
        // Pega times dos PA com NA=Time
        const times = [];
        const timeMatches = bloco.matchAll(/PA;ID=\d+;NA=([^;]+);SU=1;OD=\d+\/\d+;\|/g);
        for (const m of timeMatches) {
          if (!m[1].includes('Empate') && !m[1].includes('ou ')) {
            times.push(m[1]);
            if (times.length === 2) break;
          }
        }
        if (times.length === 2) {
          partidas.push({
            liga,
            time_casa: times[0],
            time_fora: times[1],
            data: new Date().toISOString(),
            id_evento: info,
          });
        }
      }
    }
    return partidas;
  } catch (e) {
    return [];
  }
}

async function coletarDados() {
  try {
    console.log('Coletando dados da Bet365...');
    const dados = await buscarTodasLigas();

    for (const [liga, conteudo] of Object.entries(dados)) {
      if (!conteudo) continue;

      const texto = typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo);

      // Extrai ID do evento atual
      const eventoMatch = texto.match(/\|EV;ID=E(\d+);/);
      if (!eventoMatch) continue;

      const idEvento = eventoMatch[1];

      // Se já vimos esse evento, pula
      if (ultimasPartidas[liga] === idEvento) continue;

      // Novo evento detectado!
      console.log(`Nova partida detectada em ${liga}: evento ${idEvento}`);

      // Extrai times
      const timesMatch = texto.match(/NA=([^;~]+)~\d+;SI=/);
      const timesList = [];
      const paMatches = texto.matchAll(/\|PA;ID=\d+;NA=([^;]+);SU=1;OD=(\d+\/\d+);\|/g);
      for (const m of paMatches) {
        if (!m[1].includes('Empate') && !m[1].includes(' ou ') && !m[1].includes('Mais') && !m[1].includes('Menos') && !m[1].includes('Sim') && !m[1].includes('Não')) {
          timesList.push(m[1]);
          if (timesList.length === 2) break;
        }
      }

      const partida = {
        liga,
        id_evento: idEvento,
        time_casa: timesList[0] || 'Casa',
        time_fora: timesList[1] || 'Fora',
        data: new Date().toISOString(),
        placar_casa: null,
        placar_fora: null,
        status: 'pendente',
      };

      await db.collection('partidas_ativas').doc(`${liga}-${idEvento}`).set(partida);
      ultimasPartidas[liga] = idEvento;

      console.log(`Partida salva: ${partida.time_casa} vs ${partida.time_fora} em ${liga}`);
    }
  } catch (error) {
    console.error('Erro ao coletar dados:', error.message);
  }
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  coletarDados();
  setInterval(coletarDados, 60 * 1000);
});
