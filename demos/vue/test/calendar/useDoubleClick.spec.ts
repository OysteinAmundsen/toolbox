import { describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { buildWeeks, generateEvents } from '@demo/shared/calendar';
import { resolveDayFromCell } from '../../src/demos/calendar/composables/useDoubleClick';

const window = new Window();
window.SyntaxError = SyntaxError;
const document = window.document;

function makeGrid() {
  const rows = buildWeeks(2026, 0, generateEvents(2026, 0).byDate);
  return Object.assign(document.createElement('tbw-grid'), { rows });
}

function makeCell(colIndex: number, ariaRowIndex: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'data-grid-row';
  row.setAttribute('aria-rowindex', String(ariaRowIndex));
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.setAttribute('data-col', String(colIndex));
  row.appendChild(cell);
  return cell;
}

describe('calendar double-click helpers', () => {
  test('resolveDayFromCell returns null for the week-number column', () => {
    const grid = makeGrid();
    const cell = makeCell(0, 2);
    grid.appendChild(cell.parentElement!);

    expect(resolveDayFromCell(grid, cell)).toBeNull();
  });

  test('resolveDayFromCell maps grid DOM coordinates to the CalendarDay payload', () => {
    const grid = makeGrid();
    const cell = makeCell(4, 2);
    grid.appendChild(cell.parentElement!);

    const day = resolveDayFromCell(grid, cell);

    expect(day?.date.getFullYear()).toBe(2026);
    expect(day?.date.getMonth()).toBe(0);
    expect(day?.date.getDate()).toBe(1);
  });
});
