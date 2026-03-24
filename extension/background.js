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
    if (!partida) {
      console.warn('BetGol: falha ao parsear partida');
      return;
    }
    console.log('BetGol: enviando partida:', partida);
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
    } else {
      console.error('BetGol: erro no backend', resposta.status);
    }
  } catch (e) {
    console.error('BetGol envio erro:', e);
  }
}

function parsearPartida(texto, liga) {
  try {
    // ID do evento
    const eventoMatch = texto.match(/\|EV;ID=E(\d+);/);
    if (!eventoMatch) return null;
    const idEvento = eventoMatch[1];

    // Data/hora do evento
    const dataMatch = texto.match(/CM=([^~]+)~(\d{14})/);
    const dataEvento = dataMatch ? dataMatch[2] : null;

    // Times e odds do Resultado Final (MG com NA=Resultado Final)
    // Formato: |PA;ID=...;NA=NomeTime;SU=0;OD=X/Y;|
    const blocoResultado = texto.match(/NA=Resultado Final[\s\S]*?(?=\|MG;)/);
    let timeCasa = null, timeEmpate = null, timeFora = null;
    let oddCasa = null, oddEmpate = null, oddFora = null;

    if (blocoResultado) {
      const paMatches = [...blocoResultado[0].matchAll(/\|PA;ID=\d+;NA=([^;]+);SU=\d;OD=(\d+\/\d+);/g)];
      if (paMatches[0]) { timeCasa = paMatches[0][1]; oddCasa = paMatches[0][2]; }
      if (paMatches[1]) { timeEmpate = paMatches[1][1]; oddEmpate = paMatches[1][2]; }
      if (paMatches[2]) { timeFora = paMatches[2][1]; oddFora = paMatches[2][2]; }
    }

    // Fallback: pegar times do título do evento
    if (!timeCasa || !timeFora) {
      const cmMatch = texto.match(/CM=([^;~]+)~([^;]+)/);
      if (cmMatch) {
        const titulo = cmMatch[1]; // ex: "Turquia v Ucrânia"
        const timesMatch = titulo.match(/^(.+?)\s+[vx]\s+(.+)$/i);
        if (timesMatch) {
          timeCasa = timesMatch[1].trim();
          timeFora = timesMatch[2].trim();
        }
      }
    }

    // Ambas marcam
    const blocoAmbas = texto.match(/NA=Para o Time Marcar[\s\S]*?(?=\|MG;)/);
    let ambasSim = null, ambasNao = null;
    if (blocoAmbas) {
      const simMatch = blocoAmbas[0].match(/NA=Sim;SY=dc[^|]*\|PA;ID=\d+;OD=(\d+\/\d+)/);
      const naoMatch = blocoAmbas[0].match(/NA=Não;SY=dc[^|]*\|PA;ID=\d+;OD=(\d+\/\d+)/);
      if (simMatch) ambasSim = simMatch[1];
      if (naoMatch) ambasNao = naoMatch[1];
    }

    // Placares corretos
    const blocoPlacares = texto.match(/NA=Resultado Correto;[\s\S]*?(?=\|MG;SY=dz;NA=Resultado Correto - Grupo)/);
    const placares = [];
    if (blocoPlacares) {
      const placarMatches = [...blocoPlacares[0].matchAll(/NA=(\d+-\d+);HD=;HA=;OD=(\d+\/\d+);SU=\d;/g)];
      for (const m of placarMatches) {
        placares.push({ placar: m[1], odd: m[2] });
      }
    }

    // Gols mais/menos 2.5
    const bloco25 = texto.match(/NA=2\.5;[\s\S]{0,200}?NA=Mais de[\s\S]*?OD=(\d+\/\d+)[\s\S]*?NA=Menos de[\s\S]*?OD=(\d+\/\d+)/);
    let mais25 = null, menos25 = null;
    if (bloco25) {
      mais25 = bloco25[1];
      menos25 = bloco25[2];
    }

    // Primeiro marcador
    const primeiroMarcador = [];
    const blocoMarcador = texto.match(/NA=Primeiro Marcador de Gol[\s\S]*?(?=\|MG;)/);
    if (blocoMarcador) {
      const marcMatches = [...blocoMarcador[0].matchAll(/NA=([^;]+);SU=\d;OD=(\d+\/\d+);/g)];
      for (const m of marcMatches) {
        if (!m[1].includes('Qualquer outro')) {
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

// Injeta content.js quando a aba da Bet365 carregar
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url && tab.url.includes('bet365.bet.br')) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js'],
      world: 'MAIN',
    }).catch(e => console.error('BetGol injeção erro:', e));
  }
});

// Escuta mensagens do content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.tipo === 'BETGOL_DADOS') {
    console.log('BetGol: mensagem recebida!', message.dados.url);
    const liga = extrairLiga(message.dados.url);
    if (liga) {
      enviarParaBackend(message.dados.resposta, message.dados.url, liga);
    } else {
      console.log('BetGol: liga não reconhecida na URL', message.dados.url);
    }
  }
});

console.log('BetGol background ativo!');
