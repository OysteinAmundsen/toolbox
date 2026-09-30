import type { CalendarWeek } from '@demo/shared/calendar';
import type { DataGridRef } from '@toolbox-web/grid-react';
import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';

const DEFAULT_ROW_HEIGHT_PX = 110;

// The height must flow back through the gridConfig prop: the adapter re-applies that
// prop, and the grid resets `--tbw-row-height` from `rowHeight` on every config merge.
export function useDynamicRowHeight(
  gridRef: React.RefObject<DataGridRef<CalendarWeek> | null>,
  enabled: boolean,
  weekCount: number,
  onRowHeight: (height: number) => void,
): void {
  const onRowHeightRef = useRef(onRowHeight);
  onRowHeightRef.current = onRowHeight;

  useEffect(() => {
    if (!enabled) return;
    const grid = gridRef.current?.element;
    const viewport = grid?.querySelector<HTMLElement>('.rows-viewport');
    if (!grid || !viewport) return;

    let lastRowHeight = DEFAULT_ROW_HEIGHT_PX;
    let lastViewportHeight = viewport.clientHeight;

    const apply = (sync: boolean) => {
      const safeWeekCount = Math.max(weekCount, 1);
      if (lastViewportHeight <= 0) return;
      const next = Math.floor(lastViewportHeight / safeWeekCount);
      if (next <= 0 || next === lastRowHeight) return;

      lastRowHeight = next;
      grid.style.setProperty('--tbw-row-height', `${next}px`);
      // Sync commit keeps gridConfig.rowHeight (virtual spacer) in step with the CSS var;
      // a lagging value overflows the viewport by a few px and flashes a scrollbar.
      if (sync) flushSync(() => onRowHeightRef.current(next));
      else onRowHeightRef.current(next);
    };

    apply(false);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || entry.contentRect.height === lastViewportHeight) return;
      lastViewportHeight = entry.contentRect.height;
      apply(true);
    });
    observer.observe(viewport);

    return () => observer.disconnect();
  }, [enabled, gridRef, weekCount]);
}
