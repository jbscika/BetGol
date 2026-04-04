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

function parsearPartida(texto, liga) {
  try {
    // ID do evento
    const eventoMatch = texto.match(/\|EV;ID=E(\d+);/);
    if (!eventoMatch) return null;
    const idEvento = eventoMatch[1];

    // Data/hora: CM=Lista da Partida~20260405003700
    const dataMatch = texto.match(/CM=.*?~(\d{14})/);
    const dataEvento = dataMatch ? dataMatch[1] : null;

    // Times: primeiro bloco PA apos Resultado Final
    const blocoResultado = texto.match(/NA=Resultado Final[\s\S]*?(?=\|MG;)/);
    let timeCasa = null, timeFora = null;
    let oddCasa = null, oddEmpate = null, oddFora = null;

    if (blocoResultado) {
      const paMatches = [...blocoResultado[0].matchAll(/\|PA;ID=\d+;NA=([^;]+);SU=\d;OD=(\d+\/\d+);/g)];
      if (paMatches[0]) { timeCasa = paMatches[0][1]; oddCasa = paMatches[0][2]; }
      if (paMatches[1]) { oddEmpate = paMatches[1][2]; }
      if (paMatches[2]) { timeFora = paMatches[2][1]; oddFora = paMatches[2][2]; }
    }

    // Ambas marcam - formato real: NA=Sim;SY=dc;PY=_d;CN=1;|PA;ID=...;OD=X/Y
    let ambasSim = null, ambasNao = null;
    const blocoAmbas = texto.match(/NA=Para o Time Marcar[\s\S]*?(?=\|MG;)/);
    if (blocoAmbas) {
      const simMatch = blocoAmbas[0].match(/NA=Sim;SY=dc;PY=_d;CN=1;\|PA;ID=\d+;OD=(\d+\/\d+)/);
      const naoMatch = blocoAmbas[0].match(/NA=N[^;]+o;SY=dc;PY=_d;CN=1;\|PA;ID=\d+;OD=(\d+\/\d+)/);
      if (simMatch) ambasSim = simMatch[1];
      if (naoMatch) ambasNao = naoMatch[1];
    }

    // Over/Under 2.5 - formato: |PA;ID=...;SU=0;OD=X/Y (na secao Mais de / Menos de)
    let mais25 = null, menos25 = null;
    const blocoGols = texto.match(/NA=2\.5[\s\S]*?NA=Mais de;SY=dg[\s\S]*?OD=(\d+\/\d+)[\s\S]*?NA=Menos de;SY=dg[\s\S]*?OD=(\d+\/\d+)/);
    if (blocoGols) { mais25 = blocoGols[1]; menos25 = blocoGols[2]; }

    // Placares corretos
    const placares = [];
    const blocoPlacares = texto.match(/NA=Resultado Correto;[\s\S]*?(?=\|MG;SY=dz;NA=Resultado Correto - Grupo)/);
    if (blocoPlacares) {
      const ms = [...blocoPlacares[0].matchAll(/NA=(\d+-\d+);HD=;HA=;OD=(\d+\/\d+);SU=\d;/g)];
      for (const m of ms) placares.push({ placar: m[1], odd: m[2] });
    }

    // Primeiro marcador
    const primeiroMarcador = [];
    const blocoMarcador = texto.match(/NA=Primeiro Marcador de Gol[\s\S]*?(?=\|MG;)/);
    if (blocoMarcador) {
      const ms = [...blocoMarcador[0].matchAll(/NA=([^;]+);SU=\d;OD=(\d+\/\d+);/g)];
      for (const m of ms) {
        if (!m[1].includes('Qualquer outro') && !m[1].includes('Sem Marcador')) {
          primeiroMarcador.push({ jogador: m[1], odd: m[2] });
        }
      }
    }

    return {
      liga,
      id_evento: idEvento,
      data_evento: dataEvento,
      timestamp: new Date().toISOString(),
      time_casa: timeCasa || 'Casa',
      time_fora: timeFora || 'Fora',
      odd_casa: oddCasa,
      odd_empate: oddEmpate,
      odd_fora: oddFora,
      ambas_marcam_sim: ambasSim,
      ambas_marcam_nao: ambasNao,
      mais_2_5: mais25,
      menos_2_5: menos25,
      placares,
      primeiro_marcador: primeiroMarcador,
    };
  } catch (e) {
    console.error('Erro parsear:', e);
    return null;
  }
}

async function enviarParaBackend(texto, url, liga) {
  try {
    const partida = parsearPartida(texto, liga);
    if (!partida) {
      console.warn('BetGol: falha ao parsear');
      return;
    }
    console.log('BetGol: enviando:', partida.time_casa, 'vs', partida.time_fora, liga);
    const resp = await fetch(`${BACKEND_URL}/capturar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partida),
    });
    if (resp.ok) {
      console.log('BetGol: enviado!', liga);
      chrome.action.setBadgeText({ text: 'OK' });
      chrome.action.setBadgeBackgroundColor({ color: '#00c853' });
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
      chrome.storage.local.get(['contador'], r => {
        chrome.storage.local.set({ contador: (r.contador || 0) + 1 });
      });
    } else {
      console.error('BetGol: erro backend', resp.status);
      chrome.action.setBadgeText({ text: 'ERR' });
      chrome.action.setBadgeBackgroundColor({ color: '#c0392b' });
    }
  } catch (e) {
    console.error('BetGol envio erro:', e);
  }
}

// Injeta content.js ao carregar pagina da Bet365
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('bet365')) {
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
      world: 'MAIN',
    }).catch(e => console.error('BetGol injecao erro:', e));
  }
});

// Recebe dados do content.js
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.tipo === 'BETGOL_DADOS') {
    const liga = extrairLiga(message.dados.url);
    if (liga) {
      enviarParaBackend(message.dados.resposta, message.dados.url, liga);
    } else {
      console.log('BetGol: liga nao reconhecida', message.dados.url.substring(0, 80));
    }
  }
});

console.log('BetGol background ativo!');
