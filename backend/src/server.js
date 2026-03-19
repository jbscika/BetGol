const express = require('express');
const cors = require('cors');
const { buscarTodasLigas } = require('./api');
const { db } = require('./firebase');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'BetGol API rodando!' });
});

app.get('/resultados', async (req, res) => {
  try {
    const liga = req.query.liga || 'Premier League';
    const snapshot = await db
      .collection('resultados')
      .where('liga', '==', liga)
      .orderBy('data', 'desc')
      .limit(100)
      .get();

    const resultados = snapshot.docs.map(doc => doc.data());
    res.json(resultados);
  } catch (error) {
    console.error('Erro ao buscar resultados:', error.message);
    res.status(500).json({ erro: error.message });
  }
});

async function coletarDados() {
  try {
    console.log('Coletando dados da Bet365...');
    const dados = await buscarTodasLigas();

    for (const [liga, conteudo] of Object.entries(dados)) {
      if (!conteudo) continue;

      const batch = db.batch();
      const partidas = extrairPartidas(conteudo, liga);

      for (const partida of partidas) {
        const ref = db.collection('resultados').doc(
          `${liga}-${partida.rodada}-${partida.data}`
        );
        batch.set(ref, partida, { merge: true });
      }

      await batch.commit();
      console.log(`Salvo ${partidas.length} partidas de ${liga}`);
    }
  } catch (error) {
    console.error('Erro ao coletar dados:', error.message);
  }
}

function extrairPartidas(conteudo, liga) {
  const partidas = [];
  try {
    if (conteudo && conteudo.E) {
      for (const evento of conteudo.E) {
        if (evento.Sc) {
          const placar = evento.Sc.split(' - ');
          if (placar.length === 2) {
            partidas.push({
              liga,
              placar_casa: parseInt(placar[0]),
              placar_fora: parseInt(placar[1]),
              rodada: evento.EId || Date.now(),
              data: new Date().toISOString(),
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Erro ao extrair partidas:', error.message);
  }
  return partidas;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  coletarDados();
  setInterval(coletarDados, 3 * 60 * 1000);
});
