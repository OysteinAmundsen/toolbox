/**
 * Tests for event props infrastructure.
 */

import { describe, expect, it } from 'vitest';

describe('event-props', () => {
  it('should map onCellClick to cell-click event', async () => {
    const { EVENT_PROP_MAP } = await import('./event-props');
    expect(EVENT_PROP_MAP['onCellClick']).toBe('cell-click');
  });

  it('should map onRowClick to row-click event', async () => {
    const { EVENT_PROP_MAP } = await import('./event-props');
    expect(EVENT_PROP_MAP['onRowClick']).toBe('row-click');
  });

  it('should map onSelectionChange to selection-change event', async () => {
    const { EVENT_PROP_MAP } = await import('./event-props');
    expect(EVENT_PROP_MAP['onSelectionChange']).toBe('selection-change');
  });

  it('should map onCellCommit to cell-commit event', async () => {
    const { EVENT_PROP_MAP } = await import('./event-props');
    expect(EVENT_PROP_MAP['onCellCommit']).toBe('cell-commit');
  });

  it('should map onSortChange to sort-change event', async () => {
    const { EVENT_PROP_MAP } = await import('./event-props');
    expect(EVENT_PROP_MAP['onSortChange']).toBe('sort-change');
  });

  it('should map onFilterChange to filter-change event', async () => {
    const { EVENT_PROP_MAP } = await import('./event-props');
    expect(EVENT_PROP_MAP['onFilterChange']).toBe('filter-change');
  });

  it('should map onColumnResize to column-resize event', async () => {
    const { EVENT_PROP_MAP } = await import('./event-props');
    expect(EVENT_PROP_MAP['onColumnResize']).toBe('column-resize');
  });

  it('should map onColumnMove to column-move event', async () => {
    const { EVENT_PROP_MAP } = await import('./event-props');
    expect(EVENT_PROP_MAP['onColumnMove']).toBe('column-move');
  });

  it('should have all event props defined', async () => {
    const { getEventPropNames } = await import('./event-props');
    const names = getEventPropNames();
    expect(names.length).toBeGreaterThan(15); // We have ~24 events
  });
});
