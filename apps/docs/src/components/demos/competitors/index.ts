// Competitor adapter registry. Order here defines dropdown order.

import { agGridAdapter } from './agGrid.js';
import { slickGridAdapter } from './slickGrid.js';
import { tabulatorAdapter } from './tabulator.js';
import { toolboxAdapter } from './toolbox.js';
import type { CompetitorAdapter } from './types.js';

/** Toolbox is always the baseline — never appears in the dropdown. */
export const baselineAdapter: CompetitorAdapter = toolboxAdapter;

/** Selectable competitors shown in the dropdown. */
export const competitors: readonly CompetitorAdapter[] = [agGridAdapter, tabulatorAdapter, slickGridAdapter];

export function getCompetitor(id: string): CompetitorAdapter {
  const found = competitors.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown competitor id: ${id}`);
  return found;
}

export { ALL_METRICS, DOM_METRIC, MACRO_METRICS, MICRO_METRICS, ROUND_TRIP_METRIC, TIME_METRICS } from './types.js';
export type { BenchmarkColumn, BenchmarkRow, CompetitorAdapter, MetricName, ScaleResult } from './types.js';
