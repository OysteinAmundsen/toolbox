/**
 * @vitest-environment happy-dom
 *
 * Smoke test for the deprecated `RowReorderPlugin` alias.
 * Full coverage lives in `../row-drag-drop/row-drag-drop.spec.ts`.
 */
import { describe, expect, it } from 'vitest';
import { RowDragDropPlugin } from '../row-drag-drop/RowDragDropPlugin';
import { ROW_DRAG_HANDLE_FIELD, RowReorderPlugin } from './RowReorderPlugin';

describe('RowReorderPlugin (deprecated alias)', () => {
  it('resolves to the same constructor as RowDragDropPlugin', () => {
    expect(RowReorderPlugin).toBe(RowDragDropPlugin);
  });

  it('exports ROW_DRAG_HANDLE_FIELD constant', () => {
    expect(ROW_DRAG_HANDLE_FIELD).toBe('__tbw_row_drag');
  });

  it('preserves legacy plugin-name aliases', () => {
    const plugin = new RowReorderPlugin();
    expect(plugin.aliases).toContain('reorderRows');
    expect(plugin.aliases).toContain('rowReorder');
  });
});
