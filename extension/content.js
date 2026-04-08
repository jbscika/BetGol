// BetGol Capturador - intercepta ANTES da pagina carregar
if (!window._betgolAtivo) {
  window._betgolAtivo = true;

  console.log('BetGol: Interceptador de rede ativado no site!');

  // 1. Intercepta FETCH
  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
    const resposta = await originalFetch.apply(this, arguments);

    if (url && url.includes('virtualsportscontentapi/coupon')) {
      try {
        const clone = resposta.clone();
        const texto = await clone.text();
        console.log('BetGol: Fetch capturado!');
        
        // ENVIA VIA POSTMESSAGE (PONTE)
        window.postMessage({
          tipo: 'BETGOL_DADOS_BRUTO',
          dados: { url, resposta: texto, timestamp: new Date().toISOString() }
        }, "*");
      } catch (e) {
        console.error('BetGol erro fetch:', e);
      }
    }
    return resposta;
  };

  // 2. Intercepta XHR (Fallback)
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._betgolUrl = url;
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
      if (this._betgolUrl && this._betgolUrl.includes('virtualsportscontentapi/coupon')) {
        console.log('BetGol: XHR capturado!');
        
        // ENVIA VIA POSTMESSAGE (PONTE)
        window.postMessage({
          tipo: 'BETGOL_DADOS_BRUTO',
          dados: { url: this._betgolUrl, resposta: this.responseText, timestamp: new Date().toISOString() }
        }, "*");
      }
    });
    return origSend.apply(this, arguments);
  };
}
