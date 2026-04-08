const express = require('express');
const cors = require('cors');
const { db } = require('./firebase');

const app = express();

// Configurações para aceitar dados
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rota para ver se o servidor está vivo
app.get('/', (req, res) => {
  res.json({ status: 'Servidor BetGol Ativo!' });
});

/**
 * ROTA: Buscar resultados do Firebase
 * Esta rota envia os dados para o seu Dashboard
 */
app.get('/resultados-locais', async (req, res) => {
  try {
    const ligaPedida = req.query.liga;
    console.log('Buscando dados da liga:', ligaPedida);

    let query = db.collection('partidas');

    // Se o site pediu uma liga (ex: Express Cup), filtramos aqui
    if (ligaPedida) {
      query = query.where('liga', '==', ligaPedida);
    }

    // Buscamos os dados (limitamos a 100 para não travar)
    const snapshot = await query.limit(100).get();
    
    if (snapshot.empty) {
      console.log('Nenhum dado encontrado no Firebase.');
      return res.json([]);
    }

    const partidas = [];
    snapshot.forEach(doc => {
      partidas.push(doc.data());
    });

    // Ordenação manual por data_evento (já que vimos que você tem esse campo)
    partidas.sort((a, b) => {
      const dataA = a.data_evento || "";
      const dataB = b.data_evento || "";
      return dataB.localeCompare(dataA); // Deixa o mais recente em cima
    });

    res.json(partidas);
  } catch (erro) {
    console.error('Erro ao buscar dados:', erro);
    res.status(500).json({ erro: 'Falha interna no servidor' });
  }
});

/**
 * ROTA: Receber dados da Extensão
 * Aqui é onde o seu robô salva as informações
 */
app.post('/capturar', async (req, res) => {
  try {
    const dados = req.body;

    if (!dados || !dados.liga || !dados.id_evento) {
      return res.status(400).json({ erro: 'Faltam dados importantes' });
    }

    // Adicionamos o timestamp agora para as próximas buscas ficarem fáceis
    dados.timestamp = Date.now();

    // Criamos o ID do documento igual ao que você já tem na imagem
    const docId = `${dados.liga}-${dados.id_evento}`;

    await db.collection('partidas').doc(docId).set(dados, { merge: true });

    console.log('Partida salva com sucesso:', docId);
    res.json({ sucesso: true });
  } catch (erro) {
    console.error('Erro ao salvar:', erro);
    res.status(500).json({ erro: 'Erro ao gravar no banco' });
  }
});

// Liga o servidor na porta do Railway ou na 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
