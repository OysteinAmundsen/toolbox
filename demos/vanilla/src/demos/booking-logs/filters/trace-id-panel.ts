/**
 * Custom filter panel for the `traceId` column.
 *
 * Trace IDs are opaque and unique — neither a checkbox set nor a substring
 * search is meaningful. We render a single input that applies an exact-match
 * filter (`operator: 'equals'`) on Apply. The factory's `filterPanelRenderer`
 * delegates here for `field === 'traceId'`; everything else falls through
 * to the built-in panels.
 */

import type { CustomPanelParams } from './panel-types';

export function renderTraceIdPanel(container: HTMLElement, params: CustomPanelParams): void {
  const wrap = document.createElement('div');
  wrap.className = 'bl-trace-filter';

  const input = document.createElement('input');
  input.type = 'text';
  // Reuse the built-in filter plugin's input class so background, border,
  // sizing, and focus ring match the default panels exactly.
  input.className = 'tbw-filter-search-input';
  input.placeholder = 'paste trace id…';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.value = typeof params.currentFilter?.value === 'string' ? params.currentFilter.value : '';

  const buttons = document.createElement('div');
  buttons.className = 'tbw-filter-buttons';

  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'tbw-filter-apply-btn';
  apply.textContent = 'Apply';
  apply.addEventListener('click', () => {
    const v = input.value.trim();
    if (v) params.applyTextFilter('equals', v);
    else params.clearFilter();
  });

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'tbw-filter-clear-btn';
  clear.textContent = 'Clear';
  clear.addEventListener('click', () => {
    input.value = '';
    params.clearFilter();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') apply.click();
    else if (e.key === 'Escape') params.closePanel();
  });

  buttons.append(apply, clear);
  wrap.append(input, buttons);
  container.appendChild(wrap);
  // Focus next tick so the input grabs focus after the panel is in the DOM.
  queueMicrotask(() => input.focus());
}
