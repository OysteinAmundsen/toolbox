import type {
  ColumnConfig as BaseColumnConfig,
  GridConfig as BaseGridConfig,
  TypeDefault as BaseTypeDefault,
  CellRenderContext,
  ColumnEditorContext,
  ColumnEditorSpec,
  ColumnViewRenderer,
  FrameworkAdapter,
  HeaderCellContext,
  HeaderLabelContext,
  LoadingContext,
} from '@toolbox-web/grid';
import type { FilterPanelParams } from '@toolbox-web/grid/plugins/filtering';
import { createVNode, type Component, type VNode } from 'vue';
import { detailRegistry, type DetailPanelContext } from './detail-panel-registry';
import type { TypeDefault, TypeDefaultsMap } from './grid-type-registry';
import { cardRegistry, type ResponsiveCardContext } from './responsive-card-registry';
import { removeFromContainer, renderToContainer } from './teleport-bridge';
import { getToolPanelRenderer, type ToolPanelContext } from './tool-panel-registry';
import type { ColumnConfig, GridConfig } from './vue-column-config';
export type { GridConfig };

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
 */
export class GridAdapter implements FrameworkAdapter {
  /** Teleport keys tracked for cleanup. */
  private teleportKeys: string[] = [];
  /** Editor-specific teleport keys tracked separately for per-cell cleanup. */
  private editorTeleportKeys: Map<HTMLElement, string> = new Map();
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

      if (config.filterPanelRenderer) {
        processedConfig.filterPanelRenderer = this.createFilterPanelRenderer(config.filterPanelRenderer);
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

        const container = document.createElement('div');
        container.className = 'vue-cell-renderer';
        container.style.display = 'contents';

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

      const container = document.createElement('div');
      container.className = 'vue-cell-renderer';
      container.style.display = 'contents';

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

        const container = document.createElement('div');
        container.className = 'vue-cell-renderer';
        container.style.display = 'contents';

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

      const container = document.createElement('div');
      container.className = 'vue-cell-renderer';
      container.style.display = 'contents';

      const teleportKey = renderToContainer(container, renderFn(ctx));
      this.teleportKeys.push(teleportKey);

      return container;
    };
  }

  /**
   * Attaches a `before-edit-close` listener on the host grid that flushes
   * the focused input inside `container` via native `.blur()` so editors
   * written with `@blur="commit"` flush pending input before the cell DOM
   * is torn down by Tab / programmatic row exit.
   *
   * The grid is resolved lazily via `queueMicrotask` because the container
   * is appended to the cell *after* the editor wrapper returns.
   *
   * Mirror of the same bridge inline in `createEditor` (slot path) and the
   * React adapter's `wrapReactEditor` / `createEditor`.
   * @internal
   */
  private attachBeforeEditCloseFlush(container: HTMLElement): void {
    queueMicrotask(() => {
      const gridEl = container.closest('tbw-grid') as HTMLElement | null;
      if (!gridEl) return;
      const flush = () => {
        const focused = container.ownerDocument.activeElement as HTMLElement | null;
        if (
          focused &&
          container.contains(focused) &&
          (focused instanceof HTMLInputElement ||
            focused instanceof HTMLTextAreaElement ||
            focused instanceof HTMLSelectElement)
        ) {
          focused.blur();
        }
      };
      gridEl.addEventListener('before-edit-close', flush);
      this.editorBeforeCloseUnsubs.set(container, () => {
        gridEl.removeEventListener('before-edit-close', flush);
      });
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
      const container = document.createElement('div');
      container.className = 'vue-cell-editor';
      container.style.display = 'contents';

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
      const container = document.createElement('div');
      container.className = 'vue-cell-editor';
      container.style.display = 'contents';

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
      const container = document.createElement('div');
      container.className = 'vue-header-renderer';
      container.style.display = 'contents';

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
      const container = document.createElement('div');
      container.className = 'vue-header-renderer';
      container.style.display = 'contents';

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
      const container = document.createElement('div');
      container.className = 'vue-header-label-renderer';
      container.style.display = 'contents';

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
      const container = document.createElement('div');
      container.className = 'vue-header-label-renderer';
      container.style.display = 'contents';

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
      const container = document.createElement('div');
      container.className = 'vue-loading-renderer';
      container.style.display = 'contents';

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
      const container = document.createElement('div');
      container.className = 'vue-loading-renderer';
      container.style.display = 'contents';

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
        const container = document.createElement('div');
        container.className = 'vue-cell-renderer';
        container.style.display = 'contents';

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
      const container = document.createElement('div');
      container.className = 'vue-cell-renderer';
      container.style.display = 'contents';

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

    // Resolve grid once from the column element (stable in the DOM)
    const gridEl = (element.closest('tbw-grid') as HTMLElement | null) ?? undefined;

    // Return a function that creates the editor element
    return (ctx: ColumnEditorContext<TRow, TValue>): HTMLElement => {
      const container = document.createElement('div');
      container.className = 'vue-cell-editor';
      container.style.display = 'contents';

      const teleportKey = renderToContainer(container, editorFn(ctx as ColumnEditorContext<unknown, unknown>));
      // Track for per-cell cleanup via releaseCell
      this.editorTeleportKeys.set(container, teleportKey);

      // Bridge "Tab / programmatic row exit drops pending input" — see
      // editorBeforeCloseUnsubs doc comment. Calling native `.blur()` fires
      // both `blur` (non-bubbling) and `focusout` (bubbling) so any editor
      // with `@blur="commit"` flushes before the cell DOM is torn down.
      if (gridEl) {
        const flush = () => {
          const doc = container.ownerDocument;
          const focused = doc.activeElement as HTMLElement | null;
          if (
            focused &&
            container.contains(focused) &&
            (focused instanceof HTMLInputElement ||
              focused instanceof HTMLTextAreaElement ||
              focused instanceof HTMLSelectElement)
          ) {
            focused.blur();
          }
        };
        gridEl.addEventListener('before-edit-close', flush);
        this.editorBeforeCloseUnsubs.set(container, () => {
          gridEl.removeEventListener('before-edit-close', flush);
        });
      }

      return container;
    };
  }

  /**
   * Framework adapter hook called by MasterDetailPlugin during attach().
   * Parses the <tbw-grid-detail> element and returns a Vue-based renderer.
   */
  parseDetailElement<TRow = unknown>(
    detailElement: Element,
  ): ((row: TRow, rowIndex: number) => HTMLElement) | undefined {
    const gridElement = detailElement.closest('tbw-grid') as HTMLElement | null;
    if (!gridElement) return undefined;

    // Get renderer from registry (registered by TbwGridDetailPanel)
    const detailEl = gridElement.querySelector('tbw-grid-detail') as HTMLElement | null;
    if (!detailEl) return undefined;

    const renderFn = detailRegistry.get(detailEl);
    if (!renderFn) return undefined;

    return (row: TRow, rowIndex: number): HTMLElement => {
      const container = document.createElement('div');
      container.className = 'vue-detail-panel';

      const ctx: DetailPanelContext<TRow> = { row, rowIndex };
      const vnodes = renderFn(ctx as DetailPanelContext<unknown>);

      if (vnodes && vnodes.length > 0) {
        // Render VNodes into container via teleport bridge
        const teleportKey = renderToContainer(container, vnodes as unknown as VNode);
        this.teleportKeys.push(teleportKey);
      }

      return container;
    };
  }

  /**
   * Framework adapter hook called by ResponsivePlugin during attach().
   * Parses the <tbw-grid-responsive-card> element and returns a Vue-based renderer.
   */
  parseResponsiveCardElement<TRow = unknown>(
    cardElement: Element,
  ): ((row: TRow, rowIndex: number) => HTMLElement) | undefined {
    const gridElement = cardElement.closest('tbw-grid') as HTMLElement | null;
    if (!gridElement) return undefined;

    // Get renderer from registry (registered by TbwGridResponsiveCard)
    const cardEl = gridElement.querySelector('tbw-grid-responsive-card') as HTMLElement | null;
    if (!cardEl) return undefined;

    const renderFn = cardRegistry.get(cardEl);
    if (!renderFn) return undefined;

    return (row: TRow, rowIndex: number): HTMLElement => {
      const container = document.createElement('div');
      container.className = 'vue-responsive-card';

      const ctx: ResponsiveCardContext<TRow> = { row, rowIndex };
      const vnodes = renderFn(ctx as ResponsiveCardContext<unknown>);

      if (vnodes && vnodes.length > 0) {
        // Render VNodes into container via teleport bridge
        const teleportKey = renderToContainer(container, vnodes as unknown as VNode);
        this.teleportKeys.push(teleportKey);
      }

      return container;
    };
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

    // Create filterPanelRenderer function that renders Vue component
    if (vueDefault.filterPanelRenderer) {
      typeDefault.filterPanelRenderer = this.createFilterPanelRenderer(vueDefault.filterPanelRenderer);
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

  /**
   * Creates a filter panel renderer function from a Vue render function.
   *
   * Wraps a Vue `(params: FilterPanelParams) => VNode` function into the
   * imperative `(container, params) => void` signature expected by the core grid.
   * @internal
   */
  private createFilterPanelRenderer(
    renderFn: (params: FilterPanelParams) => VNode,
  ): (container: HTMLElement, params: FilterPanelParams) => void {
    return (container: HTMLElement, params: FilterPanelParams) => {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'contents';

      const teleportKey = renderToContainer(wrapper, renderFn(params));
      this.teleportKeys.push(teleportKey);
      container.appendChild(wrapper);
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
