# API reference docs: TypeDoc, JSDoc, `@category` / `@group`

Read from the `docs-update` skill when public API, JSDoc, or adapter exports change.

## Regenerating API Docs

When public API changes (new exports, changed signatures, updated JSDoc):

```bash
# Generate TypeDoc JSON and convert to MDX
bun nx typedoc grid
bun nx typedoc grid-angular
bun nx typedoc grid-react
bun nx typedoc grid-vue
```

Output goes to `libs/*/docs/api/` (MDX pages) and `libs/*/docs/api-generated/api.json`.

**Do NOT hand-edit** files in `docs/api/` or `docs/api-generated/` — they are regenerated.

## Writing Good JSDoc

JSDoc comments feed into TypeDoc API docs:

````typescript
/**
 * Configuration for the grid component.
 *
 * @example
 * ```typescript
 * const config: GridConfig = {
 *   columns: [{ field: 'name', header: 'Name' }],
 * };
 * ```
 *
 * @remarks
 * The config is merged with defaults via `mergeEffectiveConfig()`.
 *
 * @see {@link ColumnConfig} for column-level options
 */
export interface GridConfig { ... }
````

**Key tags:**

- `@example` — Code examples (rendered in docs)
- `@remarks` — Extended description
- `@see` — Cross-references
- `@deprecated` — Mark deprecated APIs with migration info
- `@internal` — Exclude from public API docs
- `@since` — Version when feature was added
- `@category` — Routes exports to different TypeDoc sidebar sections (grid core only, see below)
- `@group` — Organizes class members into subsection headings within a page (see below)
- `@fires` — Documents events emitted by a method; collected into Events tables

## `@category` and `@group` — Controlling API Doc Output

The `typedoc-to-mdx.ts` scripts convert TypeDoc JSON into MDX pages. Two JSDoc tags control **where** and **how** exports appear.

> `@category` and `@group` are only processed by the **grid core** script (`libs/grid/scripts/typedoc-to-mdx.ts`). Adapter scripts use hard-coded name lists instead (see below).

### `@category` — API Doc Routing (Grid Core)

Add `@category` to **top-level exports** in `types.ts`, `constants.ts`, or `grid.ts` to control which API docs section they land in. The routing logic lives in `processCoreModule()`:

- `@category Plugin Development` → `Grid/API/Plugin Development/{Kind}/{Name}`
- `@category Framework Adapters` → `Grid/API/Framework Adapters/{Kind}/{Name}`
- Any other value or no `@category` → `Grid/API/Core/{Kind}/{Name}`

Only `Plugin Development` and `Framework Adapters` cause routing changes. Other values (e.g., `Data Management`, `Events`) are informational — they still route to `Core`. Check `processCoreModule()` in `libs/grid/scripts/typedoc-to-mdx.ts` for the current routing logic.

**DataGridElement split**: The `DataGridElement` class is special-cased by `genDataGridSplit()` — it produces **3 separate MDX documents** by filtering members:

- **Public API** (`DataGridElement.mdx`) — members without `_` prefix, without `@internal`, without `@category Framework Adapters`
- **Plugin API** (`DataGridElement-PluginAPI.mdx`) — `_`-prefixed members (not `__`) or `@internal Plugin API`
- **Framework Adapters** (`DataGridElement-Adapters.mdx`) — members tagged `@category Framework Adapters`

When adding a new member to `DataGridElement`, choose the right tag/prefix to place it in the correct document.

### `@group` — Section Headings Within a Page

Add `@group GroupName` to **class members** (accessors, methods) to organize them under headings within a generated MDX page. Currently used on `DataGridElement` members. The `genMembersSectionByGroup()` function renders groups in a defined order — check the `groupOrder` array in that function for the current list. Members without `@group` fall into a generic section at the end.

When adding a new member, use an existing `@group` value if it fits. If no group fits, create a new one — it will be appended after the ordered groups. If the new group should appear in a specific position, add it to the `groupOrder` array in `genMembersSectionByGroup()`.

### `@internal` Modifier — Visibility Control

- `@internal` alone → excluded from all generated docs
- `@internal Plugin API` → included only in the Plugin API document
- `_` prefix (without `@internal`) → same as `@internal Plugin API` by convention
- `__` prefix → excluded from all docs (deeply internal)

### Adapter Scripts — Hard-Coded Categorization

Adapter scripts (`libs/grid-{angular,react,vue}/scripts/typedoc-to-mdx.ts`) do **NOT** use `@category`. They categorize by checking export names against hard-coded lists (e.g., `isDirective()` checks a `directiveNames` array in Angular). Each adapter sorts into folders like `Directives/`, `Components/`, `Hooks/`, `Types/`, `Utilities/`, etc.

**When adding a new export to an adapter**: check the script's categorization functions. If your export doesn't match an existing check (e.g., a new Angular directive), add its name to the corresponding list so it lands in the right folder instead of the catch-all `Utilities/`. After updating the categorization list, run `bun nx typedoc grid-<adapter>` (e.g., `bun nx typedoc grid-angular`) to regenerate the adapter API MDX pages.

Adapter `export const` values (components built with `forwardRef`/`memo`, injection tokens, constant maps) are emitted by TypeDoc as **variables** and are rendered by `genVariable()` in `tools/typedoc-mdx-shared.ts`. Vue SFCs (`.vue`) cannot be parsed by TypeDoc at all — they are excluded from `libs/grid-vue/src/typedoc-entry.ts` and documented by hand in `apps/docs/src/content/docs/grid/vue/components.mdx`. When you add a Vue component, update that page; when you add a Vue `.ts` export, add it to `typedoc-entry.ts` as well as `index.ts`.
