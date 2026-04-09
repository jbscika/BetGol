const express = require('express');
const cors = require('cors');
const { db } = require('./firebase'); // Certifique-se que o arquivo firebase.js existe

const app = express();

// Configurações de segurança e tamanho de dados
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rota inicial para teste
app.get('/', (req, res) => {
  res.json({ status: 'BetGol API Online', versao: '2.0 - Grade Completa' });
});

/**
 * ROTA: Resultados Locais
 * Busca até 700 jogos para preencher a grade de 24 horas
 */
app.get('/resultados-locais', async (req, res) => {
  try {
    const ligaPedida = req.query.liga;
    let query = db.collection('partidas');

    // Filtra pela liga se o Dashboard pedir
    if (ligaPedida) {
      query = query.where('liga', '==', ligaPedida);
    }

    // Busca o histórico longo (700 registros)
    const snapshot = await query.limit(700).get();
    
    if (snapshot.empty) {
      console.log('Firebase vazio para a liga:', ligaPedida);
      return res.json([]);
    }

    const partidas = [];
    snapshot.forEach(doc => {
      partidas.push(doc.data());
    });

    // Ordena por data do evento para a grade ficar na ordem certa
    partidas.sort((a, b) => {
      const dataA = a.data_evento || "";
      const dataB = b.data_evento || "";
      return dataB.localeCompare(dataA);
    });

    res.json(partidas);
  } catch (erro) {
    console.error('Erro ao buscar dados no Firebase:', erro);
    res.status(500).json({ erro: 'Erro interno no servidor' });
  }
});

/**
 * ROTA: Capturar (Vem da Extensão)
 * Salva os dados garantindo que a hora e o minuto fiquem claros
 */
app.post('/capturar', async (req, res) => {
  try {
    const dados = req.body;

    if (!dados || !dados.liga || !dados.id_evento) {
      return res.status(400).json({ erro: 'Dados incompletos' });
    }

    // Organiza a Hora e Minuto se não existirem
    // Se a extensão envia algo como "14:04", tentamos extrair
    if (dados.horario && !dados.hora) {
        dados.hora = dados.horario.split(':')[0];
        dados.minuto = dados.horario.split(':')[1];
    }

    dados.timestamp = Date.now();
    const docId = `${dados.liga}-${dados.id_evento}`;

    await db.collection('partidas').doc(docId).set(dados, { merge: true });

    console.log(`[SUCESSO] Jogo salvo: ${dados.liga} às ${dados.horario || '---'}`);
    res.json({ sucesso: true });
  } catch (erro) {
    console.error('Erro ao capturar:', erro);
    res.status(500).json({ erro: 'Erro ao salvar partida' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SERVIDOR BETGOL RODANDO NA PORTA ${PORT}`);
});
