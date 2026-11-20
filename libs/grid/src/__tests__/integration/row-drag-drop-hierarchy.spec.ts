/**
 * RowDragDropPlugin over row-model plugins (#663): moves are resolved by row
 * identity and translated by Tree / GroupingRows through `rows:resolve-move`.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGrid, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import type { DataGridElement } from '../../lib/core/grid';
import { BaseGridPlugin, type PluginManifest, type PluginQuery } from '../../lib/core/plugin/base-plugin';
import { FilteringPlugin } from '../../lib/plugins/filtering/filtering-plugin';
import { GroupingRowsPlugin } from '../../lib/plugins/grouping-rows/grouping-rows-plugin';
import { MultiSortPlugin } from '../../lib/plugins/multi-sort/multi-sort-plugin';
import { RowDragDropPlugin } from '../../lib/plugins/row-drag-drop/row-drag-drop-plugin';
import { decodePayload, TBW_ROW_DRAG_MIME } from '../../lib/plugins/shared/drag-drop-protocol';
import type {
  RowDragDropConfig,
  RowDragPayload,
  RowMoveDetail,
  RowMoveQuery,
  RowMoveResolution,
} from '../../lib/plugins/row-drag-drop/types';
import { SelectionPlugin } from '../../lib/plugins/selection/selection-plugin';
import { TreePlugin } from '../../lib/plugins/tree/tree-plugin';
import type { TreeConfig, TreeRow } from '../../lib/plugins/tree/types';

interface Node {
  id: string;
  name: string;
  children?: Node[];
  /** Group value or path (`mountRootGroups`). */
  g?: string | string[];
}

const node = (id: string, children?: Node[]): Node => (children ? { id, name: id, children } : { id, name: id });
const names = (rows: readonly unknown[]) => rows.map((r) => (r as Node).name);
const display = (grid: DataGridElement) => names(grid.rows);

async function mountTree(
  rows: Node[],
  tree: TreeConfig = {},
  drag: RowDragDropConfig = {},
  extra: BaseGridPlugin[] = [],
) {
  const rdd = new RowDragDropPlugin({ animation: false, ...drag });
  const grid = createGrid();
  grid.gridConfig = { columns: [{ field: 'name' }], plugins: [new TreePlugin(tree), ...extra, rdd] };
  grid.rows = rows;
  await waitUpgrade(grid);
  const moves: RowMoveDetail[] = [];
  grid.addEventListener('row-move', (e) => moves.push((e as CustomEvent<RowMoveDetail>).detail));
  return { grid, rdd, moves };
}

/** A flat grid in drop zone `z`, named `label` in the move menu's "Send to …" entry. */
async function mountPeer(label: string, rows: Node[], extra: BaseGridPlugin[] = [], drag: RowDragDropConfig = {}) {
  const peer = createGrid();
  peer.setAttribute('aria-label', label);
  peer.gridConfig = {
    columns: [{ field: 'name' }],
    plugins: [...extra, new RowDragDropPlugin({ animation: false, dropZone: 'z', ...drag })],
  };
  peer.rows = rows;
  await waitUpgrade(peer);
  return peer;
}

/** Vetoes one `rows:resolve-move` operation, as a row-model plugin may. */
class VetoPlugin extends BaseGridPlugin {
  static override readonly manifest: PluginManifest = { queries: [{ type: 'rows:resolve-move' }] };
  readonly name = 'veto';
  constructor(private readonly op: RowMoveQuery['op']) {
    super();
  }
  override handleQuery(query: PluginQuery): unknown {
    return query.type === 'rows:resolve-move' && (query.context as RowMoveQuery).op === this.op ? false : undefined;
  }
}

/** Reports an active data source (`datasource:is-active`), as ServerSidePlugin does. */
class ActiveDataSource extends BaseGridPlugin {
  static override readonly manifest: PluginManifest = { queries: [{ type: 'datasource:is-active' }] };
  readonly name = 'active-data-source';
  override handleQuery(query: PluginQuery): unknown {
    return query.type === 'datasource:is-active' ? true : undefined;
  }
}

const openMenu = (grid: DataGridElement, rowIndex: number) =>
  grid.querySelector<HTMLElement>(`.cell[data-row="${rowIndex}"] .dg-row-drag-handle`)!.click();
const menuItem = (label: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('#tbw-row-move-menu button')).find(
    (b) => b.textContent === label,
  );

/** Dispatch a native-DnD-shaped event (happy-dom has no DragEvent/DataTransfer). */
function fireDrag(target: Element, type: string) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const dataTransfer = {
    effectAllowed: '',
    dropEffect: '',
    types: [],
    setData: vi.fn(),
    setDragImage: vi.fn(),
    getData: () => '',
  };
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
  target.dispatchEvent(event);
}

class TestBroadcastChannel {
  static instances: TestBroadcastChannel[] = [];
  private listeners: ((event: MessageEvent) => void)[] = [];

  constructor(readonly name: string) {
    TestBroadcastChannel.instances.push(this);
  }

  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.push(listener);
  }

  removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners = this.listeners.filter((candidate) => candidate !== listener);
  }

  postMessage(data: unknown) {
    for (const channel of TestBroadcastChannel.instances) {
      if (channel === this || channel.name !== this.name) continue;
      for (const listener of channel.listeners) listener({ data } as MessageEvent);
    }
  }

  close() {
    this.listeners = [];
    TestBroadcastChannel.instances = TestBroadcastChannel.instances.filter((channel) => channel !== this);
  }
}

function startCrossWindowDrag(grid: DataGridElement, rowIndex: number): RowDragPayload<Node> {
  const data = new Map<string, string>();
  const event = new Event('dragstart', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { effectAllowed: '', setData: (type: string, value: string) => data.set(type, value) },
  });
  grid.querySelector<HTMLElement>(`.cell[data-row="${rowIndex}"] .dg-row-drag-handle`)!.dispatchEvent(event);
  const payload = decodePayload<Node>(data.get(TBW_ROW_DRAG_MIME) ?? '');
  if (!payload) throw new Error('dragstart did not set a row drag payload');
  return payload;
}

function acknowledgeCrossWindowMove(payload: RowDragPayload<Node>) {
  const remote = new TestBroadcastChannel('tbw-row-drag-drop');
  remote.postMessage({
    type: 'tbw-row-drag-drop:transfer',
    sessionId: payload.sessionId,
    sourceGridId: payload.sourceGridId,
    toGridId: 'remote-grid',
    dropZone: payload.dropZone,
    rowIndices: payload.rowIndices,
    toIndex: 0,
    operation: 'move',
    serializedRows: payload.rows,
  });
  remote.close();
}

afterEach(() => {
  document.body.innerHTML = '';
  for (const channel of [...TestBroadcastChannel.instances]) channel.close();
  vi.unstubAllGlobals();
});

describe('RowDragDrop + Tree (#663)', () => {
  it('reorders a collapsed parent together with its subtree', async () => {
    const rows = [node('A', [node('A1')]), node('B', [node('B1')]), node('C', [node('C1')])];
    const { grid, rdd, moves } = await mountTree(rows);

    expect(rdd.canMoveRow(0, 2)).toBe(true);
    rdd.moveRow(0, 2);
    await waitUpgrade(grid);

    expect(display(grid)).toEqual(['B', 'C', 'A']);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ row: rows[0], fromParent: null, toParent: null, fromIndex: 0, toIndex: 2 });
    // Roots keep their identity (and their children); the consumer's array is untouched.
    expect(moves[0].rows).toEqual([rows[1], rows[2], rows[0]]);
    expect(moves[0].rows[2]).toBe(rows[0]);
    expect(names(rows)).toEqual(['A', 'B', 'C']);
  });

  it('reorders a child among its siblings, copying only the ancestors that changed', async () => {
    const [a1, a2] = [node('A1'), node('A2')];
    const rows = [node('A', [a1, a2]), node('X')];
    const { grid, rdd, moves } = await mountTree(rows, { defaultExpanded: true });
    expect(display(grid)).toEqual(['A', 'A1', 'A2', 'X']);

    rdd.moveRow(2, 1);
    await waitUpgrade(grid);

    expect(display(grid)).toEqual(['A', 'A2', 'A1', 'X']);
    const [{ rows: next, fromParent, toParent, fromIndex, toIndex }] = moves;
    expect(fromParent).toBe(rows[0]);
    expect(toParent).toBe(rows[0]);
    expect([fromIndex, toIndex]).toEqual([1, 0]);
    expect(next[0]).not.toBe(rows[0]);
    expect((next[0] as Node).children).toEqual([a2, a1]);
    expect((next[0] as Node).children![0]).toBe(a2);
    expect(next[1]).toBe(rows[1]);
    expect(rows[0].children).toEqual([a1, a2]);
  });

  it('keeps a child under its parent unless canReparent allows the move', async () => {
    const rows = () => [node('A', [node('A1'), node('A2')]), node('B', [node('B1')])];
    const locked = await mountTree(rows(), { defaultExpanded: true });
    expect(display(locked.grid)).toEqual(['A', 'A1', 'A2', 'B', 'B1']);
    // A1 → after B1 would put it under B.
    expect(locked.rdd.canMoveRow(1, 4)).toBe(false);
    document.body.innerHTML = '';

    const canReparent = vi.fn(() => true);
    const data = rows();
    const { grid, rdd, moves } = await mountTree(data, { defaultExpanded: true, canReparent });
    rdd.moveRow(1, 4);
    await waitUpgrade(grid);

    expect(canReparent).toHaveBeenCalledWith(data[0].children![0], data[1], data[0]);
    expect(display(grid)).toEqual(['A', 'A2', 'B', 'B1', 'A1']);
    expect(moves[0]).toMatchObject({ fromParent: data[0], toParent: data[1], fromIndex: 0, toIndex: 1 });
  });

  it('never moves a node into its own subtree', async () => {
    const { rdd } = await mountTree([node('A', [node('A1'), node('A2')]), node('X')], {
      defaultExpanded: true,
      canReparent: () => true,
    });
    // A → after A2 would make A a child of itself.
    expect(rdd.canMoveRow(0, 2)).toBe(false);
  });

  it('a row dropped just below an expanded parent with no children yet becomes its first child', async () => {
    const canReparent = vi.fn(() => true);
    const folder = { ...node('L', []), type: 'folder' };
    const { grid, rdd } = await mountTree([node('X'), folder], {
      hasChildren: (r) => r.type === 'folder',
      canReparent,
    });
    grid.getPluginByName('tree')!.expand('L');
    await waitUpgrade(grid);

    rdd.moveRow(0, 1); // X after L
    await waitUpgrade(grid);

    expect(canReparent).toHaveBeenCalledWith(expect.objectContaining({ name: 'X' }), folder, null);
    expect(names(grid.sourceRows)).toEqual(['L']);
    expect(names((grid.sourceRows[0] as Node).children!)).toEqual(['X']);
  });

  it('Alt+↑ moves a root above the previous root instead of into its subtree, and focus follows', async () => {
    const { grid, rdd } = await mountTree([node('A', [node('A1'), node('A2')]), node('X')], { defaultExpanded: true });
    grid._focusRow = 3;

    const handled = rdd.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true }));
    await waitUpgrade(grid);

    expect(handled).toBe(true);
    expect(display(grid)).toEqual(['X', 'A', 'A1', 'A2']);
    expect(grid._focusRow).toBe(0);
  });

  it('a drop below the last row moves the row to the end of the top level, not into the last subtree', async () => {
    const data = [node('A', [node('A1')]), node('B', [node('B1')])];
    const { grid, moves } = await mountTree(data, { defaultExpanded: true });

    fireDrag(grid.querySelector('.cell[data-row="0"] .dg-row-drag-handle')!, 'dragstart');
    const body = grid.querySelector('.rows')!;
    for (const type of ['dragover', 'drop', 'dragend']) fireDrag(body, type);
    await waitUpgrade(grid);

    expect(display(grid)).toEqual(['B', 'B1', 'A', 'A1']);
    expect(moves[0]).toMatchObject({ fromParent: null, toParent: null, fromIndex: 0, toIndex: 1 });
  });

  it('sends a child to another grid, removing it from the source tree', async () => {
    const data = [node('A', [node('A1'), node('A2')]), node('X')];
    const { grid } = await mountTree(data, { defaultExpanded: true }, { dropZone: 'z' });
    const peer = await mountPeer('Archive', [node('P')]);

    openMenu(grid, 1);
    menuItem('Send to Archive')!.click();
    await waitUpgrade(grid);
    await waitUpgrade(peer);

    expect(display(grid)).toEqual(['A', 'A2', 'X']);
    expect(names(peer.sourceRows)).toEqual(['P', 'A1']);
  });

  it('sends a selected parent and its selected child once, with the child inside the parent', async () => {
    const data = [node('A', [node('P', [node('c')])]), node('X')];
    const selection = new SelectionPlugin({ mode: 'row' });
    const { grid } = await mountTree(data, { defaultExpanded: true }, { dropZone: 'z' }, [selection]);
    // A flat target: the selection must be narrowed at the source, where nesting (and identity) is known.
    const target = await mountPeer('Archive', [node('Q')]);
    const transferred = vi.fn();
    grid.addEventListener('row-transfer', (e) => transferred(names((e as CustomEvent).detail.rows)));
    expect(display(grid)).toEqual(['A', 'P', 'c', 'X']);
    selection.selectRows([1, 2]);

    openMenu(grid, 1);
    menuItem('Send to Archive')!.click();
    await waitUpgrade(grid);
    await waitUpgrade(target);

    expect(display(grid)).toEqual(['A', 'X']);
    expect(names(target.sourceRows)).toEqual(['Q', 'P']);
    expect(transferred).toHaveBeenCalledWith(['P']);
  });

  it('lands rows dropped in from another grid at the top level of the tree', async () => {
    const { grid } = await mountTree(
      [node('A', [node('A1')]), node('X')],
      { defaultExpanded: true },
      { dropZone: 'z' },
    );
    grid.setAttribute('aria-label', 'Tree');
    const flat = await mountPeer('Flat', [node('F')]);

    openMenu(flat, 0);
    menuItem('Send to Tree')!.click();
    await waitUpgrade(grid);

    expect(names(grid.sourceRows)).toEqual(['A', 'X', 'F']);
    expect(display(grid)).toEqual(['A', 'A1', 'X', 'F']);
  });

  it('Alt+↓ steps over the next VISIBLE sibling when a filter hides the one in between', async () => {
    const filter = new FilteringPlugin();
    const rdd = new RowDragDropPlugin({ animation: false });
    const grid = createGrid();
    grid.gridConfig = { columns: [{ field: 'name' }], plugins: [new TreePlugin(), filter, rdd] };
    grid.rows = [node('A'), node('B'), node('C', [node('C1')])];
    await waitUpgrade(grid);
    filter.setFilter('name', { type: 'text', operator: 'notEquals', value: 'B' });
    await waitUpgrade(grid);
    grid._focusRow = 0;

    rdd.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }));
    await waitUpgrade(grid);

    expect(display(grid)).toEqual(['C', 'A']);
    expect(names(grid.sourceRows)).toEqual(['B', 'C', 'A']);
  });

  it.each([
    ['lazily loaded', { ...node('L'), type: 'folder' }, 1],
    ['embedded', { ...node('L', [node('x')]), type: 'folder' }, 0],
  ])('keeps %s children loaded when the last child moves out of its parent', async (_, parent, fetches) => {
    const loadChildren = vi.fn(async (): Promise<TreeRow[]> => [{ id: 'x', name: 'x' }]);
    const tree = new TreePlugin({ hasChildren: (r) => r.type === 'folder', loadChildren, canReparent: () => true });
    const rdd = new RowDragDropPlugin({ animation: false });
    const grid = createGrid();
    grid.gridConfig = { columns: [{ field: 'name' }], plugins: [tree, rdd] };
    grid.rows = [parent, node('Y')];
    await waitUpgrade(grid);
    tree.expand('L');
    await vi.waitFor(() => expect(display(grid)).toEqual(['L', 'x', 'Y']));

    rdd.moveRow(1, 2);
    await waitUpgrade(grid);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await waitUpgrade(grid);

    expect(display(grid)).toEqual(['L', 'Y', 'x']);
    expect(loadChildren).toHaveBeenCalledTimes(fetches);

    // A manual re-expand checks "already loaded", not "already requested".
    tree.collapse('L');
    tree.expand('L');
    await waitUpgrade(grid);
    expect(loadChildren).toHaveBeenCalledTimes(fetches);
  });

  it.each([
    ['an empty list', []],
    ['a lazy marker', true],
  ])('refuses dropping below a parent whose children (%s) are still loading, until they load', async (_, kids) => {
    let release!: (rows: TreeRow[]) => void;
    const loadChildren = vi.fn(() => new Promise<TreeRow[]>((resolve) => (release = resolve)));
    const folder = { ...node('L'), children: kids, type: 'folder' } as Node;
    const { grid, rdd } = await mountTree([node('X'), folder], {
      hasChildren: (r) => r.type === 'folder',
      loadChildren,
      canReparent: () => true,
    });
    grid.getPluginByName('tree')!.expand('L');
    await waitUpgrade(grid);
    expect(loadChildren).toHaveBeenCalledTimes(1);

    rdd.moveRow(0, 1); // X into L, below it
    await waitUpgrade(grid);
    expect(names(grid.sourceRows)).toEqual(['X', 'L']);

    release([{ id: 'c', name: 'c' }]);
    await vi.waitFor(() => expect(display(grid)).toEqual(['X', 'L', 'c']));
  });

  it('once its last child moved to the top level, the flat data places inserts by root position', async () => {
    const { grid, rdd } = await mountTree([node('P', [node('c')]), node('Q')], {
      defaultExpanded: true,
      canReparent: () => true,
    });
    rdd.moveRow(1, 2); // c after Q, at the top level: P, Q, c — no tree left
    await waitUpgrade(grid);
    expect(display(grid)).toEqual(['P', 'Q', 'c']);
    const c = grid.rows[2];
    const query: RowMoveQuery = { op: 'insert', rows: [node('X')], target: c, position: 'before' };

    const answer = grid.query<RowMoveResolution | false | undefined>('rows:resolve-move', query).find(Boolean);

    expect(names((answer as RowMoveResolution).rows)).toEqual(['P', 'Q', 'X', 'c']);
  });

  it('refuses rows sent into a tree whose roots an active data source renders', async () => {
    const { grid } = await mountTree([node('A')], {}, {}, [new ActiveDataSource()]);
    const query: RowMoveQuery = { op: 'insert', rows: [node('N')], target: null, position: 'before' };

    expect(grid.query('rows:resolve-move', query)).toContain(false);
  });

  it('a drag in progress follows its row when lazy children render above it', async () => {
    const loadChildren = vi.fn(async (): Promise<TreeRow[]> => [{ id: 'x', name: 'x' }]);
    const tree = new TreePlugin({ hasChildren: (r) => r.type === 'folder', loadChildren, canReparent: () => true });
    const rdd = new RowDragDropPlugin({ animation: false });
    const grid = createGrid();
    grid.gridConfig = { columns: [{ field: 'name' }], plugins: [tree, rdd] };
    grid.rows = [{ ...node('P'), type: 'folder' }, node('Q'), node('R')];
    await waitUpgrade(grid);

    fireDrag(grid.querySelector('.cell[data-row="1"] .dg-row-drag-handle')!, 'dragstart'); // Q
    tree.expand('P');
    await vi.waitFor(() => expect(display(grid)).toEqual(['P', 'x', 'Q', 'R']));
    const body = grid.querySelector('.rows')!;
    for (const type of ['dragover', 'drop', 'dragend']) fireDrag(body, type); // below the last row
    await waitUpgrade(grid);

    expect(display(grid)).toEqual(['P', 'x', 'R', 'Q']);
  });

  it('an allowed drop spot clears the rejection an earlier hover showed', async () => {
    const { grid } = await mountTree([node('A', [node('A1'), node('A2')]), node('B')], { defaultExpanded: true });
    const rejected = () => grid.classList.contains('tbw-grid--drop-target-rejected');

    fireDrag(grid.querySelector('.cell[data-row="1"] .dg-row-drag-handle')!, 'dragstart'); // A1
    fireDrag(grid.querySelector('.rows')!, 'dragover'); // below the last row: A1 can't leave A
    expect(rejected()).toBe(true);
    fireDrag(grid.querySelector('.cell[data-row="2"]')!, 'dragover'); // after its sibling A2
    expect(rejected()).toBe(false);
    fireDrag(grid.querySelector('.rows')!, 'dragend');
  });

  it('reorders tree roots across a root whose children are grouped', async () => {
    const rdd = new RowDragDropPlugin({ animation: false });
    const grid = createGrid();
    const groupOn = (r: { kind?: string }, { depth }: { depth: number }) => (depth > 0 ? (r.kind ?? null) : null);
    grid.gridConfig = {
      columns: [{ field: 'name' }],
      plugins: [
        new TreePlugin({ defaultExpanded: true }),
        new GroupingRowsPlugin({ groupOn, defaultExpanded: true }),
        rdd,
      ],
    };
    grid.rows = [node('R1', [{ ...node('c1'), kind: 'a' } as Node]), node('R2')];
    await waitUpgrade(grid);
    expect(grid.rows).toHaveLength(4); // R1, [a], c1, R2

    rdd.moveRow(3, 0);
    await waitUpgrade(grid);

    expect(names(grid.sourceRows)).toEqual(['R2', 'R1']);
  });

  /** A tree whose rows are grouped by their `g` (a value or a path) at every level, every group expanded. */
  async function mountRootGroups(rows: Node[]) {
    const rdd = new RowDragDropPlugin({ animation: false });
    const grouping = new GroupingRowsPlugin({
      groupOn: (r: Node) => r.g ?? null,
      defaultExpanded: true,
    });
    const grid = createGrid();
    grid.gridConfig = {
      columns: [{ field: 'name' }],
      plugins: [new TreePlugin({ defaultExpanded: true }), grouping, rdd],
    };
    grid.rows = rows;
    await waitUpgrade(grid);
    // `defaultExpanded` opens only each list's top-level groups.
    for (const key of ['g1||sub', 'g2||sub']) grouping.expand(key);
    await waitUpgrade(grid);
    const moves = vi.fn();
    grid.addEventListener('row-move', moves);
    return { grid, rdd, moves };
  }

  it.each([
    ['Alt+↓, groups of equal depth', 'g1', 'g2', 'ArrowDown', 1, 5], // [g1], A, A1, [g2], B
    ['Alt+↓, a shallower next group', ['g1', 'sub'], 'g2', 'ArrowDown', 2, 6], // [g1], [sub], A, A1, [g2], B
    ['Alt+↑, a shallower previous group', 'g1', ['g2', 'sub'], 'ArrowUp', 5, 6], // [g1], A, A1, [g2], [sub], B
  ])('%s: a root does not step over a sibling in another root group', async (_, gA, gB, key, at, length) => {
    const { grid, rdd, moves } = await mountRootGroups([
      { ...node('A', [node('A1')]), g: gA },
      { ...node('B'), g: gB },
    ]);
    expect(grid.rows).toHaveLength(length);
    grid._focusRow = at;

    expect(rdd.onKeyDown(new KeyboardEvent('keydown', { key, altKey: true }))).toBeFalsy();
    expect(moves).not.toHaveBeenCalled();
  });

  it('moves a child to the bottom of its parent when another root group follows', async () => {
    const { grid } = await mountRootGroups([
      { ...node('A', [node('A1'), node('A2')]), g: 'g1' },
      { ...node('B'), g: 'g2' },
    ]); // [g1], A, A1, A2, [g2], B

    openMenu(grid, 2);
    menuItem('Move to bottom')!.click();
    await waitUpgrade(grid);

    expect(names((grid.sourceRows[0] as Node).children!)).toEqual(['A2', 'A1']);
  });

  it("moves a child to the top of its group when groups split its parent's children", async () => {
    const { grid } = await mountRootGroups([
      node('P', [
        { ...node('A'), g: 'G' },
        { ...node('B'), g: 'G' },
      ]),
    ]);
    expect(grid.rows).toHaveLength(4); // P, [G], A, B

    openMenu(grid, 3);
    menuItem('Move to top')!.click();
    await waitUpgrade(grid);

    expect(names((grid.sourceRows[0] as Node).children!)).toEqual(['B', 'A']);
  });

  it.each([
    ['nested', [node('A1')], 3], // [g1], A, A1, [g2], B
    ['flat', undefined, 2], // [g1], A, [g2], B
  ])('rows dropped in on a group header land before that group’s first root (%s data)', async (_, kids, at) => {
    const { grid } = await mountRootGroups([
      { ...node('A', kids), g: 'g1' },
      { ...node('B'), g: 'g2' },
    ]);
    const query: RowMoveQuery = {
      op: 'insert',
      rows: [{ ...node('N'), g: 'g2' }],
      target: grid.rows[at],
      position: 'before',
    };

    const answer = grid.query<RowMoveResolution | false | undefined>('rows:resolve-move', query).find(Boolean);

    expect(names((answer as RowMoveResolution).rows)).toEqual(['A', 'N', 'B']);
  });

  it('a drag picked up on a selected child of a selected parent is checked as the parent it moves', async () => {
    const selection = new SelectionPlugin({ mode: 'row' });
    const { grid } = await mountTree([node('P', [node('c')]), node('Q')], { defaultExpanded: true }, {}, [selection]);
    selection.selectRows([0, 1]);

    fireDrag(grid.querySelector('.cell[data-row="1"] .dg-row-drag-handle')!, 'dragstart'); // on c
    const body = grid.querySelector('.rows')!;
    fireDrag(body, 'dragover'); // below the last row
    expect(grid.classList.contains('tbw-grid--drop-target-rejected')).toBe(false);
    for (const type of ['drop', 'dragend']) fireDrag(body, type);
    await waitUpgrade(grid);

    expect(display(grid)).toEqual(['Q', 'P', 'c']);
  });
});

describe('RowDragDrop cross-window acknowledgements (#669)', () => {
  async function mountFlat(rows: Node[], extra: BaseGridPlugin[] = [], rddFirst = false) {
    vi.stubGlobal('BroadcastChannel', TestBroadcastChannel);
    const rdd = new RowDragDropPlugin({ animation: false, dropZone: 'z' });
    const grid = createGrid();
    grid.gridConfig = {
      columns: [{ field: 'name' }],
      plugins: rddFirst ? [rdd, ...extra] : [...extra, rdd],
    };
    grid.rows = rows;
    await waitUpgrade(grid);
    return { grid, rdd };
  }

  it('blocks another reorder until the remotely removed rows render', async () => {
    const rows = [node('P'), node('Q'), node('R'), node('S')];
    const { grid, rdd } = await mountFlat(rows);
    const payload = startCrossWindowDrag(grid, 1);
    grid._focusRow = 0;
    rdd.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }));

    let canMoveBeforeRemovalRenders = true;
    grid.addEventListener('row-transfer', () => {
      canMoveBeforeRemovalRenders = rdd.canMoveRow(1, 2);
      rdd.moveRow(1, 2);
    });
    acknowledgeCrossWindowMove(payload);

    expect(canMoveBeforeRemovalRenders).toBe(false);
    await waitUpgrade(grid);
    expect(names(grid.sourceRows)).toEqual(['P', 'R', 'S']);
    expect(display(grid)).toEqual(['P', 'R', 'S']);
    expect(rdd.canMoveRow(1, 2)).toBe(true);

    rdd.moveRow(1, 2);
    await waitUpgrade(grid);
    expect(names(grid.sourceRows)).toEqual(['P', 'S', 'R']);
  });

  it('reconciles an unacknowledged drag before shifting it through a keyboard move', async () => {
    const rows = [node('P'), node('Q'), node('R')];
    const { grid, rdd } = await mountFlat(rows);
    const payload = startCrossWindowDrag(grid, 1);
    fireDrag(grid, 'dragend');

    const [p, q, r] = rows;
    grid.rows = [p, node('X'), q, r];
    await waitUpgrade(grid);
    grid._focusRow = 3;
    rdd.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true }));

    acknowledgeCrossWindowMove(payload);
    await waitUpgrade(grid);

    expect(names(grid.sourceRows)).toEqual(['P', 'X', 'R']);
    expect(display(grid)).toEqual(['P', 'X', 'R']);
  });

  it('does not let an unrelated copy confirmation accept the active move', async () => {
    const rows = [node('P'), node('Q'), node('R')];
    const { grid } = await mountFlat(rows);
    const payload = startCrossWindowDrag(grid, 1);
    const operations: string[] = [];
    grid.addEventListener('row-transfer', (event) => {
      operations.push((event as CustomEvent<{ operation: string }>).detail.operation);
    });

    const copy = new TestBroadcastChannel('tbw-row-drag-drop');
    copy.postMessage({
      type: 'tbw-row-drag-drop:transfer',
      sessionId: 'unrelated-session',
      sourceGridId: payload.sourceGridId,
      toGridId: 'copy-target',
      dropZone: payload.dropZone,
      rowIndices: [0],
      toIndex: 0,
      operation: 'copy',
      serializedRows: [payload.rows[0]],
    });
    copy.close();
    expect(operations).toEqual(['copy']);

    acknowledgeCrossWindowMove(payload);
    await waitUpgrade(grid);

    expect(names(grid.sourceRows)).toEqual(['P', 'R']);
    expect(operations).toEqual(['copy', 'move']);
  });

  it.each([false, true])(
    'rejects a queued source update that removes part of a multi-row drag (RowDragDrop first: %s)',
    async (rddFirst) => {
      const rows = [node('P'), node('Q'), node('R')];
      const selection = new SelectionPlugin({ mode: 'row' });
      const { grid } = await mountFlat(rows, [selection], rddFirst);
      selection.selectRows([1, 2]);
      const payload = startCrossWindowDrag(grid, 1);
      fireDrag(grid, 'dragend');

      grid.rows = [rows[0], rows[2]];
      acknowledgeCrossWindowMove(payload);
      await waitUpgrade(grid);

      expect(names(grid.sourceRows)).toEqual(['P', 'R']);
    },
  );

  it.each([false, true])(
    'rejects a queued update that removes one selected repeated-row occurrence (RowDragDrop first: %s)',
    async (rddFirst) => {
      const duplicate = node('A');
      const rows = [node('P'), duplicate, duplicate, node('R')];
      const selection = new SelectionPlugin({ mode: 'row' });
      const { grid } = await mountFlat(rows, [selection], rddFirst);
      selection.selectRows([1, 2]);
      const payload = startCrossWindowDrag(grid, 1);
      fireDrag(grid, 'dragend');

      grid.rows = [rows[0], duplicate, rows[3]];
      acknowledgeCrossWindowMove(payload);
      await waitUpgrade(grid);

      expect(names(grid.sourceRows)).toEqual(['P', 'A', 'R']);
    },
  );

  it.each([false, true])(
    'does not resurrect an unacknowledged drag occurrence across successive renders (RowDragDrop first: %s)',
    async (rddFirst) => {
      const duplicate = node('A');
      const [a, b, c] = [duplicate, node('B'), node('C')];
      const rows = [a, b, a, c];
      const selection = new SelectionPlugin({ mode: 'row' });
      const { grid } = await mountFlat(rows, [selection], rddFirst);
      selection.selectRows([2]);
      const payload = startCrossWindowDrag(grid, 2);
      fireDrag(grid, 'dragend');

      grid.rows = [b, a, c];
      await waitUpgrade(grid);
      grid.rows = [b, a, c, a];
      await waitUpgrade(grid);
      acknowledgeCrossWindowMove(payload);
      await waitUpgrade(grid);

      expect(names(grid.sourceRows)).toEqual(['B', 'A', 'C', 'A']);
    },
  );
});

describe('RowDragDrop cross-grid vetoes (#663)', () => {
  it.each([
    ['removal on the source', 'remove', 'source'],
    ['insertion on the target', 'insert', 'target'],
  ] as const)('a vetoed %s leaves both grids unchanged', async (_, op, side) => {
    const veto = [new VetoPlugin(op)];
    const source = await mountPeer('Source', [node('a'), node('b')], side === 'source' ? veto : []);
    const target = await mountPeer('Target', [node('t')], side === 'target' ? veto : []);
    const transfers = vi.fn();
    source.addEventListener('row-transfer', transfers);

    openMenu(source, 0);
    menuItem('Send to Target')!.click();
    await waitUpgrade(source);
    await waitUpgrade(target);

    expect(names(source.sourceRows)).toEqual(['a', 'b']);
    expect(names(target.sourceRows)).toEqual(['t']);
    expect(transfers).not.toHaveBeenCalled();
  });

  it('copying the same row twice keeps both copies in the target', async () => {
    const source = await mountPeer('Source', [node('a')], [], { operation: 'copy' });
    const target = await mountPeer('Target', [node('t')]);

    for (let i = 0; i < 2; i++) {
      openMenu(source, 0);
      menuItem('Copy to Target')!.click();
      await waitUpgrade(target);
    }

    expect(names(target.sourceRows)).toEqual(['t', 'a', 'a']);
    expect(names(source.sourceRows)).toEqual(['a']);
  });

  it('a vetoed selection (pick) is not transferred at all', async () => {
    const selection = new SelectionPlugin({ mode: 'row' });
    const source = await mountPeer('Source', [node('a'), node('b')], [new VetoPlugin('pick'), selection]);
    const target = await mountPeer('Target', [node('t')]);
    selection.selectRows([0, 1]);

    openMenu(source, 0);
    menuItem('Send to Target')!.click();
    await waitUpgrade(target);

    expect(names(source.sourceRows)).toEqual(['a', 'b']);
    expect(names(target.sourceRows)).toEqual(['t']);
  });

  it('sending one of two references to the same row object removes only that one', async () => {
    const a = node('a');
    const source = await mountPeer('Source', [a, a, node('b')]);
    const target = await mountPeer('Target', [node('t')]);

    openMenu(source, 1);
    menuItem('Send to Target')!.click();
    await waitUpgrade(source);

    expect(names(source.sourceRows)).toEqual(['a', 'b']);
    expect(names(target.sourceRows)).toEqual(['t', 'a']);
  });

  it.each([
    ['the move menu', 'source', ['B', 'A'], ['t1', 't2', 'C']],
    ['the move menu', 'target', ['A', 'B'], ['t2', 't1', 'C']],
    ['a drag', 'source', ['B', 'A'], ['t1', 't2', 'C']],
    ['a drag', 'target', ['A', 'B'], ['t2', 't1', 'C']],
  ] as const)(
    'a row sent with %s keeps a pending keyboard move on the %s grid',
    async (how, side, inSource, inTarget) => {
      const source = await mountPeer('Source', [node('A'), node('B'), node('C')], [], { debounceMs: 20 });
      const target = await mountPeer('Target', [node('t1'), node('t2')], [], { debounceMs: 20 });
      const keyed = side === 'source' ? source : target;
      keyed._focusRow = 0;
      keyed.getPluginByName('rowDragDrop')!.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }));

      if (how === 'a drag') {
        fireDrag(source.querySelector('.cell[data-row="2"] .dg-row-drag-handle')!, 'dragstart'); // C
        for (const type of ['dragover', 'drop']) fireDrag(target.querySelector('.rows')!, type);
        fireDrag(source.querySelector('.rows')!, 'dragend');
      } else {
        openMenu(source, 2); // C
        menuItem('Send to Target')!.click();
      }
      await new Promise((resolve) => setTimeout(resolve, 60));
      await waitUpgrade(source);
      await waitUpgrade(target);

      expect(names(source.sourceRows)).toEqual(inSource);
      expect(names(target.sourceRows)).toEqual(inTarget);
    },
  );
  it.each(['move', 'copy'] as const)(
    'a %s drag whose row is filtered out before it drops on another grid changes nothing',
    async (operation) => {
      const filter = new FilteringPlugin();
      const source = await mountPeer('Source', [node('a'), node('b')], [filter], { operation });
      const target = await mountPeer('Target', [node('t')]);

      fireDrag(source.querySelector('.cell[data-row="0"] .dg-row-drag-handle')!, 'dragstart'); // a
      filter.setFilter('name', { type: 'text', operator: 'notEquals', value: 'a' });
      await vi.waitFor(() => expect(display(source)).toEqual(['b']));
      for (const type of ['dragover', 'drop']) fireDrag(target.querySelector('.rows')!, type);
      fireDrag(source.querySelector('.rows')!, 'dragend');
      await waitUpgrade(source);
      await waitUpgrade(target);

      expect(names(source.sourceRows)).toEqual(['a', 'b']);
      expect(names(target.sourceRows)).toEqual(['t']);
    },
  );
});

describe('RowDragDrop programmatic and keyboard moves (#663)', () => {
  /** A flat grid (debounce 20 ms) with `row-move` recorded by row name; `extra` plugins go first. */
  async function mountFlat(rows: Node[], extra: BaseGridPlugin[] = []) {
    const rdd = new RowDragDropPlugin({ animation: false, debounceMs: 20 });
    const grid = createGrid();
    grid.gridConfig = { columns: [{ field: 'name' }], plugins: [...extra, rdd] };
    grid.rows = rows;
    await waitUpgrade(grid);
    const moved: string[] = [];
    grid.addEventListener('row-move', (e) => moved.push((e as CustomEvent<RowMoveDetail<Node>>).detail.row.name));
    const press = (key: 'ArrowUp' | 'ArrowDown') => rdd.onKeyDown(new KeyboardEvent('keydown', { key, altKey: true }));
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      await waitUpgrade(grid);
    };
    return { grid, rdd, moved, press, settle };
  }

  it('two moveRow() calls in the same tick both act on the current order', async () => {
    const { grid, rdd, moved } = await mountFlat([node('a'), node('b'), node('c')]);

    rdd.moveRow(0, 2);
    rdd.moveRow(0, 1);
    await waitUpgrade(grid);

    expect(display(grid)).toEqual(['c', 'b', 'a']);
    expect(moved).toEqual(['a', 'b']);
  });

  it('Alt+↓ on a second row before the debounce settles moves each row once', async () => {
    const { grid, moved, press, settle } = await mountFlat([node('A'), node('B'), node('C'), node('D')]);

    grid._focusRow = 0;
    press('ArrowDown'); // A ↓ — pending
    grid._focusRow = 2; // plain ↓ onto C
    press('ArrowDown'); // C ↓
    await settle();

    expect(names(grid.sourceRows)).toEqual(['B', 'A', 'D', 'C']);
    expect(display(grid)).toEqual(['B', 'A', 'D', 'C']);
    expect(moved).toEqual(['A', 'C']);
  });

  it('moveRow() settles a pending keyboard move first, so its timer cannot undo the newer move', async () => {
    const { grid, rdd, press, settle } = await mountFlat([node('A'), node('B'), node('C'), node('D')]);
    grid._focusRow = 0;

    press('ArrowDown'); // B, A, C, D — pending
    rdd.moveRow(1, 3); // A to the bottom
    await settle();

    expect(names(grid.sourceRows)).toEqual(['B', 'C', 'D', 'A']);
    expect(display(grid)).toEqual(['B', 'C', 'D', 'A']);
  });

  it('Alt+↓ presses right after moveRow(), before it renders, keep moving the same row', async () => {
    const { grid, rdd, moved, press, settle } = await mountFlat([node('A'), node('B'), node('C'), node('D')]);

    rdd.moveRow(0, 1); // B, A, C, D — rebuild queued
    grid._focusRow = 1; // A
    press('ArrowDown');
    press('ArrowDown');
    await settle();

    expect(names(grid.sourceRows)).toEqual(['B', 'C', 'D', 'A']);
    expect(display(grid)).toEqual(['B', 'C', 'D', 'A']);
    expect(moved).toEqual(['A', 'A', 'A']);
  });

  it.each([
    ['core sorting', [] as BaseGridPlugin[], (grid: DataGridElement) => grid.sort('name', 'asc')],
    [
      'MultiSort',
      [new MultiSortPlugin()],
      (grid: DataGridElement) => grid.getPluginByName('multiSort')!.setSortModel([{ field: 'name', direction: 'asc' }]),
    ],
  ])('refuses keyboard reorders while %s orders the rows, which would undo them', async (_, extra, sort) => {
    const { grid, moved, press, settle } = await mountFlat([node('A'), node('B'), node('C')], extra);
    sort(grid);
    await waitUpgrade(grid);
    grid._focusRow = 0;

    expect(press('ArrowDown')).toBeFalsy();
    await settle();

    expect(display(grid)).toEqual(['A', 'B', 'C']);
    expect(moved).toEqual([]);
  });

  it('a server-side filterHandler refuses keyboard moves, which its cached result would undo', async () => {
    const filter = new FilteringPlugin({ filterHandler: (_, rows) => rows });
    const { grid, moved, press, settle } = await mountFlat([node('A'), node('B'), node('C')], [filter]);
    filter.setFilter('name', { type: 'text', operator: 'notEquals', value: 'zzz' });
    await settle();
    grid._focusRow = 0;

    expect(press('ArrowDown')).toBeFalsy();
    await settle();

    expect(names(grid.sourceRows)).toEqual(['A', 'B', 'C']);
    expect(moved).toEqual([]);
  });

  it('a pending keyboard move whose rows were all filtered out leaves the data intact', async () => {
    const filter = new FilteringPlugin();
    const { grid, moved, press, settle } = await mountFlat([node('A'), node('B'), node('C')], [filter]);
    grid._focusRow = 0;

    press('ArrowDown');
    filter.setFilter('name', { type: 'text', operator: 'equals', value: 'none' });
    await settle();

    expect(names(grid.sourceRows)).toEqual(['A', 'B', 'C']);
    expect(moved).toEqual([]);
  });

  it('a pending keyboard move is dropped when replacement rows put another row in its source slot', async () => {
    const filter = new FilteringPlugin();
    const { grid, moved, press, settle } = await mountFlat([node('hidden'), node('A'), node('B')], [filter]);
    filter.setFilter('name', { type: 'text', operator: 'notEquals', value: 'hidden' });
    await waitUpgrade(grid);
    grid._focusRow = 0; // A — source index 1

    press('ArrowDown');
    grid.rows = [node('X'), node('Y'), node('Z')]; // Y now holds source index 1 and display slot 1
    await waitUpgrade(grid);
    await settle();

    expect(names(grid.sourceRows)).toEqual(['X', 'Y', 'Z']);
    expect(moved).toEqual([]);
  });

  it('Alt+↓ after a debounced move flushed, before it renders, is not lost', async () => {
    const { grid, rdd, moved, press, settle } = await mountFlat([node('A'), node('B'), node('C')]);
    grid._focusRow = 0;

    press('ArrowDown'); // B, A, C — pending
    rdd.onCellClick(); // flushes: the rebuild is queued
    press('ArrowDown'); // A again
    await settle();

    expect(names(grid.sourceRows)).toEqual(['B', 'C', 'A']);
    expect(display(grid)).toEqual(['B', 'C', 'A']);
    expect(moved).toEqual(['A', 'A']);
  });

  it.each([
    ['new rows', (rows: Node[]) => rows.map((r) => node(`${r.name}2`))],
    ['the same rows reordered', (rows: Node[]) => [...rows].reverse()],
  ])('a pending keyboard move is dropped when %s replace the data before it settles', async (_, replace) => {
    const initial = [node('A'), node('B'), node('C')];
    const { grid, moved, press, settle } = await mountFlat(initial);
    grid._focusRow = 0;

    press('ArrowDown');
    const replacement = replace(initial);
    grid.rows = replacement;
    await waitUpgrade(grid);
    await settle();

    expect(names(grid.sourceRows)).toEqual(names(replacement));
    expect(moved).toEqual([]);
  });

  describe('a row object that appears more than once', () => {
    const a = node('a');

    it('moveRow() moves the shown occurrence', async () => {
      const { grid, rdd } = await mountFlat([a, node('t'), a]);

      rdd.moveRow(2, 1); // the second `a`, before `t`
      await waitUpgrade(grid);

      expect(names(grid.sourceRows)).toEqual(['a', 'a', 't']);
    });

    it('Alt+↑ moves the focused occurrence', async () => {
      const { grid, press, settle } = await mountFlat([a, node('t'), a]);
      grid._focusRow = 2;

      expect(press('ArrowUp')).toBe(true);
      await settle();

      expect(names(grid.sourceRows)).toEqual(['a', 'a', 't']);
    });

    it('focus follows the moved occurrence of an immediate Alt+↑, not the first copy', async () => {
      const { grid, rdd, press, settle } = await mountFlat([a, node('b'), node('c'), a]);

      rdd.moveRow(1, 2); // a, c, b, a — rebuild queued, so the next press commits at once
      grid._focusRow = 3;
      press('ArrowUp');
      await settle();

      expect(display(grid)).toEqual(['a', 'c', 'a', 'b']);
      expect(grid._focusRow).toBe(2);
    });

    it('a debounced move past the other copy persists the order it showed', async () => {
      const { grid, press, settle } = await mountFlat([a, node('b'), a, node('c')]);
      grid._focusRow = 0;

      press('ArrowDown'); // b, a, a, c
      press('ArrowDown'); // past the other `a`
      await settle();

      expect(names(grid.sourceRows)).toEqual(['b', 'a', 'a', 'c']);
    });

    it('Alt+↓ on the other copy settles the pending move first, one event per copy', async () => {
      const { grid, moved, press, settle } = await mountFlat([a, node('b'), a, node('c')]);
      grid._focusRow = 0;

      press('ArrowDown'); // first `a`: b, a, a, c — pending
      grid._focusRow = 2; // the other `a`
      press('ArrowDown');
      await settle();

      expect(names(grid.sourceRows)).toEqual(['b', 'a', 'c', 'a']);
      expect(moved).toEqual(['a', 'a']);
    });

    it('a drag keeps its copy when a render shifts the rows before it drops', async () => {
      const { grid } = await mountFlat([a, node('b'), a, node('c')]);

      fireDrag(grid.querySelector('.cell[data-row="2"] .dg-row-drag-handle')!, 'dragstart'); // the second `a`
      grid.rows = [node('x'), ...(grid.sourceRows as Node[])];
      await waitUpgrade(grid);
      const body = grid.querySelector('.rows')!;
      for (const type of ['dragover', 'drop', 'dragend']) fireDrag(body, type); // below the last row
      await waitUpgrade(grid);

      expect(names(grid.sourceRows)).toEqual(['x', 'a', 'b', 'c', 'a']);
    });

    it('cancelling only the pending move keeps a newer move on the copy it named', async () => {
      const { grid, rdd, press, settle } = await mountFlat([a, node('b'), a, node('c')]);
      let first = true;
      grid.addEventListener('row-move', (e) => {
        if (first) e.preventDefault();
        first = false;
      });
      grid._focusRow = 0;

      press('ArrowDown');
      press('ArrowDown'); // b, a, a(moved), c — pending
      rdd.moveRow(1, 3); // the copy that did NOT move, after c; the pending move is cancelled
      await settle();

      expect(names(grid.sourceRows)).toEqual(['a', 'b', 'c', 'a']);
    });

    it('cancelling a debounced move puts back only the moved copy', async () => {
      const { grid, press, settle } = await mountFlat([a, node('b'), a]);
      grid.addEventListener('row-move', (e) => e.preventDefault());
      grid._focusRow = 0;

      press('ArrowDown');
      await settle();

      expect(display(grid)).toEqual(['a', 'b', 'a']);
      expect(names(grid.sourceRows)).toEqual(['a', 'b', 'a']);
    });
  });
});
describe('RowDragDrop + GroupingRows (#663)', () => {
  async function mountGrouped() {
    const rdd = new RowDragDropPlugin({ animation: false });
    const grid = createGrid();
    grid.gridConfig = {
      columns: [{ field: 'name' }, { field: 'g' }],
      plugins: [new GroupingRowsPlugin({ groupOn: (r: { g: string }) => r.g, defaultExpanded: true }), rdd],
    };
    const rows = [
      { name: 'a', g: 'G1' },
      { name: 'b', g: 'G2' },
      { name: 'c', g: 'G1' },
    ];
    grid.rows = rows;
    await waitUpgrade(grid);
    return { grid, rdd, rows };
  }

  it('moves a row within its group by identity, in source order', async () => {
    const { grid, rdd, rows } = await mountGrouped();
    // [G1] a c [G2] b — c (display 2) above a (display 1).
    rdd.moveRow(2, 1);
    await waitUpgrade(grid);

    expect(grid.sourceRows).toEqual([rows[2], rows[0], rows[1]]);
  });

  it('refuses moves that would cross a group boundary', async () => {
    const { rdd } = await mountGrouped();
    expect(rdd.canMoveRow(2, 4)).toBe(false);
    expect(rdd.canMoveRow(1, 0)).toBe(false);
  });

  it('"Move to top" lands below the group header, at the top of the group', async () => {
    const { grid, rows } = await mountGrouped(); // [G1] a c [G2] b

    openMenu(grid, 2); // c
    const top = menuItem('Move to top')!;
    expect(top.disabled).toBe(false);
    top.click();
    await waitUpgrade(grid);

    expect(grid.sourceRows).toEqual([rows[2], rows[0], rows[1]]);
  });

  it('reports and persists a debounced keyboard move in source order, without group rows', async () => {
    const { grid, rdd, rows } = await mountGrouped();
    const moves: RowMoveDetail[] = [];
    grid.addEventListener('row-move', (e) => moves.push((e as CustomEvent<RowMoveDetail>).detail));
    grid._focusRow = 2;

    expect(rdd.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true }))).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await waitUpgrade(grid);

    expect(moves[0].rows).toEqual([rows[2], rows[0], rows[1]]);
    expect(grid.sourceRows).toEqual([rows[2], rows[0], rows[1]]);
  });
});
