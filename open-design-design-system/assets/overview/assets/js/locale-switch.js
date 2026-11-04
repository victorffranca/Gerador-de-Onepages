// Locale switcher — somente a UI do dropdown (<details>): fecha ao clicar fora
// e com Escape. Esta é uma página única de showcase: o roteamento por idioma
// do site original (auto-redirect na carga via navigator.language + navegação
// por locale nos links) foi REMOVIDO — apontava para rotas inexistentes
// (`/pt-br/.../`) e fazia a página cair num 404 ao abrir.
(() => {
  // Os links de idioma não navegam: não existe outra rota nesta página única.
  for (const link of document.querySelectorAll('[data-locale-link]')) {
    if (link.dataset.localeBound === 'true') continue;
    link.dataset.localeBound = 'true';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const details = link.closest('[data-locale-switch]');
      if (details && details.open) details.open = false;
    });
  }

  // <details> nativo fica aberto até clicar no summary de novo. Fecha ao clicar
  // fora ou apertar Escape, pra se comportar como um menu de verdade.
  document.addEventListener('click', (event) => {
    const target = event.target;
    for (const details of document.querySelectorAll('[data-locale-switch][open]')) {
      if (target instanceof Node && details.contains(target)) continue;
      details.open = false;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    for (const details of document.querySelectorAll('[data-locale-switch][open]')) {
      details.open = false;
      const summary = details.querySelector('summary');
      if (summary instanceof HTMLElement) summary.focus();
    }
  });
})();
