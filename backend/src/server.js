const express = require('express');
const cors = require('cors');
const { db } = require('./firebase');
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'BetGol API Online', versao: '4.0 - Grade por Hora' });
});

// =========================================================================
// FUNÇÃO: Descobre o slot tempoXX correto para um minuto
// Ciclos de 3 em 3 minutos: 01,04,07...58 ou 02,05,08...59 ou 00,03,06...57
// =========================================================================
function descobrirSlot(minuto) {
  const min = parseInt(minuto);
  return String(min).padStart(2, '0');
}

// =========================================================================
// FUNÇÃO: Transforma os dados da extensão no formato correto
// =========================================================================
function transformarDados(dados) {
  let hora = null;
  let minuto = null;
  let horario = null;

  if (dados.data_evento && dados.data_evento.length >= 12) {
    hora = dados.data_evento.substring(8, 10);
    minuto = dados.data_evento.substring(10, 12);
    horario = `${hora}:${minuto}`;
  } else if (dados.horario) {
    const partes = dados.horario.split(':');
    hora = partes[0];
    minuto = partes[1];
    horario = dados.horario;
  }

  if (!hora || !minuto) return dados;

  const slot = descobrirSlot(minuto);
  const chaveSlot = `tempo${slot}`;

  let placarStr = null;
  if (dados.placares && dados.placares.length > 0) {
    placarStr = dados.placares[0].placar;
  }

  return {
    ...dados,
    hora,
    minuto,
    horario,
    [chaveSlot]: placarStr,
  };
}

// =========================================================================
// ROTA: Resultados Locais
// Agrupa jogos por hora, formando linhas para a grade do dashboard
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

    // Coleta todos os jogos individuais
    const jogos = [];
    snapshot.forEach(doc => {
      jogos.push(doc.data());
    });

    // =========================================================================
    // AGRUPA por hora — cada hora vira uma "linha" da grade
    // Cada linha tem os campos tempoXX preenchidos com o placar do jogo
    // =========================================================================
    const linhasPorHora = {};

    jogos.forEach(jogo => {
      const hora = jogo.hora || (jogo.horario ? jogo.horario.split(':')[0] : null);
      const minuto = jogo.minuto || (jogo.horario ? jogo.horario.split(':')[1] : null);

      if (!hora || !minuto) return;

      const chave = `${jogo.liga || ''}-${hora}`;

      if (!linhasPorHora[chave]) {
        linhasPorHora[chave] = {
          hora,
          liga: jogo.liga,
          data_evento_base: jogo.data_evento ? jogo.data_evento.substring(0, 8) : null,
        };
      }

      // Preenche o slot tempoXX com o placar
      const slot = `tempo${String(parseInt(minuto)).padStart(2, '0')}`;

      // Só preenche se ainda não tem (evita sobrescrever com jogo mais antigo)
      if (!linhasPorHora[chave][slot]) {
        linhasPorHora[chave][slot] = jogo[slot] || null;

        // Se não tem o slot no jogo, tenta extrair do placar
        if (!linhasPorHora[chave][slot] && jogo.placares && jogo.placares.length > 0) {
          linhasPorHora[chave][slot] = jogo.placares[0].placar;
        }
      }
    });

    // Converte o objeto em array e ordena do mais recente para o mais antigo
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
// ROTA: Capturar — recebe dados da extensão e salva no Firebase
// =========================================================================
app.post('/capturar', async (req, res) => {
  try {
    const dadosBrutos = req.body;

    if (!dadosBrutos || !dadosBrutos.liga || !dadosBrutos.id_evento) {
      return res.status(400).json({ erro: 'Dados incompletos' });
    }

    const dados = transformarDados(dadosBrutos);
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
