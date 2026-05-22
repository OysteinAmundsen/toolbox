import { useEffect } from 'react';
import type { DataGridRef } from '@toolbox-web/grid-react';

const DOUBLE_CLICK_MS = 400;

export function useDoubleClick(
  gridRef: React.RefObject<DataGridRef | null>,
  enabled: boolean,
  onDoubleClick: (cell: HTMLElement) => void,
): void {
  useEffect(() => {
    if (!enabled) return;
    const grid = gridRef.current?.element;
    if (!grid) return;

    let lastCell: HTMLElement | null = null;
    let lastTime = 0;

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>('.cell[data-col]');
      if (!cell) {
        lastCell = null;
        return;
      }

      if (lastCell === cell && event.timeStamp - lastTime < DOUBLE_CLICK_MS) {
        lastCell = null;
        lastTime = 0;
        onDoubleClick(cell);
        return;
      }

      lastCell = cell;
      lastTime = event.timeStamp;
    };

    grid.addEventListener('mousedown', onMouseDown, true);
    return () => grid.removeEventListener('mousedown', onMouseDown, true);
  }, [enabled, gridRef, onDoubleClick]);
}
