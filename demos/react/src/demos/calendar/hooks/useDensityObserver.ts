import type { DataGridRef } from '@toolbox-web/grid-react';
import { useEffect } from 'react';

// Switch from text events to colored swatches once each day cell drops
// below 70px. With 7 day columns + a 44px week-number column that means
// a grid width of 7 * 70 + 44 = 534px.
const WEEK_COL_PX = 44;
const DAY_COLS = 7;
const DAY_CELL_FULL_PX = 70;
const DENSITY_FULL_PX = WEEK_COL_PX + DAY_COLS * DAY_CELL_FULL_PX;
const DENSITY_COMPACT_PX = 480;

type Density = 'full' | 'compact' | 'minimal';

function densityForWidth(width: number): Density {
  return width >= DENSITY_FULL_PX ? 'full' : width >= DENSITY_COMPACT_PX ? 'compact' : 'minimal';
}

export function useDensityObserver(gridRef: React.RefObject<DataGridRef | null>, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const grid = gridRef.current?.element;
    if (!grid) return;

    let lastDensity: Density | null = null;
    const apply = (width: number) => {
      const density = densityForWidth(width);
      if (density === lastDensity) return;
      grid.setAttribute('data-density', density);
      lastDensity = density;
    };

    apply(grid.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) apply(entry.contentRect.width);
    });
    observer.observe(grid);

    return () => observer.disconnect();
  }, [enabled, gridRef]);
}
