/**
 * Demo index page — rendered at `/` when no demo route matches.
 *
 * Lists every registered route as a card linking to `/<route-name>`.
 * Used by the vanilla shell only; React/Vue/Angular shells render their
 * own equivalent components.
 */

import type { RouteDefinition } from './router';

export function renderDemoIndex(host: HTMLElement, routes: readonly RouteDefinition[]): () => void {
  const cards = routes
    .map(
      (r) => /* html */ `
        <li class="demo-index-card">
          <a class="demo-index-link" href="/${r.name}">
            <h2 class="demo-index-title">${escapeHtml(r.label)}</h2>
            ${r.description ? `<p class="demo-index-description">${escapeHtml(r.description)}</p>` : ''}
            <span class="demo-index-route">/${r.name}</span>
          </a>
        </li>`,
    )
    .join('');

  host.innerHTML = /* html */ `
    <main class="demo-index">
      <header class="demo-index-header">
        <h1>Toolbox Web — Vanilla Demos</h1>
        <p>Pick a demo below or navigate directly via URL.</p>
      </header>
      <ul class="demo-index-list">${cards}</ul>
    </main>
  `;

  // Intercept anchor clicks so we use pushState navigation instead of a full reload.
  const onClick = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor = (event.target as HTMLElement).closest('a.demo-index-link') as HTMLAnchorElement | null;
    if (!anchor) return;
    const url = new URL(anchor.href);
    if (url.origin !== window.location.origin) return;
    event.preventDefault();
    window.history.pushState({}, '', url.pathname);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  host.addEventListener('click', onClick);

  return () => host.removeEventListener('click', onClick);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
