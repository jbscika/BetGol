const express = require('express');
const cors = require('cors');
const { db } = require('./firebase');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const ANALISETIPS_TOKEN = process.env.ANALISETIPS_TOKEN;

const LIGAS_MAP = {
  'Copa do Mundo':            'copa',
  'Euro Cup':                 'euro',
  'Premier League':           'premier',
  'Super Liga Sul-Americana': 'super',
  'Express Cup':              'express',
};

app.get('/', (req, res) => {
  res.json({ status: 'BetGol API Online', versao: '7.0 - AnaliseTips + Firebase' });
});

async function buscarAnaliseTips(league, rows = 720) {
  try {
    const url = `https://robots.analisetips.com/api/tabela?bet=365&league=${league}&page=1&rows=${rows}&method=resultsBoth`;
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${ANALISETIPS_TOKEN}`,
        'Accept': '*/*',
        'Origin': 'https://www.analisetips.com',
        'Referer': 'https://www.analisetips.com/',
      },
    });
    const json = await resp.json();
    if (json.error) return null;
    return json.data;
  } catch (e) {
    console.error(`Erro ao buscar AnaliseTips (${league}):`, e.message);
    return null;
  }
}

// =========================================================================
// ROTA: /resultados — busca AnaliseTips direto (rota principal do frontend)
// =========================================================================
app.get('/resultados', async (req, res) => {
  try {
    const ligaPedida = req.query.liga;
    const leagueId = LIGAS_MAP[ligaPedida];

    if (!leagueId) {
      return res.status(400).json({ error: true, message: 'Liga invalida' });
    }

    console.log(`[ANALISETIPS] Buscando ${ligaPedida}...`);
    const dados = await buscarAnaliseTips(leagueId);

    if (!dados || !dados.linhas) {
      return res.status(503).json({ error: true, message: 'AnaliseTips indisponivel' });
    }

    console.log(`[ANALISETIPS] ${ligaPedida}: ${dados.linhas.length} linhas`);
    return res.json({ error: false, data: dados });
  } catch (erro) {
    console.error('Erro /resultados:', erro);
    res.status(500).json({ error: true, message: 'Erro interno' });
  }
});

// =========================================================================
// ROTA: /resultados-locais — Firebase com fallback AnaliseTips
// =========================================================================
app.get('/resultados-locais', async (req, res) => {
  try {
    const ligaPedida = req.query.liga;
    const leagueId = LIGAS_MAP[ligaPedida];

    let query = db.collection('partidas');
    if (ligaPedida) {
      query = query.where('liga', '==', ligaPedida);
    }
    const snapshot = await query.limit(700).get();

    if (!snapshot.empty && snapshot.size >= 10) {
      const jogos = [];
      snapshot.forEach(doc => jogos.push(doc.data()));

      const linhasPorHora = {};
      jogos.forEach(jogo => {
        const hora = jogo.hora || (jogo.horario ? jogo.horario.split(':')[0] : null);
        const minuto = jogo.minuto || (jogo.horario ? jogo.horario.split(':')[1] : null);
        if (!hora || !minuto) return;

        const dataBase = jogo.data_evento ? jogo.data_evento.substring(0, 8) : '00000000';
        const chave = `${jogo.liga || ''}-${dataBase}-${hora}`;

        if (!linhasPorHora[chave]) {
          linhasPorHora[chave] = { hora, liga: jogo.liga, data_evento_base: dataBase };
        }

        const slot = `tempo${String(parseInt(minuto)).padStart(2, '0')}`;
        if (!linhasPorHora[chave][slot]) {
          linhasPorHora[chave][slot] = jogo.placar_real || jogo[slot] ||
            (jogo.placares && jogo.placares.length > 0 ? jogo.placares[0].placar : null);
        }
      });

      const linhas = Object.values(linhasPorHora);
      linhas.sort((a, b) => {
        const dA = (a.data_evento_base || '') + (a.hora || '');
        const dB = (b.data_evento_base || '') + (b.hora || '');
        return dB.localeCompare(dA);
      });

      console.log(`[FIREBASE] ${ligaPedida}: ${linhas.length} linhas`);
      return res.json(linhas);
    }

    // Fallback AnaliseTips
    if (leagueId) {
      console.log(`[ANALISETIPS fallback] Buscando ${ligaPedida}...`);
      const dados = await buscarAnaliseTips(leagueId);
      if (dados && dados.linhas) {
        return res.json(dados.linhas);
      }
    }

    return res.json([]);
  } catch (erro) {
    console.error('Erro ao buscar dados:', erro);
    res.status(500).json({ erro: 'Erro interno no servidor' });
  }
});

// =========================================================================
// ROTA: /capturar
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
    console.log(`[EXTENSAO] Jogo salvo: ${dados.liga} as ${dados.horario || '---'}`);
    res.json({ sucesso: true });
  } catch (erro) {
    console.error('Erro ao capturar:', erro);
    res.status(500).json({ erro: 'Erro ao salvar partida' });
  }
});

// =========================================================================
// ROTA: /atualizar-resultado
// =========================================================================
app.post('/atualizar-resultado', async (req, res) => {
  try {
    const { liga, id_evento, data_evento, hora, minuto, slot, placar_real } = req.body;
    if (!liga || !id_evento || !placar_real) {
      return res.status(400).json({ erro: 'Dados incompletos' });
    }
    const docId = `${liga}-${id_evento}`;
    await db.collection('partidas').doc(docId).set({
      liga, id_evento, data_evento, hora, minuto,
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SERVIDOR BETGOL RODANDO NA PORTA ${PORT}`);
});
