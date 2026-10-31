/**
 * Nested-grid isolation for core focus handling and RowDragDropPlugin (#581),
 * and for delegated event handlers (#585).
 *
 * The grid renders in light DOM, so a `<tbw-grid>` inside a master-detail
 * panel lives INSIDE the parent's `.rows` container. Every DOM query the parent
 * runs from its host or `_bodyEl` must therefore be anchored with `:scope >` —
 * an unscoped descendant query reaches the child grid's rows and cells and
 * strips its focus markers / drag attributes, or (index-based lookups) picks
 * the wrong row.
 *
 * The reverse direction: every event inside the child bubbles through the
 * parent's delegated listeners (body mousedown/click, host keydown, drag,
 * contextmenu). Each must reject targets whose nearest grid is not the parent.
 */
import { describe, expect, it, vi } from 'vitest';
import { nextFrame, waitUpgrade, withDispatchPath } from '../../../test/helpers';
import { ownCell as cell, mountNestedGrid, ORDERS, ownRows, useParentGrid } from '../../../test/nested-grid';
import '../../lib/core/grid';
import type { DataGridElement } from '../../lib/core/grid';
import { BaseGridPlugin } from '../../lib/core/plugin';
import { ContextMenuPlugin } from '../../lib/plugins/context-menu';
import { EditingPlugin } from '../../lib/plugins/editing';
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

  describe('delegated event handlers ignore the child grid (#585)', () => {
    function dragStartFrom(target: Element): Event {
      const event = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', {
        value: { effectAllowed: '', setData: vi.fn(), setDragImage: vi.fn() },
      });
      Object.defineProperty(event, 'clientX', { value: 0 });
      Object.defineProperty(event, 'clientY', { value: 0 });
      target.dispatchEvent(event);
      return event;
    }

    it('a mousedown on a child cell does not move the parent focus', async () => {
      const { parent } = t;
      const nested = await mountNestedGrid(parent);
      expect(parent._focusRow).toBe(0);
      expect(parent._focusCol).toBe(0);

      // (2,1) exists only on the child: the parent has a single column.
      focusByMouse(cell(nested, 2, 1));

      expect(parent._focusRow).toBe(0);
      expect(parent._focusCol).toBe(0);
      expect(nested._focusRow).toBe(2);
      expect(nested._focusCol).toBe(1);
      expectFocused(cell(parent, 0, 0), true);
    });

    it('a click on a child row emits row-click from the child only', async () => {
      const { parent } = t;
      const nested = await mountNestedGrid(parent);
      const targets: EventTarget[] = [];
      parent.addEventListener('row-click', (e) => targets.push(e.target as EventTarget));

      cell(nested, 1, 0).dispatchEvent(new MouseEvent('click', { bubbles: true }));

      // The child's own event still bubbles through the parent host (light
      // DOM); the parent must not add a second one of its own.
      expect(targets).toEqual([nested]);
    });

    it('ArrowDown with focus on the child host navigates the child only', async () => {
      const { parent } = t;
      const nested = await mountNestedGrid(parent);
      focusByMouse(cell(nested, 1, 0));
      expect(nested._focusRow).toBe(1);
      expect(parent._focusRow).toBe(0);

      nested.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await nextFrame();

      expect(nested._focusRow).toBe(2);
      expect(parent._focusRow).toBe(0);
    });

    it('a keydown from a child cell is not dispatched to the parent plugins', async () => {
      const { parent } = t;
      const dragDrop = new RowDragDropPlugin({ dragFrom: 'row', animation: false });
      const nested = await mountNestedGrid(parent, { parentPlugins: [dragDrop] });
      const moved = vi.fn();
      parent.addEventListener('row-move', moved);
      parent._focusRow = 0;

      // Alt+ArrowDown is RowDragDrop's keyboard move; from inside the child it
      // must not reorder the parent's rows. The move is applied to `_rows` /
      // `_focusRow` synchronously (the `row-move` event is debounced).
      const altDown = () => new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true });
      cell(nested, 0, 0).dispatchEvent(altDown());
      await nextFrame();

      expect(moved).not.toHaveBeenCalled();
      expect(parent._focusRow).toBe(0);
      expect(parent._rows.map((r) => r.id)).toEqual([1, 2, 3]);

      // Positive control: the same chord from a parent cell still moves the row.
      cell(parent, 0, 0).dispatchEvent(altDown());
      await nextFrame();
      expect(parent._focusRow).toBe(1);
      expect(parent._rows.map((r) => r.id)).toEqual([2, 1, 3]);
    });

    it('a composed keydown from a shadow-DOM control inside a child cell is not dispatched to the parent plugins', async () => {
      // `closest()` stops at a shadow root and the grid reads `composedPath()[0]`,
      // so the inner input has no grid ancestor in its own tree — the guard must
      // walk out through the shadow host to find the child grid.
      const { parent } = t;
      const nested = await mountNestedGrid(parent);
      const editorHost = document.createElement('div');
      const input = document.createElement('input');
      editorHost.attachShadow({ mode: 'open' }).appendChild(input);
      cell(nested, 1, 0).appendChild(editorHost);
      const parentDispatch = vi.spyOn(parent, '_dispatchKeyDown');
      const childDispatch = vi.spyOn(nested, '_dispatchKeyDown');

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }));

      expect(parentDispatch).not.toHaveBeenCalled();
      expect(childDispatch).toHaveBeenCalledTimes(1);
    });

    it('a child keydown whose target the child tore down while bubbling is still not the parent’s', async () => {
      // The child's host listener runs BEFORE the parent's. A child plugin that
      // re-renders or removes the pressed element (editor teardown on Tab
      // commit, synchronous row refresh) leaves the parent with a detached
      // target — no grid ancestor, so an ancestry check would accept it.
      class DetachOnKeyPlugin extends BaseGridPlugin {
        readonly name = 'detachOnKey';
        override onKeyDown(e: KeyboardEvent): boolean | void {
          (e.composedPath()[0] as Element).remove();
          return false;
        }
      }
      const { parent } = t;
      const nested = await mountNestedGrid(parent, { childPlugins: [new DetachOnKeyPlugin()] });
      const parentDispatch = vi.spyOn(parent, '_dispatchKeyDown');
      const childCell = cell(nested, 1, 0);

      // happy-dom rebuilds composedPath() from the current ancestry; browsers
      // snapshot it at dispatch — emulate the browser.
      childCell.dispatchEvent(withDispatchPath(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }), childCell));

      expect(childCell.isConnected).toBe(false);
      expect(parentDispatch).not.toHaveBeenCalled();
    });

    it('a native drag that starts on a child grid rendered inside a row-draggable parent row is cancelled', async () => {
      // Native DnD targets `dragstart` at the nearest `draggable` ancestor — the
      // PARENT row — so the event itself looks own. The press, however, landed
      // in the child; the parent must cancel rather than drag its row.
      const { parent } = t;
      const mounted: { child: DataGridElement | null } = { child: null };
      parent.gridConfig = {
        columns: [
          { field: 'id' },
          {
            field: 'items',
            renderer: (ctx) => {
              if (ctx.row.items.length === 0) return 'none';
              const grid = document.createElement('tbw-grid') as DataGridElement;
              grid.gridConfig = { columns: [{ field: 'sku' }, { field: 'qty' }] };
              grid.rows = ctx.row.items;
              mounted.child = grid;
              return grid;
            },
          },
        ],
        plugins: [new RowDragDropPlugin({ dragFrom: 'row', animation: false })],
      };
      parent.rows = ORDERS;
      await waitUpgrade(parent);
      // The child mounts during the parent's first render; a later parent
      // render re-runs the draggable pass (and may re-render the cell).
      parent.requestRender();
      await nextFrame(2);
      const child = mounted.child;
      expect(child).not.toBeNull();
      if (!child) throw new Error('child grid did not mount');
      await waitUpgrade(child);

      const parentRow = ownRows(parent)[0];
      expect(parentRow.getAttribute('draggable')).toBe('true');
      expect(parentRow.contains(child)).toBe(true);
      const started = vi.fn();
      parent.addEventListener('row-drag-start', started);

      // Press in the child, then the browser's retargeted dragstart on the parent row.
      cell(child, 1, 0).dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse', pointerId: 1 }),
      );
      const retargeted = dragStartFrom(parentRow);

      expect(retargeted.defaultPrevented).toBe(true);
      expect(started).not.toHaveBeenCalled();
      expect(parentRow.classList.contains('dragging')).toBe(false);

      // Positive control: a press on the parent row itself still drags it.
      parentRow
        .querySelector('.cell')
        ?.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse', pointerId: 2 }),
        );
      const own = dragStartFrom(parentRow);
      expect(own.defaultPrevented).toBe(false);
      expect(started).toHaveBeenCalledTimes(1);
      parent.dispatchEvent(new Event('dragend', { bubbles: true }));
    });

    it('a dragstart from a child row does not start a parent drag', async () => {
      const { parent } = t;
      const nested = await mountNestedGrid(parent, {
        parentPlugins: [new RowDragDropPlugin({ dragFrom: 'row', animation: false })],
      });
      parent.requestRender();
      await nextFrame(2);
      const started = vi.fn();
      parent.addEventListener('row-drag-start', started);
      const childRow = ownRows(nested)[1];

      dragStartFrom(childRow.querySelector('.cell') as Element);

      expect(started).not.toHaveBeenCalled();
      expect(childRow.classList.contains('dragging')).toBe(false);
      expect(parent.querySelectorAll('.data-grid-row.dragging').length).toBe(0);
    });

    it('a dragstart from a parent row still works with a child grid mounted', async () => {
      const { parent } = t;
      await mountNestedGrid(parent, {
        parentPlugins: [new RowDragDropPlugin({ dragFrom: 'row', animation: false })],
      });
      parent.requestRender();
      await nextFrame(2);
      const started = vi.fn();
      parent.addEventListener('row-drag-start', started);
      const parentRow = ownRows(parent)[1];

      dragStartFrom(parentRow.querySelector('.cell') as Element);

      expect(started).toHaveBeenCalledTimes(1);
      expect(started.mock.calls[0][0].detail.indices).toEqual([1]);
      expect(parentRow.classList.contains('dragging')).toBe(true);
    });

    it('a contextmenu on a child cell does not open the parent menu', async () => {
      const { parent } = t;
      const nested = await mountNestedGrid(parent, {
        parentPlugins: [new ContextMenuPlugin({ items: [{ id: 'x', name: 'X' }] })],
      });
      await nextFrame();
      const rightClick = () => new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });

      const event = rightClick();
      cell(nested, 1, 1).dispatchEvent(event);
      await nextFrame();

      expect(event.defaultPrevented).toBe(false);
      expect(document.querySelector('.tbw-context-menu')).toBeNull();

      // Positive control: a parent cell still opens the parent menu.
      const ownEvent = rightClick();
      cell(parent, 1, 0).dispatchEvent(ownEvent);
      await nextFrame();
      expect(ownEvent.defaultPrevented).toBe(true);
      expect(document.querySelector('.tbw-context-menu')).not.toBeNull();
    });

    it('a parent drag over the child grid stands down instead of keeping a stale drop target', async () => {
      const { parent } = t;
      const nested = await mountNestedGrid(parent, {
        parentPlugins: [new RowDragDropPlugin({ dragFrom: 'row', animation: false })],
      });
      parent.requestRender();
      await nextFrame(2);
      const parentRow = ownRows(parent)[1];
      dragStartFrom(parentRow.querySelector('.cell') as Element);

      const dragOver = (target: Element) => {
        const event = new Event('dragover', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'dataTransfer', { value: { types: [], dropEffect: '' } });
        Object.defineProperty(event, 'clientY', { value: 0 });
        target.dispatchEvent(event);
        return event;
      };

      const own = dragOver(ownRows(parent)[2].querySelector('.cell') as Element);
      expect(own.defaultPrevented).toBe(true);
      expect(parent.classList.contains('tbw-grid--drop-target-active')).toBe(true);
      expect(ownRows(parent)[2].classList.contains('drop-target')).toBe(true);

      const foreign = dragOver(cell(nested, 1, 0));
      expect(foreign.defaultPrevented).toBe(false);
      expect(parent.classList.contains('tbw-grid--drop-target-active')).toBe(false);
      expect(ownRows(parent)[2].classList.contains('drop-target')).toBe(false);
      expect(ownRows(nested)[1].classList.contains('drop-target')).toBe(false);
      parent.dispatchEvent(new Event('dragend', { bubbles: true }));
    });

    it('a pointerdown on a child cell is not dispatched to the parent plugins', async () => {
      const { parent } = t;
      const nested = await mountNestedGrid(parent);
      const dispatch = vi.spyOn(parent, '_dispatchCellMouseDown');

      cell(nested, 1, 0).dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse', pointerId: 1 }),
      );

      expect(dispatch).not.toHaveBeenCalled();

      cell(parent, 1, 0).dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse', pointerId: 2 }),
      );
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch.mock.calls[0][0].rowIndex).toBe(1);
    });
  });

  describe('EditingPlugin grid mode ignores the child grid (#585)', () => {
    // The child host has tabindex=0 and so matches FOCUSABLE_EDITOR_SELECTOR —
    // the parent's own host-level focusin/focusout/Escape listeners must not
    // treat it (or its editors) as one of the parent's editors.
    const gridMode = () => new EditingPlugin({ mode: 'grid' });
    const editableId = [{ field: 'id', editable: true }];

    function parentInput(parent: HTMLElement, row: number): HTMLInputElement {
      // Col 0 is the MasterDetail expander; `id` is col 1.
      const input = cell(parent, row, 1).querySelector('input');
      expect(input).not.toBeNull();
      return input as HTMLInputElement;
    }

    /** Focus a parent editor, then Escape → the parent is in navigation (edit-locked) mode. */
    async function lockParentNavigation(parent: DataGridElement) {
      parentInput(parent, 1).focus();
      await nextFrame();
      parent.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await nextFrame();
      expect(document.activeElement).toBe(parent);
    }

    it('focusing the child grid while the parent is in navigation mode does not bounce focus back to the parent', async () => {
      const { parent } = t;
      const nested = await mountNestedGrid(parent, { parentPlugins: [gridMode()], parentColumns: editableId });
      await lockParentNavigation(parent);

      nested.focus();

      expect(document.activeElement).toBe(nested);

      // Positive control: the lock is real — a parent editor IS bounced.
      parentInput(parent, 2).focus();
      expect(document.activeElement).toBe(parent);
    });

    it('Escape inside a child editor is handled by the child, not reverted and blurred by the parent', async () => {
      const { parent } = t;
      const nested = await mountNestedGrid(parent, {
        parentPlugins: [gridMode()],
        parentColumns: editableId,
        childPlugins: [gridMode()],
        childColumns: [{ field: 'sku', editable: true }, { field: 'qty' }],
      });
      const childInput = cell(nested, 1, 0).querySelector('input') as HTMLInputElement;
      childInput.focus();
      await nextFrame();
      expect(document.activeElement).toBe(childInput);

      // The parent's capture-phase listener runs before the child's; unguarded
      // it blurred the child editor, focused the PARENT host and stopped the
      // event so the child never saw its own Escape.
      childInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await nextFrame();

      expect(document.activeElement).toBe(nested);
    });

    it('focus moving from a parent editor into the child grid leaves the parent edit mode', async () => {
      const { parent } = t;
      const nested = await mountNestedGrid(parent, { parentPlugins: [gridMode()], parentColumns: editableId });
      parentInput(parent, 1).focus();
      await nextFrame();
      // ArrowDown on the host while a parent editor is focused belongs to the editor.
      parent.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await nextFrame();
      expect(parent._focusRow).toBe(0);

      nested.focus();
      await nextFrame();
      expect(document.activeElement).toBe(nested);

      // The child host matches FOCUSABLE_EDITOR_SELECTOR; unguarded, the
      // parent's focusout took this for an intra-editor move and kept the
      // "editor focused" flag, so the grid never navigated again.
      parent.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await nextFrame();
      expect(parent._focusRow).toBe(1);
    });
  });
});
