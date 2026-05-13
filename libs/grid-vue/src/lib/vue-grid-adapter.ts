import type {
  ColumnConfig as BaseColumnConfig,
  GridConfig as BaseGridConfig,
  TypeDefault as BaseTypeDefault,
  CellRenderContext,
  ColumnEditorContext,
  ColumnEditorSpec,
  ColumnViewRenderer,
  EmptyContext,
  FrameworkAdapter,
  HeaderCellContext,
  HeaderLabelContext,
  LoadingContext,
} from '@toolbox-web/grid';
import { createVNode, type Component, type VNode } from 'vue';
import { notifyEditorMounted, registerEditorMountHook, type EditorMountHook } from './editor-mount-hooks';
import type { TypeDefault, TypeDefaultsMap } from './grid-type-registry';
import { removeFromContainer, renderToContainer } from './teleport-bridge';
import { getToolPanelRenderer, type ToolPanelContext } from './tool-panel-registry';
import type { ColumnConfig, GridConfig } from './vue-column-config';
export type { GridConfig };

// Re-export so feature secondary entries can install editor-mount hooks
// via `import { registerEditorMountHook } from '@toolbox-web/grid-vue'`.
export { registerEditorMountHook, type EditorMountHook };

// #region Feature bridge registries

/**
 * Context handed to feature bridge installers so they can hook the adapter's
 * teleport lifecycle without depending on its private fields.
 * @internal
 */
export interface FeatureBridgeContext {
  /** Track a teleport key for cleanup on adapter cleanup(). */
  trackTeleportKey(key: string): void;
}

/**
 * Installer signature: given a grid element + bridge context, returns the
 * row-renderer the adapter should expose, or undefined if no Vue template
 * is registered for that grid.
 * @internal
 */
export type RowRendererBridge = <TRow = unknown>(
  gridEl: HTMLElement,
  ctx: FeatureBridgeContext,
) => ((row: TRow, rowIndex: number) => HTMLElement) | undefined;

/**
 * Installer signature for the type-default `filterPanelRenderer` wrapper.
 * Receives the user's Vue render function (typed loosely as `unknown` so
 * the adapter does not depend on filtering types) and returns the imperative
 * `(container, params) => void` form required by the core grid.
 * @internal
 */
export type FilterPanelTypeDefaultBridge = (
  renderFn: unknown,
  gridEl: HTMLElement | undefined,
  ctx: FeatureBridgeContext,
) => NonNullable<BaseTypeDefault['filterPanelRenderer']>;

let detailRendererBridge: RowRendererBridge | null = null;
let responsiveCardRendererBridge: RowRendererBridge | null = null;
let filterPanelTypeDefaultBridge: FilterPanelTypeDefaultBridge | null = null;

/**
 * Install the master-detail row-renderer bridge on the Vue adapter. Called
 * once on import by `@toolbox-web/grid-vue/features/master-detail`. Mirrors
 * how core grid plugins augment the grid via `registerPlugin()`.
 * @internal Plugin API
 */
export function registerDetailRendererBridge(bridge: RowRendererBridge): void {
  detailRendererBridge = bridge;
}

/**
 * Install the responsive card row-renderer bridge on the Vue adapter. Called
 * once on import by `@toolbox-web/grid-vue/features/responsive`.
 * @internal Plugin API
 */
export function registerResponsiveCardRendererBridge(bridge: RowRendererBridge): void {
  responsiveCardRendererBridge = bridge;
}

/**
 * Install the type-default `filterPanelRenderer` wrapper. Called once on
 * import by `@toolbox-web/grid-vue/features/filtering`. Without this bridge,
 * type-default and grid-config-level filterPanelRenderer entries are dropped
 * silently — filter panels only work if the filtering feature is also
 * imported, which is the same precondition as the FilteringPlugin itself
 * (TBW031).
 * @internal Plugin API
 */
export function registerFilterPanelTypeDefaultBridge(bridge: FilterPanelTypeDefaultBridge): void {
  filterPanelTypeDefaultBridge = bridge;
}

// #endregion

/**
 * Registry mapping column elements to their Vue render functions.
 * Each column element stores its renderer/editor functions here.
 */
interface ColumnRegistry {
  renderer?: (ctx: CellRenderContext<unknown, unknown>) => VNode;
  editor?: (ctx: ColumnEditorContext<unknown, unknown>) => VNode;
}

const columnRegistries = new WeakMap<HTMLElement, ColumnRegistry>();

// Secondary registry by field name to handle Vue component re-creation
const fieldRegistries = new Map<string, ColumnRegistry>();

/**
 * Register a Vue cell renderer for a column element.
 * Called by TbwGridColumn when it has a #cell slot.
 */
export function registerColumnRenderer(
  element: HTMLElement,
  renderer: (ctx: CellRenderContext<unknown, unknown>) => VNode,
): void {
  const field = element.getAttribute('field');

  const registry = columnRegistries.get(element) ?? {};
  registry.renderer = renderer;
  columnRegistries.set(element, registry);

  // Also register by field name for fallback lookup
  if (field) {
    const fieldRegistry = fieldRegistries.get(field) ?? {};
    fieldRegistry.renderer = renderer;
    fieldRegistries.set(field, fieldRegistry);
  }
}

/**
 * Register a Vue cell editor for a column element.
 * Called by TbwGridColumn when it has an #editor slot.
 */
export function registerColumnEditor(
  element: HTMLElement,
  editor: (ctx: ColumnEditorContext<unknown, unknown>) => VNode,
): void {
  const field = element.getAttribute('field');
  const registry = columnRegistries.get(element) ?? {};
  registry.editor = editor;
  columnRegistries.set(element, registry);

  // Also register by field name for fallback lookup
  if (field) {
    const fieldRegistry = fieldRegistries.get(field) ?? {};
    fieldRegistry.editor = editor;
    fieldRegistries.set(field, fieldRegistry);
  }
}

/**
 * Get the renderer registered for a column element.
 * Falls back to field-based lookup if WeakMap lookup fails.
 */
export function getColumnRenderer(
  element: HTMLElement,
): ((ctx: CellRenderContext<unknown, unknown>) => VNode) | undefined {
  let renderer = columnRegistries.get(element)?.renderer;

  // Fallback to field-based lookup for Vue component re-creation scenarios
  if (!renderer) {
    const field = element.getAttribute('field');
    if (field) {
      renderer = fieldRegistries.get(field)?.renderer;
    }
  }

  return renderer;
}

/**
 * Get the editor registered for a column element.
 * Falls back to field-based lookup if WeakMap lookup fails.
 */
export function getColumnEditor(
  element: HTMLElement,
): ((ctx: ColumnEditorContext<unknown, unknown>) => VNode) | undefined {
  let editor = columnRegistries.get(element)?.editor;

  // Fallback to field-based lookup for Vue component re-creation scenarios
  if (!editor) {
    const field = element.getAttribute('field');
    if (field) {
      editor = fieldRegistries.get(field)?.editor;
    }
  }

  return editor;
}

/**
 * Get all registered field names.
 * @internal - for testing only
 */
export function getRegisteredFields(): string[] {
  return Array.from(fieldRegistries.keys());
}

/**
 * Clear the field registries.
 * Called during adapter cleanup and in tests.
 * @internal
 */
export function clearFieldRegistries(): void {
  fieldRegistries.clear();
}

// #region Vue Component Detection

/**
 * Checks if a value is a Vue component (SFC or defineComponent result).
 *
 * Vue components are identified by:
 * - Having `__name` (SFC compiled marker)
 * - Having `setup` function (Composition API component)
 * - Having `render` function (Options API component)
 * - Being an ES6 class (class-based component)
 *
 * Regular functions `(ctx) => HTMLElement` that are already processed
 * will not match these checks, making this idempotent.
 * @since 0.3.1
 */
export function isVueComponent(value: unknown): value is Component {
  if (value == null) return false;

  // Already a DOM-returning function (processed) — skip
  if (typeof value === 'function' && value.prototype === undefined) {
    // Plain arrow/function — could be a VNode-returning render fn OR
    // an already-processed DOM-returning fn. We can't distinguish at runtime,
    // so we check if it looks like a Vue component (has component markers).
    // Plain functions without component markers are treated as VNode-returning.
    return false;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // SFC compiled marker
    if ('__name' in obj) return true;
    // Composition API
    if (typeof obj['setup'] === 'function') return true;
    // Options API
    if (typeof obj['render'] === 'function') return true;
  }

  if (typeof value === 'function') {
    // ES6 class-based component
    const fnString = Function.prototype.toString.call(value);
    if (fnString.startsWith('class ') || fnString.startsWith('class{')) return true;

    // defineComponent returns a function with component markers
    const fn = value as unknown as Record<string, unknown>;
    if ('__name' in fn || typeof fn['setup'] === 'function') return true;
  }

  return false;
}

/**
 * Checks if a value is a VNode-returning render function.
 * These are plain functions (not component objects) that return VNodes.
 * They need wrapping to produce HTMLElements for the grid core.
 */
function isVNodeRenderFunction(value: unknown): value is (...args: unknown[]) => VNode {
  return typeof value === 'function' && !isVueComponent(value);
}

/**
 * Symbol used to mark renderer/editor functions that have already been
 * processed by the adapter (i.e., wrapped from VNode/Component → DOM).
 * Prevents double-wrapping when `processGridConfig` is called multiple times.
 */
const PROCESSED_MARKER = Symbol.for('tbw:vue-processed');

/**
 * Creates a teleport host `<div>` with the given class name and `display:contents`
 * so it is layout-transparent inside the grid cell. Used by all `createConfig*`
 * helpers and `createRenderer` / `createEditor` to avoid repeating the
 * three-line boilerplate.
 * @internal
 */
function createTeleportContainer(className: string): HTMLDivElement {
  const container = document.createElement('div');
  container.className = className;
  container.style.display = 'contents';
  return container;
}

/**
 * Returns a function that, when invoked, blurs the focused input/textarea/select
 * inside `container` (if any).
 *
 * Re-exported here for backwards compatibility with consumers that imported
 * `makeFlushFocusedInput` from this module before it moved to
 * `./editor-mount-hooks`.
 * @internal
 * @deprecated Import from `./editor-mount-hooks` instead. Kept as a
 * private re-export to avoid breaking internal callers; will be removed in
 * a future refactor.
 */
export { makeFlushFocusedInput } from './editor-mount-hooks';

// #endregion

/**
 * Cache for cell containers and their teleport keys.
 */
interface CellTeleportCache {
  container: HTMLElement;
  teleportKey: string;
  update: (ctx: CellRenderContext<unknown, unknown>) => void;
}

/**
 * Framework adapter that enables Vue 3 component integration
 * with the grid's light DOM configuration API.
 *
 * ## Usage
 *
 * The adapter is automatically registered when using the TbwGrid component.
 * For advanced use cases, you can manually register:
 *
 * ```ts
 * import { GridElement } from '@toolbox-web/grid';
 * import { GridAdapter } from '@toolbox-web/grid-vue';
 *
 * // One-time registration
 * GridElement.registerAdapter(new GridAdapter());
 * ```
 *
 * ## Declarative usage with TbwGrid:
 *
 * ```vue
 * <TbwGrid :rows="data" :grid-config="config">
 *   <TbwGridColumn field="status">
 *     <template #cell="{ value, row }">
 *       <StatusBadge :value="value" />
 *     </template>
 *   </TbwGridColumn>
 * </TbwGrid>
 * ```
 * @since 0.3.0
 */
export class GridAdapter implements FrameworkAdapter {
  /** Teleport keys tracked for cleanup. */
  private teleportKeys: string[] = [];
  /** Editor-specific teleport keys tracked separately for per-cell cleanup. */
  private editorTeleportKeys: Map<HTMLElement, string> = new Map();
  /**
   * Stable bridge context handed to feature installers. Bound once per
   * adapter so feature bridges can call `trackTeleportKey` without each
   * invocation creating a fresh closure.
   */
  private readonly bridgeContext: FeatureBridgeContext = {
    trackTeleportKey: (key) => {
      this.teleportKeys.push(key);
    },
  };
  /**
   * Per-editor `before-edit-close` listener teardown functions, keyed by
   * editor container.
   *
   * The grid's editing plugin emits `before-edit-close` on the host `<tbw-grid>`
   * before tearing down a row's managed editors. Vue editors commonly write
   * `@blur="commit"` to flush local state on click-away, but Tab / programmatic
   * row exit rebuilds the cell DOM synchronously without giving the focused
   * input a chance to fire `blur` first — so the `@blur` handler never runs
   * and pending input is lost.
   *
   * To bridge that gap we call native `.blur()` on the focused input inside
   * the editor container as soon as `before-edit-close` fires. `.blur()`
   * dispatches the full focus-loss chain (`blur` + `focusout`) so any editor
   * with `@blur="commit"` flushes before the cell DOM is torn down.
   *
   * Mirrors the React adapter's `editorBeforeCloseUnsubs` and the Angular
   * adapter's `BaseGridEditor.onBeforeEditClose()` hook.
   */
  private editorBeforeCloseUnsubs: Map<HTMLElement, () => void> = new Map();
  private typeDefaults: TypeDefaultsMap | null = null;

  // #region Config Processing

  /**
   * Processes a Vue grid configuration, converting Vue component references
   * and VNode-returning render functions to DOM-returning functions.
   *
   * This is idempotent — already-processed configs pass through safely.
   *
   * @example
   * ```ts
   * import { GridAdapter, type GridConfig } from '@toolbox-web/grid-vue';
   * import StatusBadge from './StatusBadge.vue';
   *
   * const config: GridConfig<Employee> = {
   *   columns: [
   *     { field: 'status', renderer: StatusBadge },
   *   ],
   * };
   *
   * const adapter = new GridAdapter();
   * const processedConfig = adapter.processGridConfig(config);
   * ```
   *
   * @param config - Vue grid config with possible component/VNode references
   * @returns Processed config with DOM-returning functions
   */
  processGridConfig<TRow = unknown>(config: GridConfig<TRow>): BaseGridConfig<TRow> {
    return this.processConfig(config as BaseGridConfig<TRow>);
  }

  /**
   * FrameworkAdapter.processConfig implementation.
   * Called automatically by the grid's `set gridConfig` setter.
   */
  processConfig<TRow = unknown>(config: BaseGridConfig<TRow>): BaseGridConfig<TRow> {
    // Cast to Vue's extended GridConfig since the config may contain
    // Vue component classes or VNode-returning functions at runtime
    const vueConfig = config as unknown as GridConfig<TRow>;
    const result = { ...vueConfig };

    // Process columns
    if (vueConfig.columns) {
      (result as BaseGridConfig<TRow>).columns = vueConfig.columns.map((col) => this.processColumn(col));
    }

    // Process typeDefaults
    if (vueConfig.typeDefaults) {
      result.typeDefaults = this.processTypeDefaults(vueConfig.typeDefaults as Record<string, TypeDefault>) as Record<
        string,
        BaseTypeDefault<TRow>
      >;
    }

    // Process loadingRenderer - convert Vue component/VNode to DOM-returning function
    if (vueConfig.loadingRenderer) {
      if (isVueComponent(vueConfig.loadingRenderer)) {
        (result as BaseGridConfig<TRow>).loadingRenderer = this.createComponentLoadingRenderer(
          vueConfig.loadingRenderer as unknown as Component,
        ) as unknown as BaseGridConfig<TRow>['loadingRenderer'];
      } else if (isVNodeRenderFunction(vueConfig.loadingRenderer)) {
        (result as BaseGridConfig<TRow>).loadingRenderer = this.createVNodeLoadingRenderer(
          vueConfig.loadingRenderer as unknown as (ctx: LoadingContext) => VNode,
        ) as unknown as BaseGridConfig<TRow>['loadingRenderer'];
      }
    }

    // Process emptyRenderer - convert Vue component/VNode to DOM-returning function.
    // `null` is a valid opt-out value (suppresses the built-in default message);
    // it short-circuits the `if (vueConfig.emptyRenderer)` branch and is
    // forwarded through `result` unchanged.
    if (vueConfig.emptyRenderer) {
      if (isVueComponent(vueConfig.emptyRenderer)) {
        (result as BaseGridConfig<TRow>).emptyRenderer = this.createComponentEmptyRenderer(
          vueConfig.emptyRenderer as unknown as Component,
        ) as unknown as BaseGridConfig<TRow>['emptyRenderer'];
      } else if (isVNodeRenderFunction(vueConfig.emptyRenderer)) {
        (result as BaseGridConfig<TRow>).emptyRenderer = this.createVNodeEmptyRenderer(
          vueConfig.emptyRenderer as unknown as (ctx: EmptyContext) => VNode,
        ) as unknown as BaseGridConfig<TRow>['emptyRenderer'];
      }
    }

    return result as BaseGridConfig<TRow>;
  }

  /**
   * Processes typeDefaults, converting Vue component/VNode references
   * to DOM-returning functions.
   *
   * @param typeDefaults - Vue type defaults with possible component references
   * @returns Processed TypeDefault record
   */
  processTypeDefaults<TRow = unknown>(
    typeDefaults: Record<string, TypeDefault<TRow>>,
  ): Record<string, BaseTypeDefault<TRow>> {
    const processed: Record<string, BaseTypeDefault<TRow>> = {};

    for (const [type, config] of Object.entries(typeDefaults)) {
      const processedConfig: BaseTypeDefault<TRow> = {
        editorParams: config.editorParams,
      };

      if (config.renderer) {
        if (isVueComponent(config.renderer)) {
          processedConfig.renderer = this.createConfigComponentRenderer(config.renderer as Component);
        } else if (isVNodeRenderFunction(config.renderer)) {
          processedConfig.renderer = this.createTypeRenderer(
            config.renderer as (ctx: CellRenderContext<TRow>) => VNode,
          );
        }
      }

      if (config.editor) {
        if (isVueComponent(config.editor)) {
          processedConfig.editor = this.createConfigComponentEditor(
            config.editor as Component,
          ) as BaseTypeDefault['editor'];
        } else if (isVNodeRenderFunction(config.editor)) {
          processedConfig.editor = this.createTypeEditor(
            config.editor as (ctx: ColumnEditorContext<TRow>) => VNode,
          ) as BaseTypeDefault['editor'];
        }
      }

      if (config.filterPanelRenderer && filterPanelTypeDefaultBridge) {
        processedConfig.filterPanelRenderer = filterPanelTypeDefaultBridge(
          config.filterPanelRenderer,
          undefined,
          this.bridgeContext,
        );
      }

      processed[type] = processedConfig;
    }

    return processed;
  }

  /**
   * Processes a single column configuration, converting Vue component references
   * and VNode-returning render functions to DOM-returning functions.
   *
   * @param column - Vue column config
   * @returns Processed ColumnConfig with DOM-returning functions
   */
  processColumn<TRow = unknown>(column: ColumnConfig<TRow>): BaseColumnConfig<TRow> {
    const processed = { ...column } as BaseColumnConfig<TRow>;

    if (column.renderer && !(column.renderer as unknown as Record<symbol, unknown>)[PROCESSED_MARKER]) {
      if (isVueComponent(column.renderer)) {
        const wrapped = this.createConfigComponentRenderer(column.renderer as Component);
        (wrapped as unknown as Record<symbol, unknown>)[PROCESSED_MARKER] = true;
        processed.renderer = wrapped as BaseColumnConfig<TRow>['renderer'];
      } else if (isVNodeRenderFunction(column.renderer)) {
        const wrapped = this.createConfigVNodeRenderer(column.renderer as (ctx: CellRenderContext<TRow>) => VNode);
        (wrapped as unknown as Record<symbol, unknown>)[PROCESSED_MARKER] = true;
        processed.renderer = wrapped as BaseColumnConfig<TRow>['renderer'];
      }
    }

    if (column.editor && !(column.editor as unknown as Record<symbol, unknown>)[PROCESSED_MARKER]) {
      if (isVueComponent(column.editor)) {
        const wrapped = this.createConfigComponentEditor(column.editor as Component);
        (wrapped as unknown as Record<symbol, unknown>)[PROCESSED_MARKER] = true;
        processed.editor = wrapped as BaseColumnConfig<TRow>['editor'];
      } else if (isVNodeRenderFunction(column.editor)) {
        const wrapped = this.createConfigVNodeEditor(column.editor as (ctx: ColumnEditorContext<TRow>) => VNode);
        (wrapped as unknown as Record<symbol, unknown>)[PROCESSED_MARKER] = true;
        processed.editor = wrapped as BaseColumnConfig<TRow>['editor'];
      }
    }

    if (column.headerRenderer && !(column.headerRenderer as unknown as Record<symbol, unknown>)[PROCESSED_MARKER]) {
      if (isVueComponent(column.headerRenderer)) {
        const wrapped = this.createConfigComponentHeaderRenderer(column.headerRenderer as Component);
        (wrapped as unknown as Record<symbol, unknown>)[PROCESSED_MARKER] = true;
        processed.headerRenderer = wrapped as any;
      } else if (isVNodeRenderFunction(column.headerRenderer)) {
        const wrapped = this.createConfigVNodeHeaderRenderer(
          column.headerRenderer as (ctx: HeaderCellContext<TRow>) => VNode,
        );
        (wrapped as unknown as Record<symbol, unknown>)[PROCESSED_MARKER] = true;
        processed.headerRenderer = wrapped as any;
      }
    }

    if (
      column.headerLabelRenderer &&
      !(column.headerLabelRenderer as unknown as Record<symbol, unknown>)[PROCESSED_MARKER]
    ) {
      if (isVueComponent(column.headerLabelRenderer)) {
        const wrapped = this.createConfigComponentHeaderLabelRenderer(column.headerLabelRenderer as Component);
        (wrapped as unknown as Record<symbol, unknown>)[PROCESSED_MARKER] = true;
        processed.headerLabelRenderer = wrapped as any;
      } else if (isVNodeRenderFunction(column.headerLabelRenderer)) {
        const wrapped = this.createConfigVNodeHeaderLabelRenderer(
          column.headerLabelRenderer as (ctx: HeaderLabelContext<TRow>) => VNode,
        );
        (wrapped as unknown as Record<symbol, unknown>)[PROCESSED_MARKER] = true;
        processed.headerLabelRenderer = wrapped as any;
      }
    }

    return processed;
  }

  /**
   * Creates a DOM-returning renderer from a Vue component class.
   * Used for config-based renderers (not slot-based).
   * @internal
   */
  private createConfigComponentRenderer<TRow = unknown, TValue = unknown>(
    component: Component,
  ): ColumnViewRenderer<TRow, TValue> {
    const cellCache = new WeakMap<HTMLElement, CellTeleportCache>();

    return (ctx: CellRenderContext<TRow, TValue>) => {
      const cellEl = (ctx as any).cellEl as HTMLElement | undefined;

      if (cellEl) {
        const cached = cellCache.get(cellEl);
        if (cached) {
          cached.update(ctx as CellRenderContext<unknown, unknown>);
          return cached.container;
        }

        const container = createTeleportContainer('vue-cell-renderer');

        let currentCtx = ctx as CellRenderContext<unknown, unknown>;
        const comp = component;

        const teleportKey = renderToContainer(container, createVNode(comp, { ...currentCtx }));

        cellCache.set(cellEl, {
          container,
          teleportKey,
          update: (newCtx) => {
            currentCtx = newCtx;
            renderToContainer(container, createVNode(comp, { ...currentCtx }), teleportKey);
          },
        });

        return container;
      }

      const container = createTeleportContainer('vue-cell-renderer');

      const comp = component;
      const teleportKey = renderToContainer(container, createVNode(comp, { ...ctx }));
      this.teleportKeys.push(teleportKey);

      return container;
    };
  }

  /**
   * Creates a DOM-returning renderer from a VNode-returning render function.
   * Used for config-based renderers (not slot-based).
   * @internal
   */
  private createConfigVNodeRenderer<TRow = unknown, TValue = unknown>(
    renderFn: (ctx: CellRenderContext<TRow, TValue>) => VNode,
  ): ColumnViewRenderer<TRow, TValue> {
    const cellCache = new WeakMap<HTMLElement, CellTeleportCache>();

    return (ctx: CellRenderContext<TRow, TValue>) => {
      const cellEl = (ctx as any).cellEl as HTMLElement | undefined;

      if (cellEl) {
        const cached = cellCache.get(cellEl);
        if (cached) {
          cached.update(ctx as CellRenderContext<unknown, unknown>);
          return cached.container;
        }

        const container = createTeleportContainer('vue-cell-renderer');

        let currentCtx = ctx as CellRenderContext<unknown, unknown>;

        const teleportKey = renderToContainer(container, renderFn(currentCtx as CellRenderContext<TRow, TValue>));

        cellCache.set(cellEl, {
          container,
          teleportKey,
          update: (newCtx) => {
            currentCtx = newCtx;
            renderToContainer(container, renderFn(currentCtx as CellRenderContext<TRow, TValue>), teleportKey);
          },
        });

        return container;
      }

      const container = createTeleportContainer('vue-cell-renderer');

      const teleportKey = renderToContainer(container, renderFn(ctx));
      this.teleportKeys.push(teleportKey);

      return container;
    };
  }

  /**
   * Schedules a microtask that runs all registered editor-mount hooks for
   * `container` once it's been appended to the cell DOM (so `closest('tbw-grid')`
   * resolves). Mirror of the same bridge inline in `createEditor` (slot path)
   * and the React adapter's `wrapReactEditor` / `createEditor`.
   *
   * Hooks are installed by feature secondary entries (e.g.
   * `@toolbox-web/grid-vue/features/editing` installs the `before-edit-close`
   * blur bridge). If no feature is imported, no hooks run — which matches
   * the corresponding plugin precondition (e.g. EditingPlugin requires the
   * editing feature import to even exist).
   * @internal
   */
  private attachBeforeEditCloseFlush(container: HTMLElement): void {
    queueMicrotask(() => {
      const gridEl = container.closest('tbw-grid') as HTMLElement | null;
      if (!gridEl) return;
      this.editorBeforeCloseUnsubs.set(container, notifyEditorMounted(container, gridEl));
    });
  }

  /**
   * Creates a DOM-returning editor from a Vue component class.
   * Used for config-based editors (not slot-based).
   * @internal
   */
  private createConfigComponentEditor<TRow = unknown, TValue = unknown>(
    component: Component,
  ): ColumnEditorSpec<TRow, TValue> {
    return (ctx: ColumnEditorContext<TRow, TValue>): HTMLElement => {
      const container = createTeleportContainer('vue-cell-editor');

      const comp = component;
      const teleportKey = renderToContainer(container, createVNode(comp, { ...ctx }));
      // Track for per-cell cleanup via releaseCell
      this.editorTeleportKeys.set(container, teleportKey);
      this.attachBeforeEditCloseFlush(container);

      return container;
    };
  }

  /**
   * Creates a DOM-returning editor from a VNode-returning render function.
   * Used for config-based editors (not slot-based).
   * @internal
   */
  private createConfigVNodeEditor<TRow = unknown, TValue = unknown>(
    renderFn: (ctx: ColumnEditorContext<TRow, TValue>) => VNode,
  ): ColumnEditorSpec<TRow, TValue> {
    return (ctx: ColumnEditorContext<TRow, TValue>): HTMLElement => {
      const container = createTeleportContainer('vue-cell-editor');

      const teleportKey = renderToContainer(container, renderFn(ctx));
      // Track for per-cell cleanup via releaseCell
      this.editorTeleportKeys.set(container, teleportKey);
      this.attachBeforeEditCloseFlush(container);

      return container;
    };
  }

  /**
   * Creates a DOM-returning header renderer from a Vue component class.
   * Used for config-based headerRenderer (not slot-based).
   * @internal
   */
  private createConfigComponentHeaderRenderer<TRow = unknown>(
    component: Component,
  ): (ctx: HeaderCellContext<TRow>) => HTMLElement {
    return (ctx: HeaderCellContext<TRow>) => {
      const container = createTeleportContainer('vue-header-renderer');

      const comp = component;
      const teleportKey = renderToContainer(
        container,
        createVNode(comp, {
          column: ctx.column,
          value: ctx.value,
          sortState: ctx.sortState,
          filterActive: ctx.filterActive,
          renderSortIcon: ctx.renderSortIcon,
          renderFilterButton: ctx.renderFilterButton,
        }),
      );
      this.teleportKeys.push(teleportKey);

      return container;
    };
  }

  /**
   * Creates a DOM-returning header renderer from a VNode-returning render function.
   * Used for config-based headerRenderer (not slot-based).
   * @internal
   */
  private createConfigVNodeHeaderRenderer<TRow = unknown>(
    renderFn: (ctx: HeaderCellContext<TRow>) => VNode,
  ): (ctx: HeaderCellContext<TRow>) => HTMLElement {
    return (ctx: HeaderCellContext<TRow>) => {
      const container = createTeleportContainer('vue-header-renderer');

      const teleportKey = renderToContainer(container, renderFn(ctx));
      this.teleportKeys.push(teleportKey);

      return container;
    };
  }

  /**
   * Creates a DOM-returning header label renderer from a Vue component class.
   * Used for config-based headerLabelRenderer (not slot-based).
   * @internal
   */
  private createConfigComponentHeaderLabelRenderer<TRow = unknown>(
    component: Component,
  ): (ctx: HeaderLabelContext<TRow>) => HTMLElement {
    return (ctx: HeaderLabelContext<TRow>) => {
      const container = createTeleportContainer('vue-header-label-renderer');

      const comp = component;
      const teleportKey = renderToContainer(
        container,
        createVNode(comp, {
          column: ctx.column,
          value: ctx.value,
        }),
      );
      this.teleportKeys.push(teleportKey);

      return container;
    };
  }

  /**
   * Creates a DOM-returning header label renderer from a VNode-returning render function.
   * Used for config-based headerLabelRenderer (not slot-based).
   * @internal
   */
  private createConfigVNodeHeaderLabelRenderer<TRow = unknown>(
    renderFn: (ctx: HeaderLabelContext<TRow>) => VNode,
  ): (ctx: HeaderLabelContext<TRow>) => HTMLElement {
    return (ctx: HeaderLabelContext<TRow>) => {
      const container = createTeleportContainer('vue-header-label-renderer');

      const teleportKey = renderToContainer(container, renderFn(ctx));
      this.teleportKeys.push(teleportKey);

      return container;
    };
  }

  /**
   * Creates a DOM-returning loading renderer from a Vue component class.
   * @internal
   */
  private createComponentLoadingRenderer(component: Component): (ctx: LoadingContext) => HTMLElement {
    return (ctx: LoadingContext) => {
      const container = createTeleportContainer('vue-loading-renderer');

      const comp = component;
      const teleportKey = renderToContainer(container, createVNode(comp, { size: ctx.size }));
      this.teleportKeys.push(teleportKey);

      return container;
    };
  }

  /**
   * Creates a DOM-returning loading renderer from a VNode-returning render function.
   * @internal
   */
  private createVNodeLoadingRenderer(renderFn: (ctx: LoadingContext) => VNode): (ctx: LoadingContext) => HTMLElement {
    return (ctx: LoadingContext) => {
      const container = createTeleportContainer('vue-loading-renderer');

      const teleportKey = renderToContainer(container, renderFn(ctx));
      this.teleportKeys.push(teleportKey);

      return container;
    };
  }

  /**
   * Creates a DOM-returning empty-state renderer from a Vue component class.
   * The component receives the {@link EmptyContext} fields as props
   * (`sourceRowCount`, `filteredOut`).
   * @internal
   */
  private createComponentEmptyRenderer(component: Component): (ctx: EmptyContext) => HTMLElement {
    return (ctx: EmptyContext) => {
      const container = createTeleportContainer('vue-empty-renderer');
      const teleportKey = renderToContainer(
        container,
        createVNode(component, { sourceRowCount: ctx.sourceRowCount, filteredOut: ctx.filteredOut }),
      );
      this.teleportKeys.push(teleportKey);
      return container;
    };
  }

  /**
   * Creates a DOM-returning empty-state renderer from a VNode-returning render function.
   * @internal
   */
  private createVNodeEmptyRenderer(renderFn: (ctx: EmptyContext) => VNode): (ctx: EmptyContext) => HTMLElement {
    return (ctx: EmptyContext) => {
      const container = createTeleportContainer('vue-empty-renderer');
      const teleportKey = renderToContainer(container, renderFn(ctx));
      this.teleportKeys.push(teleportKey);
      return container;
    };
  }

  // #endregion

  /**
   * Sets the type defaults map for this adapter.
   * Called by TbwGrid when it receives type defaults from context.
   *
   * @internal
   */
  setTypeDefaults(defaults: TypeDefaultsMap | null): void {
    this.typeDefaults = defaults;
  }

  /**
   * Determines if this adapter can handle the given element.
   * Checks if a renderer or editor is registered for this element.
   */
  canHandle(element: HTMLElement): boolean {
    const field = element.getAttribute('field');
    let registry = columnRegistries.get(element);

    // If not found in WeakMap, try field-based lookup
    if (!registry && field) {
      const fieldRegistry = fieldRegistries.get(field);
      if (fieldRegistry && (fieldRegistry.renderer || fieldRegistry.editor)) {
        registry = fieldRegistry;
        columnRegistries.set(element, registry);
      }
    }

    const hasRenderer = registry?.renderer !== undefined;
    const hasEditor = registry?.editor !== undefined;
    return registry !== undefined && (hasRenderer || hasEditor);
  }

  /**
   * Creates a view renderer function that renders a Vue component
   * and returns its container DOM element.
   */
  createRenderer<TRow = unknown, TValue = unknown>(element: HTMLElement): ColumnViewRenderer<TRow, TValue> | undefined {
    const renderFn = getColumnRenderer(element);

    if (!renderFn) {
      return undefined;
    }

    // Cell cache for this field - maps cell element to its teleport key
    const cellCache = new WeakMap<HTMLElement, CellTeleportCache>();

    return (ctx: CellRenderContext<TRow, TValue>) => {
      const cellEl = (ctx as any).cellEl as HTMLElement | undefined;

      if (cellEl) {
        // Check if we have a cached teleport for this cell
        const cached = cellCache.get(cellEl);
        if (cached) {
          // Update the existing teleport with new context
          cached.update(ctx as CellRenderContext<unknown, unknown>);
          return cached.container;
        }

        // Create new container and teleport for this cell
        const container = createTeleportContainer('vue-cell-renderer');

        // Create reactive context that can be updated
        let currentCtx = ctx as CellRenderContext<unknown, unknown>;

        const teleportKey = renderToContainer(container, renderFn(currentCtx));

        // Store in cache with update function
        cellCache.set(cellEl, {
          container,
          teleportKey,
          update: (newCtx) => {
            currentCtx = newCtx;
            renderToContainer(container, renderFn(currentCtx), teleportKey);
          },
        });

        return container;
      }

      // Fallback: create container without caching
      const container = createTeleportContainer('vue-cell-renderer');

      const teleportKey = renderToContainer(container, renderFn(ctx as CellRenderContext<unknown, unknown>));
      this.teleportKeys.push(teleportKey);

      return container;
    };
  }

  /**
   * Creates an editor spec that renders a Vue component for cell editing.
   * Returns a function that creates the editor DOM element.
   */
  createEditor<TRow = unknown, TValue = unknown>(element: HTMLElement): ColumnEditorSpec<TRow, TValue> | undefined {
    const editorFn = getColumnEditor(element);

    if (!editorFn) {
      return undefined;
    }

    // Resolve grid once from the column element (stable in the DOM, so
    // `closest('tbw-grid')` returns synchronously at creation time — unlike
    // the config-based path where the container is constructed before being
    // attached). This lets us install the `before-edit-close` listener
    // eagerly so synchronous dispatches (e.g. from tests or programmatic
    // row-exit calls during the same task) are captured.
    const gridEl = (element.closest('tbw-grid') as HTMLElement | null) ?? undefined;

    // Return a function that creates the editor element
    return (ctx: ColumnEditorContext<TRow, TValue>): HTMLElement => {
      const container = createTeleportContainer('vue-cell-editor');

      const teleportKey = renderToContainer(container, editorFn(ctx as ColumnEditorContext<unknown, unknown>));
      // Track for per-cell cleanup via releaseCell
      this.editorTeleportKeys.set(container, teleportKey);

      // Run editor-mount hooks (e.g. `before-edit-close` blur bridge installed
      // by `@toolbox-web/grid-vue/features/editing`). Resolved eagerly because
      // we have synchronous access to the column element.
      if (gridEl) {
        this.editorBeforeCloseUnsubs.set(container, notifyEditorMounted(container, gridEl));
      }

      return container;
    };
  }

  /**
   * Framework adapter hook called by MasterDetailPlugin during attach().
   * Implementation is installed by `@toolbox-web/grid-vue/features/master-detail`
   * via {@link registerDetailRendererBridge}. Returns undefined if the
   * master-detail feature has not been imported, or if no TbwGridDetailPanel
   * was registered for this grid.
   */
  parseDetailElement<TRow = unknown>(
    detailElement: Element,
  ): ((row: TRow, rowIndex: number) => HTMLElement) | undefined {
    if (!detailRendererBridge) return undefined;
    const gridElement = detailElement.closest('tbw-grid') as HTMLElement | null;
    if (!gridElement) return undefined;
    return detailRendererBridge<TRow>(gridElement, this.bridgeContext);
  }

  /**
   * Framework adapter hook called by ResponsivePlugin during attach().
   * Implementation is installed by `@toolbox-web/grid-vue/features/responsive`
   * via {@link registerResponsiveCardRendererBridge}. Returns undefined if
   * the responsive feature has not been imported, or if no TbwGridResponsiveCard
   * was registered for this grid.
   */
  parseResponsiveCardElement<TRow = unknown>(
    cardElement: Element,
  ): ((row: TRow, rowIndex: number) => HTMLElement) | undefined {
    if (!responsiveCardRendererBridge) return undefined;
    const gridElement = cardElement.closest('tbw-grid') as HTMLElement | null;
    if (!gridElement) return undefined;
    return responsiveCardRendererBridge<TRow>(gridElement, this.bridgeContext);
  }

  /**
   * Framework adapter hook called by the grid core when a `<tbw-grid-tool-panel>`
   * needs a renderer. Returns a function that renders Vue tool panel content
   * into the shell's accordion container.
   *
   * Uses a wrapper-detach pattern for the cleanup callback: the cleanup
   * synchronously removes a wrapper div from the container, so the shell's
   * subsequent `contentArea.innerHTML = ''` (during accordion collapse) sees
   * an empty container and cannot disturb Vue's still-attached teleport
   * children. Vue then unmounts asynchronously on the next microtask
   * against the orphaned wrapper without throwing `NotFoundError`.
   */
  createToolPanelRenderer(element: HTMLElement): ((container: HTMLElement) => void | (() => void)) | undefined {
    const renderFn = getToolPanelRenderer(element);
    if (!renderFn) return undefined;

    const gridElement = element.closest('tbw-grid') as HTMLElement | null;

    return (container: HTMLElement) => {
      const ctx: ToolPanelContext = { gridElement: gridElement ?? container };
      const vnodes = renderFn(ctx);
      if (!vnodes || vnodes.length === 0) return;

      // Wrapper indirection: render Vue content into a wrapper inside the
      // container so we can sync-detach the wrapper before the shell clears
      // the container's innerHTML during accordion collapse.
      const wrapper = document.createElement('div');
      wrapper.className = 'vue-tool-panel';
      container.appendChild(wrapper);

      const teleportKey = renderToContainer(wrapper, vnodes as unknown as VNode, undefined, gridElement ?? undefined);
      this.teleportKeys.push(teleportKey);

      // Cleanup function called by the shell before `contentArea.innerHTML = ''`.
      return () => {
        // Synchronously detach the wrapper so the shell's innerHTML clear
        // sees an empty container. Vue's teleport children are still
        // attached to the wrapper itself — just orphaned from the DOM tree.
        wrapper.remove();
        // Schedule the Vue unmount; safe because it operates on the wrapper.
        removeFromContainer(teleportKey);
        const i = this.teleportKeys.indexOf(teleportKey);
        if (i !== -1) this.teleportKeys.splice(i, 1);
      };
    };
  }

  // #region Type Defaults Support

  /**
   * Gets type-level defaults from the type defaults map.
   *
   * This enables application-wide type defaults configured via GridTypeProvider.
   * The returned TypeDefault contains renderer/editor functions that render
   * Vue components into the grid's cells.
   *
   * @example
   * ```vue
   * <script setup>
   * import { GridTypeProvider } from '@toolbox-web/grid-vue';
   * import { h } from 'vue';
   * import CountryBadge from './CountryBadge.vue';
   *
   * const typeDefaults = {
   *   country: {
   *     renderer: (ctx) => h(CountryBadge, { code: ctx.value }),
   *   },
   * };
   * </script>
   *
   * <template>
   *   <GridTypeProvider :defaults="typeDefaults">
   *     <App />
   *   </GridTypeProvider>
   * </template>
   * ```
   */
  getTypeDefault<TRow = unknown>(type: string, _gridEl?: HTMLElement): BaseTypeDefault<TRow> | undefined {
    if (!this.typeDefaults) {
      return undefined;
    }

    const vueDefault = this.typeDefaults[type] as TypeDefault<TRow> | undefined;
    if (!vueDefault) {
      return undefined;
    }

    const typeDefault: BaseTypeDefault<TRow> = {
      editorParams: vueDefault.editorParams,
    };

    // Create renderer function that renders Vue component
    if (vueDefault.renderer) {
      typeDefault.renderer = this.createTypeRenderer<TRow>(vueDefault.renderer);
    }

    // Create editor function that renders Vue component
    if (vueDefault.editor) {
      typeDefault.editor = this.createTypeEditor<TRow>(vueDefault.editor) as BaseTypeDefault['editor'];
    }

    // Create filterPanelRenderer function that renders Vue component.
    // Implementation is installed by `@toolbox-web/grid-vue/features/filtering`
    // via {@link registerFilterPanelTypeDefaultBridge}. Without that import,
    // type-default filter panels are dropped silently (filtering itself also
    // requires the feature import, so this is not a new precondition).
    if (vueDefault.filterPanelRenderer && filterPanelTypeDefaultBridge) {
      typeDefault.filterPanelRenderer = filterPanelTypeDefaultBridge(
        vueDefault.filterPanelRenderer,
        _gridEl,
        this.bridgeContext,
      );
    }

    return typeDefault;
  }

  /**
   * Creates a renderer function from a Vue render function for type defaults.
   * @internal
   */
  private createTypeRenderer<TRow = unknown, TValue = unknown>(
    renderFn: (ctx: CellRenderContext<TRow, TValue>) => VNode,
  ): ColumnViewRenderer<TRow, TValue> {
    return (ctx: CellRenderContext<TRow, TValue>) => {
      const container = document.createElement('span');
      container.style.display = 'contents';

      const teleportKey = renderToContainer(container, renderFn(ctx));
      this.teleportKeys.push(teleportKey);

      return container;
    };
  }

  /**
   * Creates an editor function from a Vue render function for type defaults.
   * @internal
   */
  private createTypeEditor<TRow = unknown, TValue = unknown>(
    renderFn: (ctx: ColumnEditorContext<TRow, TValue>) => VNode,
  ): ColumnEditorSpec<TRow, TValue> {
    return (ctx: ColumnEditorContext<TRow, TValue>) => {
      const container = document.createElement('span');
      container.style.display = 'contents';

      const teleportKey = renderToContainer(container, renderFn(ctx));
      // Track for per-cell cleanup via releaseCell
      this.editorTeleportKeys.set(container, teleportKey);
      this.attachBeforeEditCloseFlush(container);

      return container;
    };
  }

  // #endregion

  /**
   * Cleanup all teleport entries.
   */
  cleanup(): void {
    // Clean up teleport entries
    for (const key of this.teleportKeys) {
      removeFromContainer(key);
    }
    this.teleportKeys = [];
    for (const [, key] of this.editorTeleportKeys) {
      removeFromContainer(key);
    }
    this.editorTeleportKeys.clear();
    for (const unsub of this.editorBeforeCloseUnsubs.values()) unsub();
    this.editorBeforeCloseUnsubs.clear();

    fieldRegistries.clear();
  }

  /**
   * Unmount a specific container (e.g., detail panel, tool panel).
   * Currently a no-op for teleport-based rendering — the TeleportManager's
   * prune pass handles disconnected containers automatically.
   */
  unmount(_container: HTMLElement): void {
    // Teleport-based rendering is handled by the TeleportManager prune pass
  }

  /**
   * Called when a cell's content is about to be wiped.
   * Destroys editor teleports whose container is inside the cell.
   */
  releaseCell(cellEl: HTMLElement): void {
    // Clean up editor teleport keys
    for (const [editorContainer, key] of this.editorTeleportKeys) {
      if (cellEl.contains(editorContainer)) {
        removeFromContainer(key);
        this.editorTeleportKeys.delete(editorContainer);
        const unsub = this.editorBeforeCloseUnsubs.get(editorContainer);
        if (unsub) {
          unsub();
          this.editorBeforeCloseUnsubs.delete(editorContainer);
        }
      }
    }
  }
}
