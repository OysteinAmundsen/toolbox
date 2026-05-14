/**
 * Booking-Logs Route (Vanilla)
 *
 * Mounts the booking-logs demo: a server-side `<tbw-grid>` with the filtering
 * plugin owning all filter UI in the column headers, and a side detail panel
 * that opens when the user activates a row (double-click or Enter).
 *
 * The grid pulls pages from `GET /api/logs` (Vite middleware) using the
 * server-side plugin in infinite-scroll mode. See `grid-factory.ts` for the
 * grid configuration and `demos/shared/booking-logs/` for the shared
 * generator + types.
 */

import '@demo/shared/booking-logs/demo-styles.css';

import { createDetailPanel } from './detail-panel';
import { createBookingLogsGrid } from './grid-factory';

const LAYOUT_HTML = /* html */ `
  <div class="demo-container">
    <div class="booking-logs-layout" data-testid="booking-logs-layout">
      <section class="booking-logs-grid-pane">
        <!-- grid mounts here -->
      </section>
      <!-- detail panel is appended after the grid pane -->
    </div>
  </div>
`;

export function mount(host: HTMLElement): () => void {
  host.innerHTML = LAYOUT_HTML;

  const layout = host.querySelector<HTMLElement>('.booking-logs-layout');
  const pane = host.querySelector<HTMLElement>('.booking-logs-grid-pane');
  if (!layout || !pane) {
    throw new Error('booking-logs route: missing layout elements');
  }

  const { grid, onRowActivate, onFilterChange, showTrace } = createBookingLogsGrid();
  pane.appendChild(grid);

  const detail = createDetailPanel();
  layout.appendChild(detail.element);

  const offRowActivate = onRowActivate((entry) => {
    detail.show(entry);
    layout.classList.add('has-detail');
  });
  const offClose = detail.onClose(() => {
    layout.classList.remove('has-detail');
  });
  // "Show trace" button in the detail panel pivots the grid to that trace
  // *without* closing the drawer — the user can still see the focused
  // row's full payload while exploring its sibling spans. Hiding would
  // also fight `onFilterChange` below, which closes the drawer on every
  // filter change as a stale-data safety net.
  //
  // Two handlers are registered, and **the guard MUST come first**: the
  // second handler synchronously calls `showTrace()`, which immediately
  // emits `filter-change` → the `onFilterChange` listener below runs
  // before the click bubble unwinds. If the guard ran second, it would
  // set `suppressNextHide` only after `onFilterChange` had already
  // closed the drawer.
  let suppressNextHide = false;
  const offShowTraceGuard = detail.onShowTrace(() => {
    suppressNextHide = true;
  });
  const offShowTrace = detail.onShowTrace((traceId) => {
    showTrace(traceId);
  });
  const offFilterChange = onFilterChange(() => {
    if (suppressNextHide) {
      suppressNextHide = false;
      return;
    }
    detail.hide();
    layout.classList.remove('has-detail');
  });

  return () => {
    offRowActivate();
    offClose();
    offShowTrace();
    offShowTraceGuard();
    offFilterChange();
    grid.remove();
    detail.element.remove();
    host.innerHTML = '';
  };
}
