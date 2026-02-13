/**
 * @vitest-environment happy-dom
 *
 * Tests for group drag-and-drop in the VisibilityPlugin.
 * When column groups are present and a ReorderPlugin is active,
 * group headers in the visibility panel can be dragged to reorder
 * all member columns as a block.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ColumnConfig } from '../../core/types';
import type { ColumnGroupInfo } from '../grouping-columns/types';

describe('VisibilityPlugin group drag-and-drop', async () => {
  const { VisibilityPlugin } = await import('./VisibilityPlugin');
  const { ReorderPlugin } = await import('../reorder/ReorderPlugin');

  // Columns with two groups + one ungrouped
  const groupedColumns: ColumnConfig[] = [
    { field: 'name', header: 'Name', group: { id: 'personal', label: 'Personal' } },
    { field: 'email', header: 'Email', group: { id: 'personal', label: 'Personal' } },
    { field: 'dept', header: 'Department', group: { id: 'work', label: 'Work' } },
    { field: 'title', header: 'Title', group: { id: 'work', label: 'Work' } },
    { field: 'notes', header: 'Notes' },
  ];

  // Track current column order — mutated by setColumnOrder
  let currentOrder: string[];

  function makeColumns(order?: string[]) {
    const colOrder = order ?? groupedColumns.map((c) => c.field);
    return colOrder.map((f) => {
      const orig = groupedColumns.find((c) => c.field === f)!;
      return { ...orig, visible: true };
    });
  }

  function makeGroupInfo(): ColumnGroupInfo[] {
    // Return groups with fields in current display order
    const personalFields = currentOrder.filter((f) => {
      const col = groupedColumns.find((c) => c.field === f);
      return col?.group && (col.group as { id: string }).id === 'personal';
    });
    const workFields = currentOrder.filter((f) => {
      const col = groupedColumns.find((c) => c.field === f);
      return col?.group && (col.group as { id: string }).id === 'work';
    });
    const groups: ColumnGroupInfo[] = [];
    if (personalFields.length > 0) {
      groups.push({ id: 'personal', label: 'Personal', fields: personalFields });
    }
    if (workFields.length > 0) {
      groups.push({ id: 'work', label: 'Work', fields: workFields });
    }
    return groups;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function createPlugin() {
    currentOrder = groupedColumns.map((c) => c.field);
    const visPlugin = new VisibilityPlugin();
    const reorderPlugin = new ReorderPlugin();
    const el = document.createElement('div');
    document.body.appendChild(el);
    const abortController = new AbortController();

    const setColumnOrderSpy = vi.fn((order: string[]) => {
      currentOrder = [...order];
    });

    const mockGrid = Object.assign(el, {
      effectiveConfig: { columns: groupedColumns, plugins: [reorderPlugin, visPlugin] },
      gridConfig: {},
      getAllColumns: () => makeColumns(currentOrder),
      getColumnOrder: () => [...currentOrder],
      getPluginByName: (name: string) => {
        if (name === 'reorder') return reorderPlugin;
        return null;
      },
      getPlugin: (PluginClass: any) => {
        if (PluginClass === ReorderPlugin) return reorderPlugin;
        return null;
      },
      query: <T>(type: string): T[] => {
        if (type === 'getColumnGrouping') return [makeGroupInfo()] as T[];
        return [];
      },
      queryPlugins: () => [],
      dispatchEvent: el.dispatchEvent.bind(el),
      disconnectSignal: abortController.signal,
      toggleColumnVisibility: vi.fn(),
      setColumnVisible: vi.fn(),
      showAllColumns: vi.fn(),
      setColumnOrder: setColumnOrderSpy,
      registerStyles: vi.fn(),
      unregisterStyles: vi.fn(),
    });

    visPlugin.attach(mockGrid as any);

    // Render the panel content into a container
    const panelContainer = document.createElement('div');
    el.appendChild(panelContainer);
    // Access private renderPanelContent via `as any`
    (visPlugin as any).renderPanelContent(panelContainer);

    return { visPlugin, el, abortController, setColumnOrderSpy, panelContainer };
  }

  /**
   * Helper: get the column list element from the rendered panel.
   */
  function getColumnList(panelContainer: HTMLElement): HTMLElement {
    return panelContainer.querySelector('.tbw-visibility-list') as HTMLElement;
  }

  /**
   * Helper: get group header by group ID.
   */
  function getGroupHeader(panelContainer: HTMLElement, groupId: string): HTMLElement | null {
    return panelContainer.querySelector(`.tbw-visibility-group-header[data-group-id="${groupId}"]`);
  }

  /**
   * Simulate a drag-and-drop sequence on a group header onto another group header.
   */
  function simulateGroupDrag(source: HTMLElement, target: HTMLElement, before: boolean): void {
    // Fire dragstart on source
    const dragStartEvent = new Event('dragstart', { bubbles: true }) as any;
    dragStartEvent.dataTransfer = { effectAllowed: '', setData: vi.fn() };
    source.dispatchEvent(dragStartEvent);

    // Fire dragover on target
    const targetRect = target.getBoundingClientRect();
    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true }) as any;
    // Position above or below midpoint
    dragOverEvent.clientY = before ? targetRect.top + 1 : targetRect.top + targetRect.height - 1;
    dragOverEvent.preventDefault = vi.fn();
    target.dispatchEvent(dragOverEvent);

    // Fire drop on target
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as any;
    dropEvent.clientY = dragOverEvent.clientY;
    dropEvent.preventDefault = vi.fn();
    target.dispatchEvent(dropEvent);
  }

  it('renders group headers as draggable when ReorderPlugin is present', () => {
    const { panelContainer } = createPlugin();
    const personal = getGroupHeader(panelContainer, 'personal');
    const work = getGroupHeader(panelContainer, 'work');

    expect(personal).not.toBeNull();
    expect(work).not.toBeNull();
    expect(personal!.draggable).toBe(true);
    expect(work!.draggable).toBe(true);
    expect(personal!.classList.contains('reorderable')).toBe(true);
    expect(work!.classList.contains('reorderable')).toBe(true);
  });

  it('adds drag handle to group headers', () => {
    const { panelContainer } = createPlugin();
    const personal = getGroupHeader(panelContainer, 'personal')!;

    const handle = personal.querySelector('.tbw-visibility-handle');
    expect(handle).not.toBeNull();
    expect(handle!.getAttribute('title')).toBe('Drag to reorder group');
  });

  it('moves group before another group', () => {
    const { visPlugin, panelContainer, setColumnOrderSpy } = createPlugin();
    const columnList = getColumnList(panelContainer);
    // Initial order: [name, email, dept, title, notes]
    // Drag "work" group before "personal" group
    const personalFields = ['name', 'email'];
    const workFields = ['dept', 'title'];

    (visPlugin as any).executeGroupDrop(workFields, personalFields, true, columnList);

    expect(setColumnOrderSpy).toHaveBeenCalledTimes(1);
    // Work group (dept, title) should now be before personal (name, email)
    expect(setColumnOrderSpy).toHaveBeenCalledWith(['dept', 'title', 'name', 'email', 'notes']);
  });

  it('moves group after another group', () => {
    const { visPlugin, panelContainer, setColumnOrderSpy } = createPlugin();
    const columnList = getColumnList(panelContainer);
    // Initial order: [name, email, dept, title, notes]
    // Drag "personal" group after "work" group
    const personalFields = ['name', 'email'];
    const workFields = ['dept', 'title'];

    (visPlugin as any).executeGroupDrop(personalFields, workFields, false, columnList);

    expect(setColumnOrderSpy).toHaveBeenCalledTimes(1);
    // Work stays, then personal comes after, then ungrouped
    expect(setColumnOrderSpy).toHaveBeenCalledWith(['dept', 'title', 'name', 'email', 'notes']);
  });

  it('preserves internal order of dragged group', () => {
    const { visPlugin, panelContainer, setColumnOrderSpy } = createPlugin();

    // Manually set the current order so personal has email before name
    currentOrder = ['email', 'name', 'dept', 'title', 'notes'];
    // Rebuild so DOM reflects new order
    const columnList = getColumnList(panelContainer);
    (visPlugin as any).rebuildToggles(columnList);

    // Drag personal after work
    (visPlugin as any).executeGroupDrop(['email', 'name'], ['dept', 'title'], false, columnList);

    expect(setColumnOrderSpy).toHaveBeenCalledTimes(1);
    // email stays before name (their current relative order)
    expect(setColumnOrderSpy).toHaveBeenCalledWith(['dept', 'title', 'email', 'name', 'notes']);
  });

  it('does not reorder when dropping group onto itself', () => {
    const { panelContainer, setColumnOrderSpy } = createPlugin();
    const personal = getGroupHeader(panelContainer, 'personal')!;

    // Simulate dragstart
    const dragStartEvent = new Event('dragstart', { bubbles: true }) as any;
    dragStartEvent.dataTransfer = { effectAllowed: '', setData: vi.fn() };
    personal.dispatchEvent(dragStartEvent);

    // Dragover on same header — should be rejected
    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true }) as any;
    const rect = personal.getBoundingClientRect();
    dragOverEvent.clientY = rect.top + 1;
    dragOverEvent.preventDefault = vi.fn();
    personal.dispatchEvent(dragOverEvent);

    // Drop on same header — should be ignored
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as any;
    dropEvent.clientY = dragOverEvent.clientY;
    dropEvent.preventDefault = vi.fn();
    personal.dispatchEvent(dropEvent);

    expect(setColumnOrderSpy).not.toHaveBeenCalled();
  });

  it('clears drag state on dragend', () => {
    const { panelContainer, visPlugin } = createPlugin();
    const personal = getGroupHeader(panelContainer, 'personal')!;

    // Dragstart
    const dragStartEvent = new Event('dragstart', { bubbles: true }) as any;
    dragStartEvent.dataTransfer = { effectAllowed: '', setData: vi.fn() };
    personal.dispatchEvent(dragStartEvent);

    expect((visPlugin as any).isDragging).toBe(true);
    expect((visPlugin as any).draggedGroupId).toBe('personal');

    // Dragend
    personal.dispatchEvent(new Event('dragend', { bubbles: true }));

    expect((visPlugin as any).isDragging).toBe(false);
    expect((visPlugin as any).draggedGroupId).toBeNull();
    expect((visPlugin as any).draggedGroupFields).toEqual([]);
  });

  it('does not allow individual column drag onto group header', () => {
    const { panelContainer, setColumnOrderSpy } = createPlugin();
    const work = getGroupHeader(panelContainer, 'work')!;

    // Start dragging an ungrouped individual column
    const notesRow = panelContainer.querySelector('.tbw-visibility-row[data-field="notes"]') as HTMLElement;
    expect(notesRow).not.toBeNull();

    const dragStart = new Event('dragstart', { bubbles: true }) as any;
    dragStart.dataTransfer = { effectAllowed: '', setData: vi.fn() };
    notesRow.dispatchEvent(dragStart);

    // Dragover on group header — should not show drop indicator
    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true }) as any;
    const rect = work.getBoundingClientRect();
    dragOverEvent.clientY = rect.top + 1;
    dragOverEvent.preventDefault = vi.fn();
    work.dispatchEvent(dragOverEvent);

    // The header should NOT have drop-before or drop-after class
    // (because !this.draggedGroupId condition in group header dragover)
    expect(work.classList.contains('drop-before')).toBe(false);
    expect(work.classList.contains('drop-after')).toBe(false);
  });

  it('column dragstart clears stale group drag state', () => {
    const { panelContainer, visPlugin } = createPlugin();
    const personal = getGroupHeader(panelContainer, 'personal')!;

    // Start a group drag
    const groupDragStart = new Event('dragstart', { bubbles: true }) as any;
    groupDragStart.dataTransfer = { effectAllowed: '', setData: vi.fn() };
    personal.dispatchEvent(groupDragStart);

    expect((visPlugin as any).draggedGroupId).toBe('personal');

    // Now start an individual column drag — should clear group state
    const notesRow = panelContainer.querySelector('.tbw-visibility-row[data-field="notes"]') as HTMLElement;
    const colDragStart = new Event('dragstart', { bubbles: true }) as any;
    colDragStart.dataTransfer = { effectAllowed: '', setData: vi.fn() };
    notesRow.dispatchEvent(colDragStart);

    expect((visPlugin as any).draggedGroupId).toBeNull();
    expect((visPlugin as any).draggedGroupFields).toEqual([]);
    expect((visPlugin as any).draggedField).toBe('notes');
  });

  it('moves group before an ungrouped column', () => {
    const { visPlugin, panelContainer, setColumnOrderSpy } = createPlugin();
    const columnList = getColumnList(panelContainer);
    // Initial order: [name, email, dept, title, notes]
    // Drag "personal" group before ungrouped "notes"
    (visPlugin as any).executeGroupDrop(['name', 'email'], ['notes'], true, columnList);

    expect(setColumnOrderSpy).toHaveBeenCalledTimes(1);
    // personal group moves right before notes, work stays in place
    expect(setColumnOrderSpy).toHaveBeenCalledWith(['dept', 'title', 'name', 'email', 'notes']);
  });

  it('moves group after an ungrouped column', () => {
    const { visPlugin, panelContainer, setColumnOrderSpy } = createPlugin();
    const columnList = getColumnList(panelContainer);
    // Initial order: [name, email, dept, title, notes]
    // Drag "work" group after ungrouped "notes"
    (visPlugin as any).executeGroupDrop(['dept', 'title'], ['notes'], false, columnList);

    expect(setColumnOrderSpy).toHaveBeenCalledTimes(1);
    // personal stays, notes stays, work moves after notes
    expect(setColumnOrderSpy).toHaveBeenCalledWith(['name', 'email', 'notes', 'dept', 'title']);
  });

  it('handles no-op when target field not found', () => {
    const { visPlugin, panelContainer, setColumnOrderSpy } = createPlugin();
    const columnList = getColumnList(panelContainer);

    // Try to drop with a non-existent target field
    (visPlugin as any).executeGroupDrop(['name', 'email'], ['nonexistent'], true, columnList);

    // Should not call setColumnOrder because anchor field not found
    expect(setColumnOrderSpy).not.toHaveBeenCalled();
  });
});
