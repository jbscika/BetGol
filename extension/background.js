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
    const eventoMatch = texto.match(/\|EV;ID=E(\d+);/);
    if (!eventoMatch) return null;
    const idEvento = eventoMatch[1];

    // =========================================================================
    // CORREÇÃO: Extrai data_evento no formato YYYYMMDDHHmmss
    // O campo ficava null antes porque o regex não cobria todos os formatos
    // =========================================================================
    let dataEvento = null;
    const dataMatch1 = texto.match(/CM=.*?~(\d{14})/);
    const dataMatch2 = texto.match(/ST=(\d{14})/);
    const dataMatch3 = texto.match(/;TU=(\d{14})/);

    if (dataMatch1) dataEvento = dataMatch1[1];
    else if (dataMatch2) dataEvento = dataMatch2[1];
    else if (dataMatch3) dataEvento = dataMatch3[1];

    // Se ainda não achou, tenta qualquer sequência de 14 dígitos no texto
    if (!dataEvento) {
      const dataMatchFallback = texto.match(/(\d{14})/);
      if (dataMatchFallback) dataEvento = dataMatchFallback[1];
    }

    const blocoResultado = texto.match(/NA=Resultado Final[\s\S]*?(?=\|MG;)/);
    let timeCasa = null, timeFora = null, oddCasa = null, oddEmpate = null, oddFora = null;

    if (blocoResultado) {
      const paMatches = [...blocoResultado[0].matchAll(/\|PA;ID=\d+;NA=([^;]+);SU=\d;OD=(\d+\/\d+);/g)];
      if (paMatches[0]) { timeCasa = paMatches[0][1]; oddCasa = paMatches[0][2]; }
      if (paMatches[1]) { oddEmpate = paMatches[1][2]; }
      if (paMatches[2]) { timeFora = paMatches[2][1]; oddFora = paMatches[2][2]; }
    }

    let ambasSim = null, ambasNao = null;
    const blocoAmbas = texto.match(/NA=Para o Time Marcar[\s\S]*?(?=\|MG;)/);
    if (blocoAmbas) {
      const simMatch = blocoAmbas[0].match(/NA=Sim;SY=dc;PY=_d;CN=1;\|PA;ID=\d+;OD=(\d+\/\d+)/);
      const naoMatch = blocoAmbas[0].match(/NA=N[^;]+o;SY=dc;PY=_d;CN=1;\|PA;ID=\d+;OD=(\d+\/\d+)/);
      if (simMatch) ambasSim = simMatch[1];
      if (naoMatch) ambasNao = naoMatch[1];
    }

    let mais25 = null, menos25 = null;
    const blocoGols = texto.match(/NA=2\.5[\s\S]*?NA=Mais de;SY=dg[\s\S]*?OD=(\d+\/\d+)[\s\S]*?NA=Menos de;SY=dg[\s\S]*?OD=(\d+\/\d+)/);
    if (blocoGols) { mais25 = blocoGols[1]; menos25 = blocoGols[2]; }

    const placares = [];
    const blocoPlacares = texto.match(/NA=Resultado Correto;[\s\S]*?(?=\|MG;SY=dz;NA=Resultado Correto - Grupo)/);
    if (blocoPlacares) {
      const ms = [...blocoPlacares[0].matchAll(/NA=(\d+-\d+);HD=;HA=;OD=(\d+\/\d+);SU=\d;/g)];
      for (const m of ms) placares.push({ placar: m[1], odd: m[2] });
    }

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
      data_evento: dataEvento,   // ← agora vem preenchido corretamente
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
    console.error('BetGol Erro parsear:', e);
    return null;
  }
}

async function enviarParaBackend(texto, url, liga) {
  try {
    const partida = parsearPartida(texto, liga);
    if (!partida) return;

    console.log(`BetGol: Enviando ${partida.time_casa} x ${partida.time_fora} (${liga}) | data_evento: ${partida.data_evento}`);

    const resp = await fetch(`${BACKEND_URL}/capturar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partida),
    });

    if (resp.ok) {
      chrome.action.setBadgeText({ text: 'OK' });
      chrome.action.setBadgeBackgroundColor({ color: '#00c853' });
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
    } else {
      chrome.action.setBadgeText({ text: 'ERR' });
      chrome.action.setBadgeBackgroundColor({ color: '#c0392b' });
    }
  } catch (e) {
    console.error('BetGol erro envio API:', e);
  }
}

// =========================================================================
// SISTEMA DE INJEÇÃO E PONTE DE COMUNICAÇÃO (CORRIGE OS ERROS)
// =========================================================================

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes('bet365.com') || tab.url.includes('bet365.bet.br')) {

      // 1. Injeta o Capturador no mundo da página (Para ler requisições XHR)
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
        world: 'MAIN',
      }).catch(e => console.log('BetGol: Erro silencioso ao injetar MAIN', e));

      // 2. Injeta a PONTE no mundo da Extensão (Para acessar o Chrome Runtime)
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'ISOLATED',
        func: () => {
          if (window._betgolPonteAtiva) return;
          window._betgolPonteAtiva = true;

          window.addEventListener("message", (event) => {
            if (event.data && event.data.tipo === 'BETGOL_DADOS_BRUTO') {
              if (chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                  tipo: 'BETGOL_DADOS',
                  dados: event.data.dados
                }).catch(() => {});
              }
            }
          });
        }
      }).catch(e => console.log('BetGol: Erro silencioso ao injetar PONTE', e));
    }
  }
});

// Recebe os dados limpos da PONTE e processa
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.tipo === 'BETGOL_DADOS') {
    const liga = extrairLiga(message.dados.url);
    if (liga) {
      enviarParaBackend(message.dados.resposta, message.dados.url, liga);
    }
  }
  return true;
});

console.log('BetGol: Background Server Ativo!');
