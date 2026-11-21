/**
 * Tree row moves for the `rows:resolve-move` query (#663).
 *
 * Pure: the plugin supplies lookups over its current row metadata, this module
 * computes the new source tree. Nothing is mutated — every ancestor whose
 * children change is shallow-copied (copy-on-write); the moved rows and every
 * untouched subtree keep their identity.
 */
import type { RowMoveQuery, RowMoveResolution, RowMoveStep } from '../shared/row-move';
import type { FlattenedTreeRow, TreeConfig, TreeRow } from './types';

/** Read access to the plugin's state for the rows currently rendered. */
export interface TreeMoveContext {
  /** Top-level source rows. */
  roots: TreeRow[];
  childrenField: string;
  /** Metadata of a rendered row (every move source/target is rendered). */
  metaOf: (row: unknown) => FlattenedTreeRow | undefined;
  /** Metadata by node key — resolves `parentKey` chains. */
  metaByKey: (key: string) => FlattenedTreeRow | undefined;
  canReparent?: TreeConfig['canReparent'];
  /** Whether a row's children were ever loaded or embedded — an emptied list is still a folder. */
  wasParent: (row: TreeRow) => boolean;
  /** Position of a rendered row in the displayed rows — orders keyboard steps as the user sees them. */
  orderOf: (row: unknown) => number | undefined;
  /** Called for each ancestor copy, so the plugin can carry its per-row state over. */
  onCopy: (original: TreeRow, copy: TreeRow) => void;
}

interface Listed {
  meta: FlattenedTreeRow;
  parent: TreeRow | null;
  siblings: TreeRow[];
}

interface Located extends Listed {
  index: number;
}

/** A rendered row's parent (`null` = top level) and the sibling list holding it. */
function listOf(ctx: TreeMoveContext, row: unknown): Listed | null {
  const meta = ctx.metaOf(row);
  if (!meta) return null;
  const parent = meta.parentKey === null ? null : ctx.metaByKey(meta.parentKey)?.data;
  if (parent === undefined) return null;
  const siblings = parent ? parent[ctx.childrenField] : ctx.roots;
  return Array.isArray(siblings) ? { meta, parent, siblings: siblings as TreeRow[] } : null;
}

function locate(ctx: TreeMoveContext, row: unknown): Located | null {
  const listed = listOf(ctx, row);
  const index = listed ? listed.siblings.indexOf(row as TreeRow) : -1;
  return listed && index >= 0 ? { ...listed, index } : null;
}

/** Add `parent` and all of its ancestors to `path`. */
function addPath(ctx: TreeMoveContext, parent: TreeRow | null, path: Set<unknown>): void {
  let meta = parent ? ctx.metaOf(parent) : undefined;
  while (meta) {
    path.add(meta.data);
    meta = meta.parentKey === null ? undefined : ctx.metaByKey(meta.parentKey);
  }
}

/**
 * New roots with each edited parent's (`null` = top level) children replaced,
 * copying the ancestors on `path`. `null` when an edited parent is not reachable
 * from `ctx.roots` (e.g. ServerSide owns the roots, `sourceRows` is empty).
 */
function rebuild(ctx: TreeMoveContext, edits: Map<TreeRow | null, TreeRow[]>, path: Set<unknown>): TreeRow[] | null {
  const field = ctx.childrenField;
  const unreached = new Set(edits.keys());
  const walk = (list: TreeRow[], parent: TreeRow | null): TreeRow[] => {
    unreached.delete(parent);
    return (edits.get(parent) ?? list).map((node) => {
      const children = node[field];
      if (!path.has(node) || !Array.isArray(children)) return node;
      const copy = { ...node, [field]: walk(children as TreeRow[], node) };
      ctx.onCopy(node, copy);
      return copy;
    });
  };
  const roots = walk(ctx.roots, null);
  return unreached.size ? null : roots;
}

/**
 * `rows` without any row that sits inside another listed row's subtree — that
 * row carries it (a multi-row selection can hold both a parent and its child).
 */
function outermost(rows: unknown[], childrenField: string): unknown[] {
  const nested = new Set<unknown>();
  const collect = (row: unknown) => {
    const children = (row as TreeRow | null)?.[childrenField];
    if (!Array.isArray(children)) return;
    for (const child of children) {
      if (nested.has(child)) continue;
      nested.add(child);
      collect(child);
    }
  };
  rows.forEach(collect);
  return rows.filter((row) => !nested.has(row));
}

function remove(ctx: TreeMoveContext, rows: unknown[]): RowMoveResolution | false {
  // Group by parent first, then filter each sibling list ONCE — linear in a large selection.
  const byParent = new Map<TreeRow | null, { siblings: TreeRow[]; gone: Set<unknown> }>();
  for (const row of rows) {
    const listed = listOf(ctx, row);
    // Not placeable in `ctx.roots` (e.g. ServerSide owns the roots): the flat fallback would remove nothing.
    if (!listed) return false;
    let group = byParent.get(listed.parent);
    if (!group) byParent.set(listed.parent, (group = { siblings: listed.siblings, gone: new Set<unknown>() }));
    group.gone.add(row);
  }
  const edits = new Map<TreeRow | null, TreeRow[]>();
  const path = new Set<unknown>();
  for (const [parent, { siblings, gone }] of byParent) {
    const kept = siblings.filter((r) => !gone.has(r));
    if (siblings.length - kept.length < gone.size) return false; // a row is not among its parent's children
    edits.set(parent, kept);
    addPath(ctx, parent, path);
  }
  const next = rebuild(ctx, edits, path);
  return next ? { rows: next } : false;
}

/** The sibling a keyboard / move-menu `step` lands next to — among the DISPLAYED siblings, in display order. */
function stepTarget(ctx: TreeMoveContext, from: Located, step: RowMoveStep): TreeRow | undefined {
  // Filtered-out siblings are not rendered, and grouping can reorder the rendered ones.
  const shown = from.siblings
    .filter((s) => ctx.orderOf(s) !== undefined)
    .sort((a, b) => (ctx.orderOf(a) ?? 0) - (ctx.orderOf(b) ?? 0));
  if (step === 'first') return shown[0];
  if (step === 'last') return shown[shown.length - 1];
  return shown[shown.indexOf(from.siblings[from.index]) + step];
}

/** Rows from another grid land at the top level, next to the target's top-level ancestor. */
function insert(ctx: TreeMoveContext, rows: unknown[], target: unknown, after: boolean): RowMoveResolution {
  let anchor = target == null ? undefined : ctx.metaOf(target);
  // Dropped among a node's descendants → after that whole top-level subtree.
  if (anchor && anchor.parentKey !== null) after = true;
  while (anchor && anchor.parentKey !== null) anchor = ctx.metaByKey(anchor.parentKey);
  const next = [...ctx.roots];
  // No metadata (flat data): the target is itself a root.
  const at = anchor ? next.indexOf(anchor.data) : target == null ? -1 : next.indexOf(target as TreeRow);
  next.splice(at < 0 ? next.length : at + (after ? 1 : 0), 0, ...(rows as TreeRow[]));
  return { rows: next };
}

/**
 * The children a row dropped just below `meta`'s node lands on top of — an expanded parent's.
 * `null` = beside the node instead; `false` = refused (children still loading: no list to land in).
 */
function openChildren(
  ctx: TreeMoveContext,
  row: TreeRow,
  fromParent: TreeRow | null,
  meta: FlattenedTreeRow,
): TreeRow[] | null | false {
  if (!meta.isExpanded) return null;
  const node = meta.data;
  const children = node[ctx.childrenField];
  if (!Array.isArray(children)) return meta.hasChildren ? false : null;
  if (children.length > 0) return children as TreeRow[];
  // Empty: a folder if it ever had children (lazy load came back empty, or all moved out — #670).
  // Identity, not the expanded key: a leaf's `children: []` can inherit a reused path key.
  if (!meta.hasChildren && !ctx.wasParent(node)) return null;
  // Nothing below it to drop between, so a row that may not enter lands beside it, as on a leaf.
  const path = new Set<unknown>();
  addPath(ctx, node, path);
  return !path.has(row) && ctx.canReparent?.(row, node, fromParent) ? (children as TreeRow[]) : null;
}

function move(ctx: TreeMoveContext, q: Extract<RowMoveQuery, { op: 'move' }>): RowMoveResolution | false {
  const row = q.row as TreeRow;
  const from = locate(ctx, row);
  if (!from) return false;

  let toParent: TreeRow | null;
  let toList: TreeRow[];
  /** Insert position in `toList` as it is now (still holding `row` when it is `from.siblings`). */
  let insertAt: number;
  if (q.step !== undefined) {
    // Keyboard / move menu: always among the siblings the user can see.
    const dest = stepTarget(ctx, from, q.step);
    if (dest === undefined || dest === row) return false;
    toParent = from.parent;
    toList = from.siblings;
    const at = from.siblings.indexOf(dest);
    insertAt = q.step === 'first' || q.step === -1 ? at : at + 1;
  } else if (q.target === null) {
    // Dropped below every row: the end of the top level.
    toParent = null;
    toList = ctx.roots;
    insertAt = ctx.roots.length;
  } else {
    const target = locate(ctx, q.target);
    if (!target) return false;
    const open = q.position === 'after' ? openChildren(ctx, row, from.parent, target.meta) : null;
    if (open === false) return false;
    if (open) {
      // Just below an open parent is the slot above its first child.
      toParent = q.target as TreeRow;
      toList = open;
      insertAt = 0;
    } else {
      toParent = target.parent;
      toList = target.siblings;
      insertAt = target.index + (q.position === 'after' ? 1 : 0);
    }
  }

  const path = new Set<unknown>();
  addPath(ctx, toParent, path);
  if (path.has(row)) return false; // into its own subtree
  if (toParent !== from.parent && !ctx.canReparent?.(row, toParent, from.parent)) return false;
  addPath(ctx, from.parent, path);

  const edits = new Map<TreeRow | null, TreeRow[]>();
  const fromList = from.siblings.filter((r) => r !== row);
  let toIndex: number;
  if (toParent === from.parent) {
    toIndex = insertAt > from.index ? insertAt - 1 : insertAt;
    if (toIndex === from.index) return false;
    fromList.splice(toIndex, 0, row);
    edits.set(from.parent, fromList);
  } else {
    const toNext = [...toList];
    toNext.splice(insertAt, 0, row);
    toIndex = insertAt;
    edits.set(from.parent, fromList);
    edits.set(toParent, toNext);
  }
  const rows = rebuild(ctx, edits, path);
  if (!rows) return false;
  return { rows, fromParent: from.parent, toParent, fromIndex: from.index, toIndex };
}

/**
 * Answer a `rows:resolve-move` query against the rendered tree.
 * `false` = not allowed, `undefined` = nothing to do here (fall back).
 */
export function resolveTreeMove(ctx: TreeMoveContext, q: RowMoveQuery): RowMoveResolution | false | undefined {
  if (q.op === 'pick') return { rows: outermost(q.rows, ctx.childrenField) };
  if (q.op === 'remove') return remove(ctx, q.rows);
  if (q.op === 'insert') return insert(ctx, q.rows, q.target, q.position === 'after');
  return move(ctx, q);
}
