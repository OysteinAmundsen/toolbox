import type { Ref } from 'vue';

export type CalendarDensity = 'full' | 'compact' | 'minimal';

// Switch from text events to colored swatches once each day cell drops
// below 70px. With 7 day columns + a 44px week-number column that means
// a grid width of 7 * 70 + 44 = 534px.
const WEEK_COL_PX = 44;
const DAY_COLS = 7;
const DAY_CELL_FULL_PX = 70;
const DENSITY_FULL_PX = WEEK_COL_PX + DAY_COLS * DAY_CELL_FULL_PX;
const DENSITY_COMPACT_PX = 480;

export function getDensity(width: number): CalendarDensity {
  return width >= DENSITY_FULL_PX ? 'full' : width >= DENSITY_COMPACT_PX ? 'compact' : 'minimal';
}

export function useDensityObserver(
  grid: HTMLElement,
  density: Ref<CalendarDensity>,
  onDensityChange?: () => void,
): () => void {
  let lastDensity: CalendarDensity | null = null;
  const apply = (width: number): void => {
    const next = getDensity(width);
    if (next === lastDensity) return;
    lastDensity = next;
    density.value = next;
    grid.setAttribute('data-density', next);
    onDensityChange?.();
  };

  apply(grid.getBoundingClientRect().width || grid.clientWidth);
  const ro = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry) apply(entry.contentRect.width);
  });
  ro.observe(grid);
  return () => ro.disconnect();
}
