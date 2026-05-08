// Competitor adapter registry. Order here defines dropdown order.

import { agGridAdapter } from './agGrid.js';
import { tabulatorAdapter } from './tabulator.js';
import { toolboxAdapter } from './toolbox.js';
import type { CompetitorAdapter } from './types.js';

/** Toolbox is always the baseline — never appears in the dropdown. */
export const baselineAdapter: CompetitorAdapter = toolboxAdapter;

/** Selectable competitors shown in the dropdown. */
export const competitors: readonly CompetitorAdapter[] = [agGridAdapter, tabulatorAdapter];

export function getCompetitor(id: string): CompetitorAdapter {
  const found = competitors.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown competitor id: ${id}`);
  return found;
}

export type { CompetitorAdapter, MetricName, ScaleResult, BenchmarkRow, BenchmarkColumn } from './types.js';
export { ALL_METRICS, MEMORY_METRIC, TIME_METRICS } from './types.js';
