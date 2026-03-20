// Intercepta requisições XHR da Bet365
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url) {
  this._url = url;
  return originalOpen.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function() {
  this.addEventListener('load', function() {
    if (this._url && this._url.includes('virtualsportscontentapi/coupon')) {
      try {
        const dados = {
          url: this._url,
          resposta: this.responseText,
          timestamp: new Date().toISOString(),
        };
        // Envia para o background script
        window.postMessage({
          tipo: 'BETGOL_DADOS',
          dados: dados,
        }, '*');
      } catch (e) {
        console.error('BetGol erro:', e);
      }
    }
  });
  return originalSend.apply(this, arguments);
};

// Intercepta também fetch
const originalFetch = window.fetch;
window.fetch = async function(input, init) {
  const url = typeof input === 'string' ? input : input.url;
  const resposta = await originalFetch.apply(this, arguments);
  
  if (url && url.includes('virtualsportscontentapi/coupon')) {
    try {
      const clone = resposta.clone();
      const texto = await clone.text();
      window.postMessage({
        tipo: 'BETGOL_DADOS',
        dados: {
          url: url,
          resposta: texto,
          timestamp: new Date().toISOString(),
        },
      }, '*');
    } catch (e) {
      console.error('BetGol fetch erro:', e);
    }
  }
  
  return resposta;
};

// Escuta mensagens do background
window.addEventListener('message', function(event) {
  if (event.data && event.data.tipo === 'BETGOL_DADOS') {
    chrome.runtime.sendMessage(event.data);
  }
});

console.log('BetGol Capturador ativo!');
