/**
 * Nested-grid isolation for core focus handling and RowDragDropPlugin (#581).
 *
 * The grid renders in light DOM, so a `<tbw-grid>` inside a master-detail
 * panel lives INSIDE the parent's `.rows` container. Every DOM query the parent
 * runs from its host or `_bodyEl` must therefore be anchored with `:scope >` —
 * an unscoped descendant query reaches the child grid's rows and cells and
 * strips its focus markers / drag attributes, or (index-based lookups) picks
 * the wrong row.
 */
import { describe, expect, it } from 'vitest';
import '../../lib/core/grid';
import { nextFrame } from '../../../test/helpers';
import { mountNestedGrid, ownCell as cell, ownRows, useParentGrid } from '../../../test/nested-grid';
import { RowDragDropPlugin } from '../../lib/plugins/row-drag-drop';

describe('Nested grid isolation — core focus & RowDragDrop (#581)', () => {
  const t = useParentGrid();

  function focusByMouse(target: HTMLElement) {
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  }

  function expectFocused(el: HTMLElement, focused: boolean) {
    expect(el.classList.contains('cell-focus')).toBe(focused);
    expect(el.getAttribute('aria-selected') === 'true').toBe(focused);
  }

  /** Focus parent (0,0) by mouse, then ArrowDown on the parent host. */
  async function arrowDownFromRow0() {
    const { parent } = t;
    focusByMouse(cell(parent, 0, 0));
    parent.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await nextFrame();
    expect(parent._focusRow).toBe(1);
  }

  describe('core focus handling', () => {
    it('a parent mousedown does not strip the child grid focus markers', async () => {
      const { parent } = t;
      const nested = await mountNestedGrid(parent);
      const childCell = cell(nested, 1, 1);
      focusByMouse(childCell);
      expectFocused(childCell, true);

      focusByMouse(cell(parent, 1, 0));

      expectFocused(childCell, true);
      expectFocused(cell(parent, 1, 0), true);
    });

    it('a parent arrow-key move does not strip the child grid focus markers', async () => {
      const nested = await mountNestedGrid(t.parent);
      const childCell = cell(nested, 2, 0);
      focusByMouse(childCell);
      expectFocused(childCell, true);

      await arrowDownFromRow0();

      expectFocused(childCell, true);
    });

    it('the parent focuses its OWN row when a child grid precedes it in the DOM', async () => {
      // The child grid (3 rows) sits in row 0's detail panel, i.e. BEFORE parent
      // row 1 in document order. An unscoped `.data-grid-row` index lookup would
      // resolve parent row 1 to the child's first row.
      const { parent } = t;
      const nested = await mountNestedGrid(parent);

      await arrowDownFromRow0();

      expectFocused(cell(parent, 1, 0), true);
      expectFocused(cell(parent, 0, 0), false);
      // The child's own default focus marker (its `_focusRow = 0`) is untouched.
      expectFocused(cell(nested, 0, 0), true);
    });
  });

  describe('RowDragDropPlugin', () => {
    it('dragFrom:"row" marks only the parent rows draggable', async () => {
      const { parent } = t;
      const nested = await mountNestedGrid(parent, {
        parentPlugins: [new RowDragDropPlugin({ dragFrom: 'row', animation: false })],
      });
      // The child mounts after the parent's first afterRender; a later parent
      // render re-runs the draggable pass over the (now populated) subtree.
      parent.requestRender();
      await nextFrame(2);

      for (const row of ownRows(parent)) expect(row.getAttribute('draggable')).toBe('true');
      expect(ownRows(nested).length).toBe(3);
      for (const row of ownRows(nested)) expect(row.hasAttribute('draggable')).toBe(false);
    });

    it('a parent dragend leaves the child grid drag classes untouched', async () => {
      const { parent } = t;
      const nested = await mountNestedGrid(parent, { parentPlugins: [new RowDragDropPlugin({ animation: false })] });
      const childRow = ownRows(nested)[0];
      const parentRow = ownRows(parent)[1];
      childRow.classList.add('dragging', 'drop-target', 'drop-before');
      parentRow.classList.add('dragging', 'drop-target', 'drop-before');

      parent.dispatchEvent(new Event('dragend', { bubbles: true }));

      expect(parentRow.classList.contains('dragging')).toBe(false);
      expect(parentRow.classList.contains('drop-target')).toBe(false);
      expect(childRow.classList.contains('dragging')).toBe(true);
      expect(childRow.classList.contains('drop-target')).toBe(true);
      expect(childRow.classList.contains('drop-before')).toBe(true);
    });
  });
});
