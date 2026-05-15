require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Inicialização do Firebase usando a variável de ambiente do .env
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const ANALISETIPS_TOKEN = process.env.ANALISETIPS_TOKEN;
const ANALISETIPS_COOKIE = process.env.ANALISETIPS_COOKIE;

const LIGAS_MAP = {
  'Copa do Mundo':            'copa',
  'Euro Cup':                 'euro',
  'Premier League':           'premier',
  'Super Liga Sul-Americana': 'super',
  'Express Cup':              'express',
};

// Função que busca os dados brutos na AnaliseTips
async function buscarAnaliseTips(league, rows = 10) {
  try {
    const url = `https://robots.analisetips.com/api/tabela?bet=365&league=${league}&page=1&rows=${rows}&method=resultsBoth`;

    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      'Origin': 'https://www.analisetips.com',
      'Referer': 'https://www.analisetips.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    if (ANALISETIPS_TOKEN) headers['Authorization'] = `Bearer ${ANALISETIPS_TOKEN}`;
    if (ANALISETIPS_COOKIE) {
      headers['Cookie'] = ANALISETIPS_COOKIE;
      const xsrfMatch = ANALISETIPS_COOKIE.match(/XSRF-TOKEN=([^;]+)/);
      if (xsrfMatch) headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrfMatch[1]);
    }

    const resp = await fetch(url, { headers });
    if (!resp.ok) return null;

    const json = await resp.json();
    return json.error ? null : json.data;
  } catch (e) {
    console.error(`❌ Erro conexao AnaliseTips (${league}):`, e.message);
    return null;
  }
}

// O TIMER: Essa função roda sozinha a cada 2 minutos buscando as 5 ligas
async function rodarRoboColetor() {
  console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Iniciando varredura nas 5 ligas...`);

  for (const [nomeLiga, idLiga] of Object.entries(LIGAS_MAP)) {
    try {
      const dados = await buscarAnaliseTips(idLiga);
      if (!dados || !dados.linhas || dados.linhas.length === 0) {
        continue;
      }

      // Analisa os últimos horários para pegar os novos placares
      const linhasParaProcessar = dados.linhas.slice(0, 3);

      for (const linha of linhasParaProcessar) {
        const hora = linha.hora;
        const dataBase = linha.data_evento_base || '00000000';

        for (const chaveSlot in linha) {
          if (chaveSlot.startsWith('tempo')) {
            const placar = Weblinha[chaveSlot];
            if (!placar) continue;

            const minuto = chaveSlot.replace('tempo', '');
            const id_evento = `${dataBase}-${hora}${minuto}`;
            const docId = `${nomeLiga}-${id_evento}`;

            // Salva direto no seu Firebase
            await db.collection('partidas').doc(docId).set({
              liga: nomeLiga,
              id_evento: id_evento,
              data_evento: dataBase,
              hora: hora,
              minuto: minuto,
              horario: `${hora}:${minuto}`,
              placar_real: placar,
              [chaveSlot]: placar,
              timestamp_resultado: Date.now()
            }, { merge: true });
          }
        }
      }
      console.log(`✅ Liga processada: ${nomeLiga}`);
    } catch (error) {
      console.error(`❌ Erro na liga ${nomeLiga}:`, error.message);
    }
  }
}

// Ativa o loop do robô de 2 em 2 minutos
rodarRoboColetor();
setInterval(rodarRoboColetor, 120000);

// Mantém as suas rotas antigas caso precise puxar os dados por link
app.get('/', (req, res) => res.json({ status: 'BetGol API Online', versao: '9.0 - Auto' }));

app.get('/resultados', async (req, res) => {
  try {
    const ligaPedida = req.query.liga;
    const leagueId = LIGAS_MAP[ligaPedida];
    if (!leagueId) return res.status(400).json({ error: true, message: 'Liga invalida' });
    const dados = await buscarAnaliseTips(leagueId);
    if (!dados || !dados.linhas) return res.status(503).json({ error: true, message: 'AnaliseTips indisponivel' });
    return res.json({ error: false, data: dados });
  } catch (erro) {
    res.status(500).json({ error: true, message: 'Erro interno' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SERVIDOR BETGOL AUTOMÁTICO RODANDO NA PORTA ${PORT}`);
});
