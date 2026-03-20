const BACKEND_URL = 'https://betgol-production.up.railway.app';

// Escuta mensagens do content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.tipo === 'BETGOL_DADOS') {
    processarDados(message.dados);
  }
});

async function processarDados(dados) {
  try {
    // Extrai liga da URL
    const liga = extrairLiga(dados.url);
    if (!liga) return;

    // Processa o texto da resposta
    const partida = parsearPartida(dados.resposta, liga, dados.timestamp);
    if (!partida) return;

    // Envia para o backend
    const resposta = await fetch(`${BACKEND_URL}/capturar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partida),
    });

    if (resposta.ok) {
      console.log('BetGol: dados enviados com sucesso!', partida.liga);
      // Atualiza badge
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#00ff88' });
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
    }
  } catch (error) {
    console.error('BetGol background erro:', error);
  }
}

function extrairLiga(url) {
  const ligas = {
    'C20940364': 'Express Cup',
    'C20120650': 'Copa do Mundo',
    'C20700663': 'Euro Cup',
    'C20849528': 'Super Liga Sul-Americana',
    'C20120653': 'Premier League',
  };

  for (const [id, nome] of Object.entries(ligas)) {
    if (url.includes(id)) return nome;
  }
  return null;
}

function parsearPartida(texto, liga, timestamp) {
  try {
    // Extrai ID do evento
    const eventoMatch = texto.match(/\|EV;ID=E(\d+);/);
    if (!eventoMatch) return null;
    const idEvento = eventoMatch[1];

    // Extrai times do resultado final
    const times = [];
    const timeMatches = texto.matchAll(/\|PA;ID=\d+;NA=([^;]+);SU=1;OD=(\d+\/\d+);\|/g);
    for (const m of timeMatches) {
      const nome = m[1];
      if (!nome.includes('Empate') && !nome.includes(' ou ') &&
          !nome.includes('Mais') && !nome.includes('Menos') &&
          !nome.includes('Sim') && !nome.includes('Não') &&
          !nome.includes('Primeiro') && !nome.includes('Último')) {
        times.push({ nome, odd: m[2] });
        if (times.length === 2) break;
      }
    }

    // Extrai odds resultado final
    const oddsMatch = texto.match(/\|MA;ID=B1-\d+;CN=3;SY=_a;PY=dl;\|PA;ID=(\d+);NA=([^;]+);SU=1;OD=(\d+\/\d+);\|PA;ID=(\d+);NA=([^;]+);SU=1;OD=(\d+\/\d+);\|PA;ID=(\d+);NA=([^;]+);SU=1;OD=(\d+\/\d+);/);

    // Extrai odds ambas marcam
    const ambasMatch = texto.match(/NA=
