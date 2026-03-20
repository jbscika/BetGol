const BACKEND_URL = 'https://betgol-production.up.railway.app';

const LIGAS = {
  'C20940364': 'Express Cup',
  'C20120650': 'Copa do Mundo',
  'C20700663': 'Euro Cup',
  'C20849528': 'Super Liga Sul-Americana',
  'C20120653': 'Premier League',
};

// Armazena requisições em andamento
const requisicoesAtivas = {};

// Intercepta quando a requisição é iniciada
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    if (details.url.includes('virtualsportscontentapi/coupon')) {
      requisicoesAtivas[details.requestId] = details.url;
      console.log('BetGol: requisição detectada!', details.url);
    }
  },
  { urls: ['https://www.bet365.bet.br/*'] }
);

// Intercepta quando a requisição é completada
chrome.webRequest.onCompleted.addListener(
  function(details) {
    if (requisicoesAtivas[details.requestId]) {
      const url = requisicoesAtivas[details.requestId];
      delete requisicoesAtivas[details.requestId];
      console.log('BetGol: requisição completada!', url);

      // Busca o conteúdo via fetch usando o cookie da aba ativa
      chrome.tabs.query({ url: 'https://www.bet365.bet.br/*' }, async (tabs) => {
        if (!tabs || tabs.length === 0) return;
        
        try {
          const resultado = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: async (fetchUrl) => {
              try {
                const resp = await fetch(fetchUrl, { credentials: 'include' });
                const texto = await resp.text();
                return texto;
              } catch (e) {
                return null;
              }
            },
            args: [url]
          });

          if (resultado && resultado[0] && resultado[0].result) {
            const texto = resultado[0].result;
            const liga = extrairLiga(url);
            if (liga) {
              await enviarParaBackend(texto, url, liga);
            }
          }
        } catch (e) {
          console.error('BetGol erro scripting:', e);
        }
      });
    }
  },
  { urls: ['https://www.bet365.bet.br/*'] }
);

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

      // Atualiza contador
      chrome.storage.local.get(['contador'], (result) => {
        const novo = (result.contador || 0) + 1;
        chrome.storage.local.set({ contador: novo });
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
    const liga = extrairLiga(message.dados.url);
    if (liga) {
      enviarParaBackend(message.dados.resposta, message.dados.url, liga);
    }
  }
});
