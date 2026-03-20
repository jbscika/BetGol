// Atualiza contador
chrome.storage.local.get(['contador'], (result) => {
  document.getElementById('contador').textContent = result.contador || 0;
});

// Verifica se está na Bet365
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0] && tabs[0].url && tabs[0].url.includes('bet365')) {
    document.getElementById('status').className = 'status ativo';
    document.getElementById('status').textContent = '✅ Capturando dados automaticamente';
  }
});

// Abre o app BetGol
function abrirApp() {
  chrome.tabs.create({ url: 'https://bet-gol.vercel.app' });
}
