const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { db } = require('./firebase');

const app = express();

// Configurações iniciais
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const SLUGS_LIGA = {
  'Copa do Mundo': 'copa',
  'Euro Cup': 'euro',
  'Premier League': 'premier',
  'Super Liga Sul-Americana': 'super',
  'Express Cup': 'express',
};

// Rota de Teste
app.get('/', (req, res) => {
  res.json({ status: 'BetGol API rodando!', timestamp: new Date().toISOString() });
});

/**
 * 1. ROTA DE RESULTADOS LOCAIS (FIREBASE)
 * Busca os dados capturados pela sua extensão.
 * Adicionado Plano B caso o Firebase exija índice composto.
 */
app.get('/resultados-locais', async (req, res) => {
  try {
    const { liga } = req.query;
    let query = db.collection('partidas');

    if (liga) {
      query = query.where('liga', '==', liga);
    }

    try {
      // Tenta buscar ordenado (Requer índice no Firebase)
      const snapshot = await query.orderBy('timestamp', 'desc').limit(100).get();
      const partidas = [];
      snapshot.forEach(doc => partidas.push(doc.data()));
      return res.json(partidas);
      
    } catch (indexError) {
      console.warn('Aviso: Índice não encontrado ou erro no orderBy. Usando ordenação manual.');
      
      // PLANO B: Busca sem orderBy para evitar Erro 500
      const snapshotSimples = await query.limit(100).get();
      const partidas = [];
      snapshotSimples.forEach(doc => {
        partidas.push(doc.data());
      });

      // Ordena via JavaScript (descendente por timestamp)
      partidas.sort((a, b) => {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        return timeB - timeA;
      });

      return res.json(partidas);
    }
  } catch (e) {
    console.error('Erro crítico no /resultados-locais:', e);
    res.status(500).json({ error: 'Erro ao buscar dados locais', details: e.message });
  }
});

/**
 * 2. ROTA DE CAPTURA (RECEBE DA EXTENSÃO)
 * Salva ou atualiza os dados no Firestore.
 */
app.post('/capturar', async (req, res) => {
  try {
    const partida = req.body;

    // Validação básica
    if (!partida || !partida.liga) {
      return res.status(400).json({ erro: 'Dados da partida incompletos' });
    }

    // Garante que existe um timestamp para ordenação
    partida.timestamp = partida.timestamp || Date.now();
    
    // Cria uma ID única: "Liga-IDEvento" ou "Liga-Timestamp"
    const idEvento = partida.id_evento || `manual-${Date.now()}`;
    const docId = `${partida.liga}-${idEvento}`.replace(/\s+/g, '_'); // Substitui espaços por _

    await db.collection('partidas').doc(docId).set(partida, { merge: true });

    console.log(`[OK] Capturado: ${partida.liga} | ${partida.time_casa} vs ${partida.time_fora}`);
    res.json({ sucesso: true, id: docId });

  } catch (e) {
    console.error('Erro ao salvar no Firebase:', e);
    res.status(500).json({ erro: 'Erro interno ao salvar', detalhes: e.message });
  }
});

/**
 * 3. ROTA PROXY ANALISETIPS (BACKUP)
 */
app.get('/resultados', async (req, res) => {
  try {
    const liga = req.query.liga || 'Copa do Mundo';
    const slug = SLUGS_LIGA[liga] || 'copa';
    const token = process.env.ANALISETIPS_TOKEN;

    if (!token) {
      return res.status(500).json({ error: 'Token AnaliseTips não configurado nas variáveis de ambiente' });
    }

    const url = `https://robots.analisetips.com/api/tabela?bet=365&league=${slug}&page=1&rows=720&method=resultsBoth`;
    const resp = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 10000,
    });
    
    res.json(resp.data);
  } catch (e) {
    console.error('Erro Proxy AnaliseTips:', e.message);
    res.status(500).json({ error: 'Falha na comunicação com AnaliseTips' });
  }
});

// Inicialização do Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('-----------------------------------------');
  console.log(` BETGOL BACKEND RODANDO NA PORTA ${PORT} `);
  console.log('-----------------------------------------');
});
