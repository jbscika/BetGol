const express = require('express');
const cors = require('cors');
const { db } = require('./firebase');
const { buscarTodasLigas } = require('./api');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'BetGol API Online', versao: '5.1 - Bot Automático' });
});

// =========================================================================
// ROTA: Resultados Locais
// =========================================================================
app.get('/resultados-locais', async (req, res) => {
  try {
    const ligaPedida = req.query.liga;
    let query = db.collection('partidas');

    if (ligaPedida) {
      query = query.where('liga', '==', ligaPedida);
    }

    const snapshot = await query.limit(700).get();

    if (snapshot.empty) {
      return res.json([]);
    }

    const jogos = [];
    snapshot.forEach(doc => {
      jogos.push(doc.data());
    });

    // Agrupa por hora — cada hora vira uma linha da grade
    const linhasPorHora = {};

    jogos.forEach(jogo => {
      const hora = jogo.hora || (jogo.horario ? jogo.horario.split(':')[0] : null);
      const minuto = jogo.minuto || (jogo.horario ? jogo.horario.split(':')[1] : null);

      if (!hora || !minuto) return;

      const dataBase = jogo.data_evento ? jogo.data_evento.substring(0, 8) : '00000000';
      const chave = `${jogo.liga || ''}-${dataBase}-${hora}`;

      if (!linhasPorHora[chave]) {
        linhasPorHora[chave] = {
          hora,
          liga: jogo.liga,
          data_evento_base: dataBase,
        };
      }

      const slot = `tempo${String(parseInt(minuto)).padStart(2, '0')}`;

      if (!linhasPorHora[chave][slot]) {
        linhasPorHora[chave][slot] = jogo[slot] || jogo.placar_previsto ||
          (jogo.placares && jogo.placares.length > 0 ? jogo.placares[0].placar : null);
      }
    });

    const linhas = Object.values(linhasPorHora);
    linhas.sort((a, b) => {
      const dA = (a.data_evento_base || '') + (a.hora || '');
      const dB = (b.data_evento_base || '') + (b.hora || '');
      return dB.localeCompare(dA);
    });

    res.json(linhas);
  } catch (erro) {
    console.error('Erro ao buscar dados no Firebase:', erro);
    res.status(500).json({ erro: 'Erro interno no servidor' });
  }
});

// =========================================================================
// ROTA: Capturar — recebe dados da extensão
// =========================================================================
app.post('/capturar', async (req, res) => {
  try {
    const dados = req.body;

    if (!dados || !dados.liga || !dados.id_evento) {
      return res.status(400).json({ erro: 'Dados incompletos' });
    }

    dados.timestamp = Date.now();

    const docId = `${dados.liga}-${dados.id_evento}`;
    await db.collection('partidas').doc(docId).set(dados, { merge: true });

    console.log(`[EXTENSÃO] Jogo salvo: ${dados.liga} às ${dados.horario || '---'}`);
    res.json({ sucesso: true });
  } catch (erro) {
    console.error('Erro ao capturar:', erro);
    res.status(500).json({ erro: 'Erro ao salvar partida' });
  }
});

// =========================================================================
// BOT AUTOMÁTICO — roda em background sem bloquear o servidor
// =========================================================================
async function rodarBot() {
  console.log(`[BOT] Iniciando busca... ${new Date().toISOString()}`);
  try {
    const resultados = await buscarTodasLigas();

    for (const [liga, partida] of Object.entries(resultados)) {
      if (!partida || !partida.id_evento) continue;

      const docId = `${partida.liga}-${partida.id_evento}`;
      await db.collection('partidas').doc(docId).set(partida, { merge: true });
      console.log(`[BOT] Salvo: ${partida.liga} | ${partida.time_casa} x ${partida.time_fora} às ${partida.horario}`);
    }

    console.log(`[BOT] Ciclo concluído. ${Object.keys(resultados).length} ligas.`);
  } catch (e) {
    console.error('[BOT] Erro:', e.message);
  }
}

// =========================================================================
// INICIA O SERVIDOR PRIMEIRO, depois o bot em background
// =========================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SERVIDOR BETGOL RODANDO NA PORTA ${PORT}`);

  // Bot começa 5 segundos após o servidor iniciar
  setTimeout(() => {
    rodarBot();
    setInterval(rodarBot, 3 * 60 * 1000);
  }, 5000);

  console.log('BOT AUTOMÁTICO SERÁ INICIADO EM 5 SEGUNDOS');
});
