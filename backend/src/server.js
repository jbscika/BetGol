const express = require('express');
const cors = require('cors');
const { db } = require('./firebase');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'BetGol API Online', versao: '6.0 - Resultados Reais' });
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
        // Prioridade: placar real > placar previsto > primeiro da lista
        linhasPorHora[chave][slot] = jogo.placar_real ||
          jogo[slot] ||
          jogo.placar_previsto ||
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
// ROTA: Capturar — recebe dados do jogo atual da extensão
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
// ROTA: Atualizar Resultado — salva o placar REAL do jogo anterior
// Chamada pelo background.js quando captura SU=1 no texto da bet365
// =========================================================================
app.post('/atualizar-resultado', async (req, res) => {
  try {
    const { liga, id_evento, data_evento, hora, minuto, slot, placar_real } = req.body;

    if (!liga || !id_evento || !placar_real) {
      return res.status(400).json({ erro: 'Dados incompletos' });
    }

    const docId = `${liga}-${id_evento}`;

    // Atualiza o documento com o placar real e o slot correto
    await db.collection('partidas').doc(docId).set({
      liga,
      id_evento,
      data_evento,
      hora,
      minuto,
      horario: hora && minuto ? `${hora}:${minuto}` : null,
      placar_real,
      [slot]: placar_real,
      timestamp_resultado: Date.now(),
    }, { merge: true });

    console.log(`[RESULTADO REAL] ${liga} | ${slot} = ${placar_real}`);
    res.json({ sucesso: true });
  } catch (erro) {
    console.error('Erro ao atualizar resultado:', erro);
    res.status(500).json({ erro: 'Erro ao atualizar resultado' });
  }
});

// =========================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SERVIDOR BETGOL RODANDO NA PORTA ${PORT}`);
});
