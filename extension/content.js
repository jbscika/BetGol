if (!window._betgolAtivo) {
  window._betgolAtivo = true;

  // Aguarda a página carregar completamente antes de interceptar
  function iniciarCaptura() {
    console.log('BetGol Capturador ativo!');

    // Intercepta apenas Fetch para URLs específicas
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
      const url = typeof input === 'string' ? input
        : (input instanceof Request ? input.url : String(input));

      const resposta = await originalFetch.apply(this, arguments);

      // Só intercepta URLs do futebol virtual
      if (url && url.includes('virtualsportscontentapi/coupon')) {
        try {
          const clone = resposta.clone();
          const texto = await clone.text();
          console.log('BetGol: dados capturados!', url);
          chrome.runtime.sendMessage({
            tipo: 'BETGOL_DADOS',
            fonte: 'fetch',
            dados: { url, resposta: texto, timestamp: new Date().toISOString() }
          });
        } catch (e) {
          console.error('BetGol erro:', e);
        }
      }

      return resposta;
    };
  }

  // Só inicia após a página estar completamente carregada
  if (document.readyState === 'complete') {
    setTimeout(iniciarCaptura, 3000);
  } else {
    window.addEventListener('load', () => setTimeout(iniciarCaptura, 3000));
  }
}
