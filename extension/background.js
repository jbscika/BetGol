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

// =========================================================================
// FUNÇÃO: Converte odd fracionária para decimal
// =========================================================================
function oddParaDecimal(odd) {
  if (!odd) return 999;
  const parts = odd.split('/');
  if (parts.length !== 2) return 999;
  const num = parseFloat(parts[0]);
  const den = parseFloat(parts[1]);
  if (isNaN(num) || isNaN(den) || den === 0) return 999;
  return (num / den) + 1;
}

// =========================================================================
// FUNÇÃO: Extrai o placar real do jogo anterior (SU=1 ou SU=2)
// Quando o jogo do minuto 37 começa, o resultado do 34 aparece com SU=1
// =========================================================================
function extrairResultadoAnterior(texto) {
  try {
    // Busca blocos de Resultado Correto onde algum PA tem SU=1 ou SU=2
    const blocoPlacares = texto.match(/NA=Resultado Correto;[\s\S]*?(?=\|MG;SY=dz;NA=Resultado Correto - Grupo)/);
    if (!blocoPlacares) return null;

    // Busca placares com SU=1 ou SU=2 (resultado encerrado)
    const ms = [...blocoPlacares[0].matchAll(/NA=(\d+-\d+);HD=;HA=;OD=(\d+\/\d+);SU=([12]);/g)];
    if (ms.length === 0) return null;

    // O placar com SU=1 ou SU=2 é o resultado real
    // Se houver mais de um, pega o de menor odd (mais provável = resultado real)
    let placarReal = null;
    let menorOdd = 999;

    for (const m of ms) {
      const odd = oddParaDecimal(m[2]);
      if (odd < menorOdd) {
        menorOdd = odd;
        placarReal = m[1];
      }
    }

    return placarReal;
  } catch (e) {
    return null;
  }
}

// =========================================================================
// FUNÇÃO: Extrai o id_evento e data do jogo ANTERIOR
// O jogo anterior aparece no texto quando o próximo começa
// =========================================================================
function extrairEventoAnterior(texto) {
  try {
    // Busca todos os eventos no texto
    const eventos = [...texto.matchAll(/\|EV;ID=E(\d+);CM=.*?~(\d{14})/g)];
    if (eventos.length < 2) return null;

    // O primeiro evento é o atual, o segundo (ou mais) é o anterior
    // Na verdade buscamos o evento que tem mercados com SU=1
    // Verificamos qual evento tem SU=1 nos seus mercados
    const blocos = texto.split(/(?=\|EV;ID=E)/);
    
    for (const bloco of blocos) {
      if (bloco.includes('SU=1') || bloco.includes('SU=2')) {
        const eventoMatch = bloco.match(/\|EV;ID=E(\d+);CM=.*?~(\d{14})/);
        if (eventoMatch) {
          return {
            id_evento: eventoMatch[1],
            data_evento: eventoMatch[2],
          };
        }
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function parsearPartida(texto, liga) {
  try {
    const eventoMatch = texto.match(/\|EV;ID=E(\d+);/);
    if (!eventoMatch) return null;
    const idEvento = eventoMatch[1];

    // Extrai data_evento
    let dataEvento = null;
    const dataMatch1 = texto.match(/CM=.*?~(\d{14})/);
    const dataMatch2 = texto.match(/ST=(\d{14})/);
    const dataMatch3 = texto.match(/;TU=(\d{14})/);
    if (dataMatch1) dataEvento = dataMatch1[1];
    else if (dataMatch2) dataEvento = dataMatch2[1];
    else if (dataMatch3) dataEvento = dataMatch3[1];
    if (!dataEvento) {
      const dataMatchFallback = texto.match(/(\d{14})/);
      if (dataMatchFallback) dataEvento = dataMatchFallback[1];
    }

    // Extrai hora e minuto
    let hora = null, minuto = null, horario = null;
    if (dataEvento && dataEvento.length >= 12) {
      hora = dataEvento.substring(8, 10);
      minuto = dataEvento.substring(10, 12);
      horario = `${hora}:${minuto}`;
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

    // Slot tempoXX do jogo atual
    const slot = minuto ? `tempo${String(parseInt(minuto)).padStart(2, '0')}` : null;

    const partida = {
      liga,
      id_evento: idEvento,
      data_evento: dataEvento,
      timestamp: new Date().toISOString(),
      hora,
      minuto,
      horario,
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

    // Adiciona slot sem placar real (será atualizado quando o próximo jogo capturar)
    if (slot) partida[slot] = null;

    return partida;
  } catch (e) {
    console.error('BetGol Erro parsear:', e);
    return null;
  }
}

// =========================================================================
// FUNÇÃO: Extrai e envia o resultado real do jogo anterior
// =========================================================================
async function processarResultadoAnterior(texto, liga) {
  try {
    const placarReal = extrairResultadoAnterior(texto);
    if (!placarReal) return;

    const eventoAnterior = extrairEventoAnterior(texto);
    if (!eventoAnterior) return;

    const { id_evento, data_evento } = eventoAnterior;
    const hora = data_evento.substring(8, 10);
    const minuto = data_evento.substring(10, 12);
    const slot = `tempo${String(parseInt(minuto)).padStart(2, '0')}`;

    console.log(`BetGol: Resultado anterior capturado! ${liga} | ${slot} = ${placarReal}`);

    // Envia atualização do resultado real para o backend
    await fetch(`${BACKEND_URL}/atualizar-resultado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        liga,
        id_evento,
        data_evento,
        hora,
        minuto,
        slot,
        placar_real: placarReal,
      }),
    }).catch(() => {});
  } catch (e) {
    console.error('BetGol erro resultado anterior:', e);
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

    // Processa resultado do jogo anterior em paralelo
    await processarResultadoAnterior(texto, liga);

  } catch (e) {
    console.error('BetGol erro envio API:', e);
  }
}

// =========================================================================
// FUNÇÃO CENTRAL DE INJEÇÃO
// =========================================================================
function injetarNaAba(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
    world: 'MAIN',
  }).catch(e => console.log('BetGol: Erro silencioso ao injetar MAIN', e));

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

function ehBet365(url) {
  return url && (url.includes('bet365.com') || url.includes('bet365.bet.br'));
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && ehBet365(tab.url)) {
    console.log('BetGol: Injetando via onUpdated');
    injetarNaAba(tabId);
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (ehBet365(details.url)) {
    console.log('BetGol: Injetando via webNavigation (SPA)');
    injetarNaAba(details.tabId);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ url: ['*://*.bet365.com/*', '*://*.bet365.bet.br/*'] }, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        console.log('BetGol: Injetando em aba já aberta via onInstalled');
        injetarNaAba(tab.id);
      }
    });
  });
});

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
