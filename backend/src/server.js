const express = require('express');
const cors = require('cors');
const { db } = require('./firebase');
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'BetGol API Online', versao: '3.0 - Grade Corrigida' });
});

// =========================================================================
// FUNÇÃO: Descobre em qual linha (ciclo) um minuto pertence
// Regra: o último dígito do minuto inicial define o offset do ciclo
// Ex: offset 8 → linha começa em 01, 04, 07... 58
//     offset 9 → linha começa em 02, 05, 08... 59
// =========================================================================
function descobrirLinha(minuto) {
  const min = parseInt(minuto);
  // O offset é o resto de (minuto - 1) % 3, ajustado para achar o início do ciclo
  // Ciclo A: 01,04,07,10,13,16,19,22,25,28,31,34,37,40,43,46,49,52,55,58 (offset: min%3 === 1)
  // Ciclo B: 02,05,08,11,14,17,20,23,26,29,32,35,38,41,44,47,50,53,56,59 (offset: min%3 === 2)
  // Ciclo C: 00,03,06,09,12,15,18,21,24,27,30,33,36,39,42,45,48,51,54,57 (offset: min%3 === 0)
  return min % 3;
}

// =========================================================================
// FUNÇÃO: Acha o slot tempoXX mais próximo (abaixo ou igual) ao minuto
// dentro do ciclo correto
// =========================================================================
function descobrirSlot(minuto) {
  const min = parseInt(minuto);
  const offset = min % 3;

  // Gera todos os slots do ciclo até 59
  const slots = [];
  for (let s = offset === 0 ? 0 : offset; s <= 59; s += 3) {
    slots.push(s);
  }

  // Pega o slot exato ou o mais próximo abaixo
  let slotEscolhido = slots[0];
  for (const s of slots) {
    if (s <= min) slotEscolhido = s;
    else break;
  }

  return String(slotEscolhido).padStart(2, '0');
}

// =========================================================================
// FUNÇÃO: Transforma os dados da extensão no formato que o Dashboard lê
// =========================================================================
function transformarDados(dados) {
  // Extrai hora e minuto do data_evento (formato: YYYYMMDDHHmmss)
  let hora = null;
  let minuto = null;
  let horario = null;

  if (dados.data_evento && dados.data_evento.length >= 12) {
    hora = dados.data_evento.substring(8, 10);   // posição 8-9 = hora
    minuto = dados.data_evento.substring(10, 12); // posição 10-11 = minuto
    horario = `${hora}:${minuto}`;
  } else if (dados.horario) {
    const partes = dados.horario.split(':');
    hora = partes[0];
    minuto = partes[1];
    horario = dados.horario;
  }

  // Se não tem hora/minuto, não consegue transformar
  if (!hora || !minuto) return dados;

  // Descobre o slot tempoXX correto para esse minuto
  const slot = descobrirSlot(minuto);
  const chaveSlot = `tempo${slot}`;

  // Monta o placar no formato "casa-fora" se tiver nos placares capturados
  // Usa o placar de maior probabilidade (primeiro da lista) como referência
  let placarStr = null;
  if (dados.placares && dados.placares.length > 0) {
    placarStr = dados.placares[0].placar; // ex: "2-1"
  }

  // Retorna os dados enriquecidos com os campos que o Dashboard espera
  return {
    ...dados,
    hora,
    minuto,
    horario,
    [chaveSlot]: placarStr, // ex: tempo28: "2-1"
  };
}

// =========================================================================
// ROTA: Resultados Locais — busca jogos do Firebase
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
      console.log('Firebase vazio para a liga:', ligaPedida);
      return res.json([]);
    }

    const partidas = [];
    snapshot.forEach(doc => {
      partidas.push(doc.data());
    });

    // Ordena do mais recente para o mais antigo
    partidas.sort((a, b) => {
      const dataA = a.data_evento || '';
      const dataB = b.data_evento || '';
      return dataB.localeCompare(dataA);
    });

    res.json(partidas);
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

    // Transforma os dados para o formato correto antes de salvar
    const dados = transformarDados(dadosBrutos);

    dados.timestamp = Date.now();

    const docId = `${dados.liga}-${dados.id_evento}`;
    await db.collection('partidas').doc(docId).set(dados, { merge: true });

    console.log(`[SUCESSO] Jogo salvo: ${dados.liga} às ${dados.horario || '---'} → slot: ${dados.minuto ? 'tempo' + descobrirSlot(dados.minuto) : '???'}`);
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
