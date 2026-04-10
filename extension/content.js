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
        console.log('BetGol DEBUG tamanho total:', texto.length);
        console.log('BetGol DEBUG INICIO:', texto.substring(0, 1000));
        console.log('BetGol DEBUG MEIO:', texto.substring(Math.floor(texto.length / 2) - 500, Math.floor(texto.length / 2) + 500));
        console.log('BetGol DEBUG FIM:', texto.substring(texto.length - 1000));
        console.log('BetGol DEBUG TEM SU=1:', texto.includes('SU=1'));
        console.log('BetGol DEBUG TEM SU=2:', texto.includes('SU=2'));

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
        const texto = this.responseText;
        console.log('BetGol: XHR capturado!');
        console.log('BetGol DEBUG tamanho total:', texto.length);
        console.log('BetGol DEBUG INICIO:', texto.substring(0, 1000));
        console.log('BetGol DEBUG MEIO:', texto.substring(Math.floor(texto.length / 2) - 500, Math.floor(texto.length / 2) + 500));
        console.log('BetGol DEBUG FIM:', texto.substring(texto.length - 1000));
        console.log('BetGol DEBUG TEM SU=1:', texto.includes('SU=1'));
        console.log('BetGol DEBUG TEM SU=2:', texto.includes('SU=2'));

        window.postMessage({
          tipo: 'BETGOL_DADOS_BRUTO',
          dados: { url: this._betgolUrl, resposta: texto, timestamp: new Date().toISOString() }
        }, "*");
      }
    });
    return origSend.apply(this, arguments);
  };
}
