import { useEffect, useRef } from 'react';
import type { DataGridRef, GridConfig } from '@toolbox-web/grid-react';
import type { CalendarWeek } from '@demo/shared/calendar';

const DEFAULT_ROW_HEIGHT_PX = 110;

export function useDynamicRowHeight(
  gridRef: React.RefObject<DataGridRef<CalendarWeek> | null>,
  enabled: boolean,
  weekCount: number,
  gridConfig: GridConfig<CalendarWeek>,
): void {
  const configRef = useRef(gridConfig);
  configRef.current = gridConfig;

  useEffect(() => {
    if (!enabled) return;
    const grid = gridRef.current?.element;
    const viewport = grid?.querySelector<HTMLElement>('.rows-viewport');
    if (!grid || !viewport) return;

    let lastRowHeight = DEFAULT_ROW_HEIGHT_PX;
    let lastViewportHeight = viewport.clientHeight;

    const apply = () => {
      const safeWeekCount = Math.max(weekCount, 1);
      if (lastViewportHeight <= 0) return;
      const next = Math.floor(lastViewportHeight / safeWeekCount);
      if (next <= 0 || next === lastRowHeight) return;

      lastRowHeight = next;
      grid.style.setProperty('--tbw-row-height', `${next}px`);
      configRef.current = { ...configRef.current, rowHeight: next };
      grid.gridConfig = configRef.current;
    };

    apply();
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || entry.contentRect.height === lastViewportHeight) return;
      lastViewportHeight = entry.contentRect.height;
      apply();
    });
    observer.observe(viewport);

    return () => observer.disconnect();
  }, [enabled, gridRef, weekCount]);
}
