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
// FUNÇÃO: Parseia UM bloco de evento (pode haver múltiplos no texto)
// =========================================================================
function parsearBloco(bloco, liga) {
  try {
    const eventoMatch = bloco.match(/\|EV;ID=E(\d+);CM=.*?~(\d{14})/);
    if (!eventoMatch) return null;

    const idEvento = eventoMatch[1];
    const dataEvento = eventoMatch[2];
    const hora = dataEvento.substring(8, 10);
    const minuto = dataEvento.substring(10, 12);
    const horario = `${hora}:${minuto}`;
    const slot = `tempo${String(parseInt(minuto)).padStart(2, '0')}`;

    // Detecta se o jogo está encerrado (RO=1)
    const encerrado = bloco.includes('RO=1');

    // Extrai times
    const blocoResultado = bloco.match(/NA=Resultado Final[\s\S]*?(?=\|MG;)/);
    let timeCasa = null, timeFora = null, oddCasa = null, oddEmpate = null, oddFora = null;
    if (blocoResultado) {
      const paMatches = [...blocoResultado[0].matchAll(/\|PA;ID=\d+;NA=([^;]+);SU=\d;OD=(\d+\/\d+);/g)];
      if (paMatches[0]) { timeCasa = paMatches[0][1]; oddCasa = paMatches[0][2]; }
      if (paMatches[1]) { oddEmpate = paMatches[1][2]; }
      if (paMatches[2]) { timeFora = paMatches[2][1]; oddFora = paMatches[2][2]; }
    }

    // Extrai placares possíveis
    const placares = [];
    const blocoPlacares = bloco.match(/NA=Resultado Correto;[\s\S]*?(?=\|MG;SY=dz;NA=Resultado Correto - Grupo)/);
    if (blocoPlacares) {
      const ms = [...blocoPlacares[0].matchAll(/NA=(\d+-\d+);HD=;HA=;OD=(\d+\/\d+);SU=\d;/g)];
      for (const m of ms) placares.push({ placar: m[1], odd: m[2] });
    }

    // =========================================================================
    // Se o jogo está encerrado (RO=1), extrai o placar REAL
    // O placar real é o que tem SU=1 e menor odd (mais provável = aconteceu)
    // =========================================================================
    let placarReal = null;
    if (encerrado && placares.length > 0) {
      // Busca placares com SU=1 especificamente
      const blocoPlacaresSU1 = bloco.match(/NA=Resultado Correto;[\s\S]*?(?=\|MG;SY=dz;NA=Resultado Correto - Grupo)/);
      if (blocoPlacaresSU1) {
        const ms = [...blocoPlacaresSU1[0].matchAll(/NA=(\d+-\d+);HD=;HA=;OD=(\d+\/\d+);SU=1;/g)];
        if (ms.length > 0) {
          // Pega o de menor odd (resultado real)
          let menorOdd = 999;
          for (const m of ms) {
            const odd = oddParaDecimal(m[2]);
            if (odd < menorOdd) {
              menorOdd = odd;
              placarReal = m[1];
            }
          }
        }
      }

      // Se não achou com SU=1, usa o de menor odd geral
      if (!placarReal && placares.length > 0) {
        const ordenados = [...placares].sort((a, b) => oddParaDecimal(a.odd) - oddParaDecimal(b.odd));
        placarReal = ordenados[0].placar;
      }
    }

    // Extrai ambas marcam
    let ambasSim = null, ambasNao = null;
    const blocoAmbas = bloco.match(/NA=Para o Time Marcar[\s\S]*?(?=\|MG;)/);
    if (blocoAmbas) {
      const simMatch = blocoAmbas[0].match(/NA=Sim;SY=dc;PY=_d;CN=1;\|PA;ID=\d+;OD=(\d+\/\d+)/);
      const naoMatch = blocoAmbas[0].match(/NA=N[^;]+o;SY=dc;PY=_d;CN=1;\|PA;ID=\d+;OD=(\d+\/\d+)/);
      if (simMatch) ambasSim = simMatch[1];
      if (naoMatch) ambasNao = naoMatch[1];
    }

    // Extrai over/under 2.5
    let mais25 = null, menos25 = null;
    const blocoGols = bloco.match(/NA=2\.5[\s\S]*?NA=Mais de;SY=dg[\s\S]*?OD=(\d+\/\d+)[\s\S]*?NA=Menos de;SY=dg[\s\S]*?OD=(\d+\/\d+)/);
    if (blocoGols) { mais25 = blocoGols[1]; menos25 = blocoGols[2]; }

    // Extrai primeiro marcador
    const primeiroMarcador = [];
    const blocoMarcador = bloco.match(/NA=Primeiro Marcador de Gol[\s\S]*?(?=\|MG;)/);
    if (blocoMarcador) {
      const ms = [...blocoMarcador[0].matchAll(/NA=([^;]+);SU=\d;OD=(\d+\/\d+);/g)];
      for (const m of ms) {
        if (!m[1].includes('Qualquer outro') && !m[1].includes('Sem Marcador')) {
          primeiroMarcador.push({ jogador: m[1], odd: m[2] });
        }
      }
    }

    const partida = {
      liga,
      id_evento: idEvento,
      data_evento: dataEvento,
      timestamp: new Date().toISOString(),
      hora,
      minuto,
      horario,
      encerrado,
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
      [slot]: placarReal,
    };

    if (placarReal) {
      partida.placar_real = placarReal;
      console.log(`BetGol: Resultado REAL capturado! ${liga} | ${timeCasa} x ${timeFora} às ${horario} = ${placarReal}`);
    }

    return partida;
  } catch (e) {
    console.error('BetGol Erro parsear bloco:', e);
    return null;
  }
}

// =========================================================================
// FUNÇÃO: Parseia o texto completo — pode conter múltiplos eventos
// =========================================================================
function parsearTexto(texto, liga) {
  const partidas = [];

  // Divide o texto em blocos por evento
  const blocos = texto.split(/(?=\|EV;ID=E)/);

  for (const bloco of blocos) {
    if (!bloco.includes('|EV;ID=E')) continue;
    const partida = parsearBloco(bloco, liga);
    if (partida) partidas.push(partida);
  }

  return partidas;
}

async function enviarParaBackend(texto, url, liga) {
  try {
    const partidas = parsearTexto(texto, liga);
    if (partidas.length === 0) return;

    for (const partida of partidas) {
      console.log(`BetGol: Enviando ${partida.time_casa} x ${partida.time_fora} (${liga}) às ${partida.horario} | encerrado: ${partida.encerrado} | placar: ${partida.placar_real || 'pendente'}`);

      // Se o jogo está encerrado, usa rota de atualizar resultado
      if (partida.encerrado && partida.placar_real) {
        await fetch(`${BACKEND_URL}/atualizar-resultado`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            liga: partida.liga,
            id_evento: partida.id_evento,
            data_evento: partida.data_evento,
            hora: partida.hora,
            minuto: partida.minuto,
            slot: `tempo${String(parseInt(partida.minuto)).padStart(2, '0')}`,
            placar_real: partida.placar_real,
          }),
        }).catch(() => {});
      } else {
        // Jogo em andamento — salva normalmente
        await fetch(`${BACKEND_URL}/capturar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partida),
        }).catch(() => {});
      }
    }

    chrome.action.setBadgeText({ text: 'OK' });
    chrome.action.setBadgeBackgroundColor({ color: '#00c853' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);

  } catch (e) {
    console.error('BetGol erro envio API:', e);
    chrome.action.setBadgeText({ text: 'ERR' });
    chrome.action.setBadgeBackgroundColor({ color: '#c0392b' });
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
