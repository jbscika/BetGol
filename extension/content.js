console.log('BetGol Capturador ativo!');

// Intercepta XHR
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url) {
  this._url = url;
  return originalOpen.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function() {
  this.addEventListener('load', function() {
    if (this._url && this._url.includes('virtualsportscontentapi/coupon')) {
      console.log('BetGol: dados XHR capturados!', this._url);
      chrome.runtime.sendMessage({
        tipo: 'BETGOL_DADOS',
        dados: {
          url: this._url,
          resposta: this.responseText,
          timestamp: new Date().toISOString(),
        }
      });
    }
  });
  return originalSend.apply(this, arguments);
};

// Intercepta Fetch
const originalFetch = window.fetch;
window.fetch = async function(input, init) {
  const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
  const resposta = await originalFetch.apply(this, arguments);

  if (url && url.includes('virtualsportscontentapi/coupon')) {
    try {
      const clone = resposta.clone();
      const texto = await clone.text();
      console.log('BetGol: dados Fetch capturados!', url);
      chrome.runtime.sendMessage({
        tipo: 'BETGOL_DADOS',
        dados: {
          url: url,
          resposta: texto,
          timestamp: new Date().toISOString(),
        }
      });
    } catch (e) {
      console.error('BetGol fetch erro:', e);
    }
  }

  return resposta;
};
