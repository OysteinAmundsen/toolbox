/**
 * Booking-Logs Demo — side detail panel.
 *
 * Pure DOM. Owns no state beyond the current entry; controlled entirely by
 * `show(entry)` / `hide()` from the route module.
 */

import { buildHttpTrace, type BookingLogEntry } from '@demo/shared/booking-logs';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Highlight the request/status line and JSON-ish bits of a synthetic HTTP
 * trace. The input is the raw text from `buildHttpTrace`, which we trust
 * because we generated it ourselves — but still escape before injecting.
 */
function highlightTrace(text: string): string {
  const lines = text.split('\n');
  return lines
    .map((raw) => {
      const escaped = escapeHtml(raw);
      // Status / request line at index 0 of each block.
      if (/^HTTP\/\d/.test(raw)) {
        return `<span class="bl-trace-status">${escaped}</span>`;
      }
      if (/^(GET|POST|PUT|PATCH|DELETE)\s/.test(raw)) {
        return `<span class="bl-trace-reqline">${escaped}</span>`;
      }
      // Header line: `Name: value`
      const headerMatch = /^([A-Za-z][A-Za-z0-9-]*): (.*)$/.exec(raw);
      if (headerMatch) {
        return `<span class="bl-trace-key">${escapeHtml(headerMatch[1])}</span>: <span class="bl-trace-val">${escapeHtml(headerMatch[2])}</span>`;
      }
      return escaped;
    })
    .join('\n');
}

function formatRow(entry: BookingLogEntry): string {
  // Trace ID gets a custom inline button — pulled out of the generic field
  // list so we can drop a "Show trace" CTA right next to the value without
  // breaking the dl layout for the other fields.
  const fields: Array<[string, string]> = [
    ['Timestamp', entry.timestamp],
    ['Span ID', entry.spanId],
    ['Parent span', entry.parentSpanId ?? '(root)'],
    ['Level', entry.level],
    ['Method', entry.method],
    ['Endpoint', entry.endpoint],
    ['Status', String(entry.statusCode)],
    ['Duration', `${entry.durationMs} ms`],
    ['Service', entry.service],
    ['Region', entry.region],
    ['Customer ID', entry.customerId ?? '(anonymous)'],
    ['Booking ref', entry.bookingRef ?? '—'],
    ['Client IP', entry.clientIp],
    ['User-Agent', entry.userAgent],
  ];

  const traceRow = /* html */ `
    <dt>Trace ID</dt>
    <dd class="bl-detail-trace-row">
      <code class="bl-detail-trace-id">${escapeHtml(entry.traceId)}</code>
      <button
        type="button"
        class="bl-detail-show-trace"
        data-action="show-trace"
        data-trace-id="${escapeHtml(entry.traceId)}"
        title="Filter the grid to show only spans of this trace"
        aria-label="Show trace ${escapeHtml(entry.traceId)}"
      >🔗</button>
    </dd>
  `;

  const dl =
    traceRow + fields.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('');

  const errorBox = entry.errorMessage
    ? `<div class="error-box" data-testid="bl-error-box">${escapeHtml(entry.errorMessage)}</div>`
    : '';

  const trace = buildHttpTrace(entry);
  const statusClass =
    entry.statusCode >= 500
      ? 'is-5xx'
      : entry.statusCode >= 400
        ? 'is-4xx'
        : entry.statusCode >= 300
          ? 'is-3xx'
          : 'is-2xx';

  return /* html */ `
    <div class="booking-logs-detail-header">
      <h2>Log entry · row ${entry.id.toLocaleString('en-US')}</h2>
      <button type="button" class="close-btn" aria-label="Close detail panel" data-close>×</button>
    </div>
    <div class="booking-logs-detail-body">
      <dl>${dl}</dl>
      ${errorBox}
      <section class="bl-trace" data-testid="bl-trace-request">
        <h3>Request</h3>
        <pre class="bl-trace-block"><code>${highlightTrace(trace.request)}</code></pre>
      </section>
      <section class="bl-trace ${statusClass}" data-testid="bl-trace-response">
        <h3>Response</h3>
        <pre class="bl-trace-block"><code>${highlightTrace(trace.response)}</code></pre>
      </section>
    </div>
  `;
}

export interface DetailPanelHandle {
  element: HTMLElement;
  show(entry: BookingLogEntry): void;
  hide(): void;
  isOpen(): boolean;
  onClose(handler: () => void): () => void;
  /** Subscribe to "Show trace" button clicks inside the detail panel. */
  onShowTrace(handler: (traceId: string) => void): () => void;
}

export function createDetailPanel(): DetailPanelHandle {
  const element = document.createElement('aside');
  element.className = 'booking-logs-detail';
  element.setAttribute('aria-label', 'Log entry detail');
  element.style.display = 'none';
  element.setAttribute('data-testid', 'bl-detail-panel');

  let open = false;
  const closeHandlers = new Set<() => void>();
  const showTraceHandlers = new Set<(traceId: string) => void>();

  element.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const showTraceBtn = target.closest<HTMLElement>('[data-action="show-trace"]');
    if (showTraceBtn) {
      const id = showTraceBtn.getAttribute('data-trace-id') ?? '';
      if (id) for (const h of showTraceHandlers) h(id);
      return;
    }
    if (target.closest('[data-close]')) {
      hide();
      for (const h of closeHandlers) h();
    }
  });

  function show(entry: BookingLogEntry): void {
    element.innerHTML = formatRow(entry);
    element.style.display = 'flex';
    open = true;
  }

  function hide(): void {
    element.style.display = 'none';
    element.innerHTML = '';
    open = false;
  }

  function isOpen(): boolean {
    return open;
  }

  function onClose(handler: () => void): () => void {
    closeHandlers.add(handler);
    return () => closeHandlers.delete(handler);
  }

  function onShowTrace(handler: (traceId: string) => void): () => void {
    showTraceHandlers.add(handler);
    return () => showTraceHandlers.delete(handler);
  }

  return { element, show, hide, isOpen, onClose, onShowTrace };
}
