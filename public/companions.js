/* Code-native pixel characters; state follows actual AI requests, not timers. */
'use strict';
(function () {
  const bodies = {
    barista: `<g class="character-body"><path fill="#392518" d="M8 8h18v3h5v10h-5v3h-3v4H10v-4H7V11h1zm18 6v4h2v-4z"/><path fill="#fff0cf" d="M9 10h15v12H11v-2H9z"/><path fill="#80502e" d="M10 11h13v3H10z"/><path fill="#e8b873" d="M21 15h3v7h-4v2h-8v-2h9z"/><g class="character-eyes" fill="#392518"><path d="M12 16h2v2h-2zm7 0h2v2h-2z"/></g><path fill="#ae6744" d="M15 20h4v1h-4z"/><path fill="#799259" d="M10 25h13v10H10z"/><path fill="#dae4a4" d="M13 27h7v6h-7z"/><path fill="#392518" d="M10 35h5v3H9v-2h1zm9 0h4v1h2v2h-6z"/><g class="character-hand"><path fill="#fff0cf" d="M5 25h5v4H5zm18 0h5v4h-5z"/><path fill="#d7a966" d="M26 21h2v8h-2z"/></g></g><g class="character-steam" fill="#ffe2aa"><path d="M12 2h2v3h-2v3h-2V4h2zm7-1h2v3h-2v3h-2V3h2z"/></g>`,
    brewer: `<g class="character-body"><path fill="#211b39" d="M10 11h15v3h4v5h3v3h-5v5H8v-3H5V13h5z"/><path fill="#b8a0e3" d="M10 13h14v2h3v8h-3v3H10v-3H8v-8h2z"/><path fill="#e9d6ff" d="M11 14h3v10h-3zM10 9h15v3H10zm5-4h5v4h-5z"/><path fill="#8464b5" d="M21 15h3v9h-3zM3 15h3v8H3z"/><g class="character-eyes" fill="#211b39"><path d="M13 17h2v2h-2zm7 0h2v2h-2z"/></g><path fill="#f3afcf" d="M16 21h4v1h-4z"/><path fill="#755a91" d="M11 27h13v8H11z"/><path fill="#e9d6ff" d="M14 28h7v5h-7z"/><path fill="#211b39" d="M10 35h6v3H9v-2h1zm10 0h4v1h2v2h-6z"/><g class="character-hand"><path fill="#b8a0e3" d="M6 26h5v4H6zm18 0h5v4h-5z"/><path fill="#f2c980" d="M27 19h2v11h-2z"/></g></g><g class="character-steam" fill="#e6c7ff"><path d="M27 3h2v3h-2v3h-2V5h2zm-4-3h2v3h-2v3h-2V2h2z"/></g>`
  };
  function portrait(kind) {
    return `<svg class="companion-art" viewBox="0 0 36 42" aria-hidden="true"><ellipse cx="18" cy="39" rx="13" ry="2" fill="#080817" opacity=".25"/>${bodies[kind]}<g class="character-spark" fill="#f7cf89"><path d="M1 9h2v2H1zm29 22h2v2h-2z"/></g></svg>`;
  }
  document.querySelectorAll('[data-companion]').forEach(host => {
    const kind = host.dataset.companion;
    if (!bodies[kind]) return;
    const name = kind === 'barista' ? 'Barista' : 'Brewer';
    host.innerHTML = `${portrait(kind)}<div><h2>${name}</h2><p class="companion-status" role="status" aria-live="polite">${kind === 'barista' ? 'Ready for your next question.' : 'Ready to brew your notes.'}</p></div><span class="brew-bubbles" aria-hidden="true">▪ ▪ ▪</span>`;
  });
  window.CoffeeCompanions = {
    portrait,
    setBusy(kind, busy) {
      document.querySelectorAll(`[data-companion="${kind}"]`).forEach(host => {
        host.classList.toggle('is-busy', busy);
        host.dataset.state = busy ? 'thinking' : 'ready';
        host.querySelector('.companion-status').textContent = busy
          ? (kind === 'barista' ? 'Thinking through your question…' : 'Stirring your ideas into notes…')
          : (kind === 'barista' ? 'Ready for your next question.' : 'Ready to brew your notes.');
      });
    }
  };
})();
