/**
 * Custom filter panel for the `statusCode` column — built for log triage.
 *
 * UI layout:
 * - Five preset buttons (2xx, 3xx, 4xx, 5xx, all errors) → `between [min, max]`.
 *   Presets that fall outside the reachable envelope (computed from the level
 *   filter) are rendered disabled with a tooltip explaining why.
 * - "Specific code" dropdown listing the actual `STATUS_CODES` vocabulary
 *   (200, 201, …, 504) → `equals` operator.
 * - Clear button.
 *
 * The active preset is highlighted by inspecting `currentFilter` — `between`
 * matches a preset id; `equals` matches the dropdown.
 */

import type { BookingLogEntry, LogLevel } from '@demo/shared/booking-logs';
import { LEVELS, STATUS_CODES } from '@demo/shared/booking-logs';
import type { DataGridElement } from '@toolbox-web/grid/all';

import type { DemoFilterModel } from '../types';
import type { CustomPanelParams } from './panel-types';

/**
 * HTTP status classes a devops typically wants as one-click presets when
 * triaging logs. Each entry maps to a `between [min, max]` filter on the
 * `statusCode` column.
 */
type StatusPreset = { id: string; label: string; min: number; max: number };
const STATUS_PRESETS: readonly StatusPreset[] = [
  { id: '2xx', label: '2xx Success', min: 200, max: 299 },
  { id: '3xx', label: '3xx Redirect', min: 300, max: 399 },
  { id: '4xx', label: '4xx Client errors', min: 400, max: 499 },
  { id: '5xx', label: '5xx Server errors', min: 500, max: 599 },
  { id: 'errors', label: 'All errors (4xx + 5xx)', min: 400, max: 599 },
];

/**
 * Compute the [min, max] status-code envelope a row could possibly carry given
 * the active level filter. Mirrors the correlation in
 * `demos/shared/booking-logs/generator.ts`:
 *
 * - DEBUG / INFO → 2xx, 3xx
 * - WARN         → 4xx
 * - ERROR        → 4xx, 5xx
 *
 * Used to grey out preset buttons that can never match (e.g. "5xx" when the
 * level filter excludes ERROR), so the panel honestly reflects what the
 * user could actually see.
 */
function reachableStatusEnvelope(activeLevels: ReadonlySet<LogLevel>): { min: number; max: number } {
  if (activeLevels.size === 0) return { min: 200, max: 599 };
  let min = Infinity;
  let max = -Infinity;
  if (activeLevels.has('DEBUG') || activeLevels.has('INFO')) {
    min = Math.min(min, 200);
    max = Math.max(max, 399);
  }
  if (activeLevels.has('WARN')) {
    min = Math.min(min, 400);
    max = Math.max(max, 499);
  }
  if (activeLevels.has('ERROR')) {
    min = Math.min(min, 400);
    max = Math.max(max, 599);
  }
  return { min, max };
}

/**
 * Read the active level allow-list from the filtering plugin's level filter.
 *
 * The set filter stores **excluded** levels (`operator: 'notIn'`); we invert
 * to the set of levels that pass the filter. An empty filter (no entry)
 * means "no restriction" — return an empty set, which {@link reachableStatusEnvelope}
 * treats as "all levels possible".
 */
function getActiveLevels(grid: DataGridElement<BookingLogEntry>): Set<LogLevel> {
  const filtering = grid.getPluginByName?.('filtering') as
    | { getFilter?: (field: string) => DemoFilterModel | undefined }
    | undefined;
  const levelFilter = filtering?.getFilter?.('level');
  if (!levelFilter || !Array.isArray(levelFilter.value)) return new Set();
  if (levelFilter.operator === 'in') return new Set(levelFilter.value as LogLevel[]);
  if (levelFilter.operator === 'notIn') {
    const excluded = new Set(levelFilter.value as LogLevel[]);
    return new Set(LEVELS.filter((l) => !excluded.has(l)));
  }
  return new Set();
}

export function renderStatusPanel(
  container: HTMLElement,
  params: CustomPanelParams,
  grid: DataGridElement<BookingLogEntry>,
): void {
  const wrap = document.createElement('div');
  wrap.className = 'bl-status-filter';

  const cur = params.currentFilter;
  const curMin = typeof cur?.value === 'number' ? cur.value : undefined;
  const curMax = typeof cur?.valueTo === 'number' ? cur.valueTo : undefined;
  const activePresetId =
    cur?.operator === 'between' && curMin !== undefined && curMax !== undefined
      ? STATUS_PRESETS.find((p) => p.min === curMin && p.max === curMax)?.id
      : undefined;
  const activeSpecific = cur?.operator === 'equals' && typeof cur.value === 'number' ? cur.value : undefined;

  const reachable = reachableStatusEnvelope(getActiveLevels(grid));

  // Section: presets
  const presetGroup = document.createElement('div');
  presetGroup.className = 'bl-status-presets';
  for (const preset of STATUS_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bl-status-preset';
    if (preset.id === activePresetId) btn.classList.add('is-active');
    btn.textContent = preset.label;
    const reachableForPreset = preset.min <= reachable.max && preset.max >= reachable.min;
    if (!reachableForPreset) {
      btn.disabled = true;
      btn.title = 'No rows match this with the current Level filter';
    }
    btn.addEventListener('click', () => {
      params.applyTextFilter('between', preset.min, preset.max);
    });
    presetGroup.appendChild(btn);
  }

  // Section: specific code
  const specificRow = document.createElement('div');
  specificRow.className = 'bl-status-specific';
  const label = document.createElement('label');
  label.textContent = 'Specific code:';
  const select = document.createElement('select');
  // Reuse the built-in input class so the dropdown matches the panel's
  // input styling (background, border, focus ring).
  select.className = 'tbw-filter-search-input';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— pick code —';
  select.appendChild(placeholder);
  for (const code of STATUS_CODES) {
    const opt = document.createElement('option');
    opt.value = String(code);
    opt.textContent = String(code);
    if (code < reachable.min || code > reachable.max) {
      opt.disabled = true;
      opt.textContent = `${code} (no match)`;
    }
    if (activeSpecific === code) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener('change', () => {
    if (!select.value) return;
    params.applyTextFilter('equals', Number(select.value));
  });
  label.appendChild(select);

  // Section: clear (wrapped in tbw-filter-buttons to inherit the built-in
  // panel's footer divider + spacing).
  const buttons = document.createElement('div');
  buttons.className = 'tbw-filter-buttons';
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'tbw-filter-clear-btn';
  clear.textContent = 'Clear filter';
  clear.disabled = !cur;
  clear.addEventListener('click', () => params.clearFilter());
  buttons.appendChild(clear);

  specificRow.appendChild(label);
  wrap.append(presetGroup, specificRow, buttons);
  container.appendChild(wrap);
}
