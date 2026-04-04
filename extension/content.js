// BetGol Capturador - intercepta ANTES da pagina carregar
if (!window._betgolAtivo) {
  window._betgolAtivo = true;

  console.log('BetGol: interceptando fetch...');

  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input
      : (input instanceof Request ? input.url : String(input));

    const resposta = await originalFetch.apply(this, arguments);

    if (url && url.includes('virtualsportscontentapi/coupon')) {
      try {
        const clone = resposta.clone();
        const texto = await clone.text();
        console.log('BetGol: capturado!', url.substring(0, 80));
        chrome.runtime.sendMessage({
          tipo: 'BETGOL_DADOS',
          dados: { url, resposta: texto, timestamp: new Date().toISOString() }
        });
      } catch (e) {
        console.error('BetGol erro fetch:', e);
      }
    }

    return resposta;
  };

  // Intercepta XHR tambem como fallback
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._betgolUrl = url;
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
      if (this._betgolUrl && this._betgolUrl.includes('virtualsportscontentapi/coupon')) {
        console.log('BetGol: capturado via XHR!', this._betgolUrl.substring(0, 80));
        chrome.runtime.sendMessage({
          tipo: 'BETGOL_DADOS',
          dados: { url: this._betgolUrl, resposta: this.responseText, timestamp: new Date().toISOString() }
        });
      }
    });
    return origSend.apply(this, arguments);
  };

  console.log('BetGol Capturador ativo!');
}
