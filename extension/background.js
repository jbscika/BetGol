const BACKEND_URL = 'https://betgol-production.up.railway.app';

const LIGAS = {
  'C20940364': 'Express Cup',
  'C20120650': 'Copa do Mundo',
  'C20700663': 'Euro Cup',
  'C20849528': 'Super Liga Sul-Americana',
  'C20120653': 'Premier League',
};

function extrairLiga(url) {
  for (const [id, nome] of Object.entries(LIGAS)) {
    if (url.includes(id)) return nome;
  }
  return null;
}

async function enviarParaBackend(texto, url, liga) {
  try {
    const partida = parsearPartida(texto, liga);
    if (!partida) return;

    const resposta = await fetch(`${BACKEND_URL}/capturar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partida),
    });

    if (resposta.ok) {
      console.log('BetGol: dados enviados!', liga);
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#00ff88' });
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
      chrome.storage.local.get(['contador'], (result) => {
        chrome.storage.local.set({ contador: (result.contador || 0) + 1 });
      });
    }
  } catch (e) {
    console.error('BetGol envio erro:', e);
  }
}

function parsearPartida(texto, liga) {
  try {
    const eventoMatch = texto.match(/\|EV;ID=E(\d+);/);
    if (!eventoMatch) return null;
    const idEvento = eventoMatch[1];

    const times = [];
    const timeMatches = texto.matchAll(/\|PA;ID=\d+;NA=([^;]+);SU=1;OD=(\d+\/\d+);\|/g);
    for (const m of timeMatches) {
      const nome = m[1];
      if (!nome.includes('Empate') && !nome.includes(' ou ') &&
          !nome.includes('Mais') && !nome.includes('Menos') &&
          !nome.includes('Sim') && !nome.includes('Não') &&
          !nome.includes('Primeiro') && !nome.includes('Último') &&
          !nome.includes('Gols') && !nome.includes('Gol')) {
        times.push({ nome, odd: m[2] });
        if (times.length === 2) break;
      }
    }

    const ambasMatch = texto.match(/NA=Sim;SY=dc;PY=_d;CN=1;\|PA;ID=\d+;OD=(\d+\/\d+);SU=1/);
    const ambasNaoMatch = texto.match(/NA=Não;SY=dc;PY=_d;CN=1;\|PA;ID=\d+;OD=(\d+\/\d+);SU=1/);

    const placares = [];
    const placarMatches = texto.matchAll(/NA=(\d+-\d+);HD=;HA=;OD=(\d+\/\d+);SU=1;/g);
    for (const m of placarMatches) {
      placares.push({ placar: m[1], odd: m[2] });
    }

    return {
      liga,
      id_evento: idEvento,
      timestamp: new Date().toISOString(),
      time_casa: times[0]?.nome || 'Casa',
      time_fora: times[1]?.nome || 'Fora',
      odd_casa: times[0]?.odd || null,
      odd_fora: times[1]?.odd || null,
      ambas_marcam_sim: ambasMatch ? ambasMatch[1] : null,
      ambas_marcam_nao: ambasNaoMatch ? ambasNaoMatch[1] : null,
      placares,
      placar_casa: null,
      placar_fora: null,
    };
  } catch (e) {
    console.error('Erro parsear:', e);
    return null;
  }
}

// Escuta mensagens do content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.tipo === 'BETGOL_DADOS') {
    console.log('BetGol: mensagem recebida!', message.dados.url);
    const liga = extrairLiga(message.dados.url);
    if (liga) {
      enviarParaBackend(message.dados.resposta, message.dados.url, liga);
    }
  }
});

console.log('BetGol background ativo!');
