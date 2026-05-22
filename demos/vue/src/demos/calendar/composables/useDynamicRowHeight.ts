import type { DataGridElement, GridConfig } from '@toolbox-web/grid';
import type { CalendarWeek } from '@demo/shared/calendar';

export const DEFAULT_ROW_HEIGHT_PX = 110;

export function calculateCalendarRowHeight(viewportHeight: number, weekCount: number): number | null {
  if (viewportHeight <= 0 || weekCount <= 0) return null;
  return Math.floor(viewportHeight / weekCount);
}

export function useDynamicRowHeight(options: {
  grid: DataGridElement<CalendarWeek>;
  getRows: () => readonly CalendarWeek[];
  patchGridConfig: (patch: Partial<GridConfig<CalendarWeek>>) => void;
}): { cleanup: () => void; apply: () => void } {
  let lastViewportHeight = 0;
  let lastRowHeight = DEFAULT_ROW_HEIGHT_PX;

  const apply = (): void => {
    const next = calculateCalendarRowHeight(lastViewportHeight, Math.max(options.getRows().length, 1));
    if (!next || next === lastRowHeight) return;
    lastRowHeight = next;
    options.grid.style.setProperty('--tbw-row-height', `${next}px`);
    options.patchGridConfig({ rowHeight: next });
  };

  const viewport = options.grid.querySelector<HTMLElement>('.rows-viewport');
  if (viewport) {
    lastViewportHeight = viewport.clientHeight;
    apply();
  }

  const ro = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    lastViewportHeight = entry.contentRect.height;
    apply();
  });
  if (viewport) ro.observe(viewport);

  return { cleanup: () => ro.disconnect(), apply };
}
