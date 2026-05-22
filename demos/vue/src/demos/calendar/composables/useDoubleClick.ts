import type { DataGridElement } from '@toolbox-web/grid';
import type { CalendarDay, CalendarWeek } from '@demo/shared/calendar';
import { WEEKDAY_FIELDS } from '@demo/shared/calendar';

const DBLCLICK_MS = 400;

export function resolveDayFromCell(grid: { rows?: CalendarWeek[] }, cell: HTMLElement): CalendarDay | null {
  const colIndexAttr = cell.getAttribute('data-col');
  if (colIndexAttr === null) return null;
  const colIndex = Number(colIndexAttr);
  if (colIndex <= 0) return null;

  const rowEl = cell.closest<HTMLElement>('.data-grid-row');
  if (!rowEl) return null;
  const ariaRowIndex = Number(rowEl.getAttribute('aria-rowindex'));
  if (!Number.isFinite(ariaRowIndex)) return null;

  const rowIndex = ariaRowIndex - 2;
  const week = grid.rows?.[rowIndex];
  const field = WEEKDAY_FIELDS[colIndex - 1];
  return field && week ? week[field] : null;
}

export function useDoubleClick(
  grid: DataGridElement<CalendarWeek>,
  openDialog: (day: CalendarDay) => void,
): () => void {
  let lastMousedownCell: HTMLElement | null = null;
  let lastMousedownTime = 0;

  const onMousedown: EventListener = (event): void => {
    const ev = event as MouseEvent;
    if (ev.button !== 0) return;
    const cell = (ev.target as HTMLElement | null)?.closest<HTMLElement>('.cell[data-col]');
    if (!cell) {
      lastMousedownCell = null;
      return;
    }

    const now = ev.timeStamp;
    if (lastMousedownCell === cell && now - lastMousedownTime < DBLCLICK_MS) {
      lastMousedownCell = null;
      lastMousedownTime = 0;
      const day = resolveDayFromCell(grid, cell);
      if (day) openDialog(day);
      return;
    }

    lastMousedownCell = cell;
    lastMousedownTime = now;
  };

  grid.addEventListener('mousedown', onMousedown, true);
  return () => grid.removeEventListener('mousedown', onMousedown, true);
}
