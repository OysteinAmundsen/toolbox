---
domain: grid-plugins-hierarchy
related: [grid-plugins, grid-plugins-catalog-data, grid-data-pipeline, a11y]
---

# Plugin Catalog — Row Hierarchy (Hierarchy, Tree, GroupingRows)

> Plugin system (manager, lifecycle, `PluginDependency.provide`) → grid-plugins.md. ServerSide (feeds Tree/GroupingRows via `datasource:*`), Pivot, row-identity rule → grid-plugins-catalog-data.md. Treegrid ARIA conventions → a11y.md.
> Read order for "tree/group rows wrong": Hierarchy contract → the contributor's section → data-flow-traces.md (tree expand).

## Hierarchy (#504)

OWNS: the row model shared by contributors (`plugins/hierarchy/`): pre-order flatten, `#meta: WeakMap<row,{level,setSize,posInSet}>`, `.rows-body` `role` `grid`↔`treegrid`, per-row `aria-level/setsize/posinset`. HOOKS: afterRender + onScrollRender (rows found via `RowElementInternal.__rowDataRef`). No config, no processRows hook. CONTRACT (`HierarchyContributor`): `hierarchyStage` `'structure'` (Tree) runs before `'transform'` (GroupingRows) on every natural sibling list; `beginHierarchy(rows)→false` sits out; `processSiblings(nodes,{parent,parentKey,depth})`; `endHierarchy(rows, positionOf)`.

- DECIDED (#504): contributors KEEP `processRows` and forward to `hierarchy.process(rows, this)`; only the LAST contributor in processRows-priority order builds the model for all, earlier ones pass rows through. No hierarchy attached (mock-grid specs) → fallback `buildHierarchy(rows,[this])`. WHY: zero churn in ~94 `plugin.processRows()` spec call sites; hook position (10, after ServerSide) unchanged. Expansion state/events/API stay in each contributor (accordion, lazy load, pending expansion are their expertise). Tests: `hierarchy.spec.ts`, `hierarchy-integration.spec.ts`.
- INVARIANT: `HierarchyNode.shaped:true` = children are final (group members), NOT re-run through contributors; omitted = natural list (tree children) every contributor reshapes. Members keep Tree-assigned natural children.
- INVARIANT: depth is STRUCTURAL in combination (groupOn `context.depth`, `__groupDepth`, `GroupRowModelItem.depth`, accordion predicate, Tree `FlattenedTreeRow.depth` via `positionOf` in `endHierarchy`). Standalone values unchanged. Nested group keys = `${parentTreeKey}::${composite}`; root keys unchanged.
- INVARIANT: hard dep auto-attached via `PluginDependency.provide`. Tree↔GroupingRows incompatibility REMOVED. Treegrid ARIA (#264) moved here from Tree/GroupingRows: writes compare-before-write (`setAttrIfChanged`); onScrollRender also covers rows scrolled into view. `posInSet`/`setSize` are 1-based PER PARENT list.
- INVARIANT (perf): `buildHierarchy` appends into ONE `out` array — never return/spread child arrays (wide expanded nodes exceed the JS argument limit). Bench (pure Tree flatten): `tree-data.bench.ts`.
- TENSION: Tree `getFlattenedRows()`/`datasource:viewport-mapping` hold tree rows only — index-aligned with `grid.rows` standalone, NOT when group rows interleave; Tree `afterRender`/`onKeyDown` therefore look rows up by identity. Aggregators over a group of tree rows see direct members, not leaves.

## Tree

OWNS: expanded keys, flattened rows, `rowKeyMap`, `#rowMeta` `WeakMap<row,FlattenedTreeRow>`, `#rowKeys` `WeakMap<row,string>`, animation state, `loadingKeys`/`loadedKeys`, `#childRequests: Map<key,AbortController>`. Contributor stage `structure`: sorts each sibling list, attaches expanded children.
HOOKS: processRows(10, forwards), processColumns, afterCellRender, afterRender, onCellClick, onHeaderClick, renderRow, getRowHeight, adjustVirtualStart.
QUERIES: `canMoveRow`, `datasource:viewport-mapping`, `sort:get-model`. EVENTS: `tree-expand`, `tree-load-start|end|error`. FIRES: `datasource:fetch-children`. LISTENS: `datasource:children|error` (filtered on `context.source === 'tree'`).

- DECIDED (v3.4.0, lazy loading): two routes, ServerSide wins. `requestLazyChildren` checks `datasource:is-active` **via `queryBoolean`** (#430 — raw `query()` returns a truthy `[]`). Else `TreeConfig.loadChildren` (Promise or `Subscribable`, per-request `AbortController`, aborted on `detach()`). `Subscribable` is **take-one** — `finish()` removes the controller `detach()` would abort; a `settled` flag covers synchronous emission. Ref: `TreePlugin.#loadChildrenLocally`, `tree-integration.spec.ts`.
- INVARIANT (#430): `detectTreeStructure(rows, childrenField, hasChildren)` MUST receive `config.hasChildren` (predicate-only lazy trees have no `children` field), else detection returns false. File: [tree-detect.ts](libs/grid/src/lib/plugins/tree/tree-detect.ts).
- INVARIANT: lazy children are signalled by a truthy non-array `childrenField` or a `TreeConfig.hasChildren` predicate; single-batch (no pagination). `loadedKeys` (NOT `row[childrenField].length`) gates re-fetch; fetched at most once per attach, errors do NOT mark loaded. `datasource:error` MUST be handled — else the key stays in `loadingKeys` forever and retries short-circuit.
- INVARIANT: loading UI reuses core `createDefaultSpinner('small')` (+ `.tree-loading` sizing in `@layer tbw-plugins`). `afterRender` sets AND removes `aria-busy` (explicit negative branch). Tree owns `aria-expanded` / `aria-busy` / `.tbw-row-expanded` (unguarded writes — extend the guard before adding per-frame writes).
- INVARIANT (async rows): `processColumns` is a no-op while `flattenedRows` is empty, and a ROWS-only render never re-runs COLUMNS — so rows arriving asynchronously (`grid.rows = …` after `ready()`, or a ServerSide block) would leave the tree column undecorated. `beginHierarchy` (inactive branch) and `endHierarchy` call `#syncTreeColumn()`, which microtask-defers a `#treeColumnWrapped !== flattenedRows.length > 0` check and `requestColumnsRender()`s on mismatch.
- INVARIANT: `_schedulerMergeConfig` reseeds `#baseColumns` from `_columns`, so a plugin-installed `viewRenderer` is **already baked in** by the time `processColumns` runs — columns handed to a plugin are NOT pristine. To un-decorate, the plugin MUST actively restore `originalTreeColumnRenderer` (dropping the cache alone leaks the wrapper, and re-wrapping nests it).

## GroupingRows

OWNS: grouped row model, expanded keys, animation state. Contributor stage `transform`: groups each natural sibling list (`groupOn(row, {parent, depth})`; all-null list = ungrouped). HOOKS: processRows(10, forwards), onHeaderClick(-1), renderRow. QUERIES: `canMoveRow`, `grouping:get-grouped-fields`, `datasource:viewport-mapping`. EVENTS: `group-toggle|expand|collapse`.

- DECIDED (#504): reuse the pure flat builders (`buildGroupedRowModel` + `keyPrefix`/`context`, `buildPreDefinedGroupModel`) and re-nest their visible flat output into `HierarchyNode`s (`#nest`), recording each row's `RenderRow` in `#renderItems` so `getFlattenedRows()` is identical standalone. Pre-defined mode replaces the ROOT list only. `accordion: boolean | (depth) => boolean`. `defaultExpanded: true` also opens each nested list's new top-level groups (`#seenNestedKeys`).
- DECIDED (#335, deferred expansion): `setGroupOn(fn, expanded?)` takes `DefaultExpandedValue: boolean|number|string|string[]` seeding expansion against the NEW group set on the next rebuild (sets `groupConfigDirty`); `expandAll`/`collapseAll` called right after it ALSO defer via `pendingExpansion`. `beginHierarchy` snapshots+clears `pendingExpansion`, the root list resolves it against fresh `getGroupKeys(initialBuild)`, `endHierarchy` broadcasts `group-toggle` once.
- INVARIANT: bulk `group-toggle` emissions MUST use `broadcast<GroupToggleDetail>`, not `emitPluginEvent`. `GroupToggleDetail.{key,expanded,value,depth}` are optional (bulk carries only `expandedKeys`).
