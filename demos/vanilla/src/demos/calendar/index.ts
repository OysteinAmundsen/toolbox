/**
 * Calendar route (vanilla)
 *
 * Mounts a month-view calendar built on top of `<tbw-grid>`. See
 * `./grid-factory.ts` for the grid wiring and `./renderers.ts` for the
 * shared day-cell renderer. Types + raw event data come from
 * `@demo/shared/calendar` so all four framework demos share the same
 * deterministic dataset; everything else (grid config, renderers,
 * styles, dialog, density observer) is vanilla-DOM here so each
 * framework demo can showcase its own idiomatic implementation.
 */

import './styles.css';

import { createCalendarGrid } from './grid-factory';

const LAYOUT_HTML = /* html */ `
  <div class="demo-container">
    <div class="calendar-demo">
      <!-- grid mounts here -->
    </div>
  </div>
`;

export function mount(host: HTMLElement): () => void {
  host.innerHTML = LAYOUT_HTML;
  const wrapper = host.querySelector<HTMLDivElement>('.calendar-demo');
  if (!wrapper) {
    throw new Error('calendar route: missing .calendar-demo wrapper');
  }

  const handle = createCalendarGrid();
  wrapper.appendChild(handle.grid);

  return () => {
    handle.destroy();
    handle.grid.remove();
    host.innerHTML = '';
  };
}

