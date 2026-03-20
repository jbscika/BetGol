// Injeta o content.js no contexto MAIN da página
const script = document.createElement('script');
script.src = chrome.runtime.getURL('content.js');
script.onload = function() { this.remove(); };
(document.head || document.documentElement).appendChild(script);
