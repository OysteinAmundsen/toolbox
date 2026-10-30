/**
 * Nested-grid isolation for SelectionPlugin.
 *
 * The grid renders in light DOM, so a `<tbw-grid>` inside a master-detail
 * panel lives INSIDE the parent's `.rows` container. Every selection paint
 * pass in the parent must therefore stay scoped to the parent's own rows —
 * an unscoped `querySelectorAll('.cell')` would wipe the child's selection
 * markers on every parent render / scroll frame.
 */
import { describe, expect, it } from 'vitest';
import '../../lib/core/grid';
import { nextFrame } from '../../../test/helpers';
import { mountNestedGrid, ownCell as cell, useParentGrid } from '../../../test/nested-grid';
import { SelectionPlugin } from '../../lib/plugins/selection';

describe('SelectionPlugin — nested grid isolation', () => {
  const t = useParentGrid();

  function mountNested(parentMode: 'row' | 'range' | 'cell', childMode: 'row' | 'range') {
    return mountNestedGrid(t.parent, {
      parentPlugins: [new SelectionPlugin({ mode: parentMode })],
      childPlugins: [new SelectionPlugin({ mode: childMode })],
    });
  }

  it('a parent render does not wipe the child grid range selection', async () => {
    const nested = await mountNested('cell', 'range');
    const childCell = cell(nested, 1, 0);
    childCell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    childCell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    childCell.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await nextFrame();
    expect(childCell.classList.contains('selected')).toBe(true);
    expect(childCell.getAttribute('aria-selected')).toBe('true');

    // Any parent render re-runs the parent's selection paint pass.
    t.parent.requestRender();
    await nextFrame(2);

    expect(childCell.classList.contains('selected')).toBe(true);
    expect(childCell.getAttribute('aria-selected')).toBe('true');
  });

  it('parent row selection never marks a child row sharing the same index', async () => {
    const nested = await mountNested('row', 'row');
    const parentCell = cell(t.parent, 0, 0);
    parentCell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextFrame();

    const parentRow = parentCell.closest('.data-grid-row')!;
    expect(parentRow.classList.contains('selected')).toBe(true);

    const childRow0 = cell(nested, 0, 0).closest('.data-grid-row')!;
    expect(childRow0.classList.contains('selected')).toBe(false);
    expect(childRow0.classList.contains('row-focus')).toBe(false);
    expect(childRow0.getAttribute('aria-selected')).not.toBe('true');
  });

  it('a parent render does not strip the child grid focus marker', async () => {
    const nested = await mountNested('row', 'range');
    const childCell = cell(nested, 0, 1);
    childCell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await nextFrame();
    expect(childCell.classList.contains('cell-focus')).toBe(true);

    // Parent row mode clears cell-focus on every pass — only for its own cells.
    t.parent.requestRender();
    await nextFrame(2);
    expect(childCell.classList.contains('cell-focus')).toBe(true);
  });
});
