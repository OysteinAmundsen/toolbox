import type {
  ColumnConfig as BaseColumnConfig,
  GridConfig as BaseGridConfig,
  TypeDefault as BaseTypeDefault,
  CellRenderContext,
  ColumnEditorContext,
  ColumnEditorSpec,
  ColumnViewRenderer,
  FrameworkAdapter,
} from '@toolbox-web/grid';
import { createApp, createVNode, type App, type Component, type VNode } from 'vue';
import { detailRegistry, type DetailPanelContext } from './detail-panel-registry';
import type { TypeDefault, TypeDefaultsMap } from './grid-type-registry';
import { cardRegistry, type ResponsiveCardContext } from './responsive-card-registry';
import type { ColumnConfig, GridConfig } from './vue-column-config';

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
 * @internal - for testing only
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
    const fn = value as Record<string, unknown>;
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
 * Tracks mounted Vue apps for cleanup.
 */
interface MountedView {
  app: App;
  container: HTMLElement;
}

/**
 * Cache for cell containers and their Vue apps.
 */
interface CellAppCache {
  app: App;
  container: HTMLElement;
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
  private mountedViews: MountedView[] = [];
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
    const result = { ...config } as BaseGridConfig<TRow>;

    // Process columns
    if (config.columns) {
      result.columns = config.columns.map((col) => this.processColumn(col));
    }

    // Process typeDefaults
    if (config.typeDefaults) {
      result.typeDefaults = this.processTypeDefaults(config.typeDefaults as Record<string, TypeDefault>);
    }

    return result;
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

    if (column.renderer && !(column.renderer as Record<symbol, unknown>)[PROCESSED_MARKER]) {
      if (isVueComponent(column.renderer)) {
        const wrapped = this.createConfigComponentRenderer(column.renderer as Component);
        (wrapped as Record<symbol, unknown>)[PROCESSED_MARKER] = true;
        processed.renderer = wrapped;
      } else if (isVNodeRenderFunction(column.renderer)) {
        const wrapped = this.createConfigVNodeRenderer(column.renderer as (ctx: CellRenderContext<TRow>) => VNode);
        (wrapped as Record<symbol, unknown>)[PROCESSED_MARKER] = true;
        processed.renderer = wrapped;
      }
    }

    if (column.editor && !(column.editor as Record<symbol, unknown>)[PROCESSED_MARKER]) {
      if (isVueComponent(column.editor)) {
        const wrapped = this.createConfigComponentEditor(column.editor as Component);
        (wrapped as Record<symbol, unknown>)[PROCESSED_MARKER] = true;
        processed.editor = wrapped;
      } else if (isVNodeRenderFunction(column.editor)) {
        const wrapped = this.createConfigVNodeEditor(column.editor as (ctx: ColumnEditorContext<TRow>) => VNode);
        (wrapped as Record<symbol, unknown>)[PROCESSED_MARKER] = true;
        processed.editor = wrapped;
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
    const cellCache = new WeakMap<HTMLElement, CellAppCache>();

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

        const app = createApp({
          render() {
            return createVNode(comp, { ...currentCtx });
          },
        });

        app.mount(container);

        cellCache.set(cellEl, {
          app,
          container,
          update: (newCtx) => {
            currentCtx = newCtx;
            app._instance?.update();
          },
        });

        return container;
      }

      const container = document.createElement('div');
      container.className = 'vue-cell-renderer';
      container.style.display = 'contents';

      const comp = component;
      const app = createApp({
        render() {
          return createVNode(comp, { ...ctx });
        },
      });

      app.mount(container);
      this.mountedViews.push({ app, container });

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
    const cellCache = new WeakMap<HTMLElement, CellAppCache>();

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

        const app = createApp({
          render() {
            return renderFn(currentCtx as CellRenderContext<TRow, TValue>);
          },
        });

        app.mount(container);

        cellCache.set(cellEl, {
          app,
          container,
          update: (newCtx) => {
            currentCtx = newCtx;
            app._instance?.update();
          },
        });

        return container;
      }

      const container = document.createElement('div');
      container.className = 'vue-cell-renderer';
      container.style.display = 'contents';

      const app = createApp({
        render() {
          return renderFn(ctx);
        },
      });

      app.mount(container);
      this.mountedViews.push({ app, container });

      return container;
    };
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
      const app = createApp({
        render() {
          return createVNode(comp, { ...ctx });
        },
      });

      app.mount(container);
      this.mountedViews.push({ app, container });

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

      const app = createApp({
        render() {
          return renderFn(ctx);
        },
      });

      app.mount(container);
      this.mountedViews.push({ app, container });

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
  createRenderer<TRow = unknown, TValue = unknown>(element: HTMLElement): ColumnViewRenderer<TRow, TValue> {
    const renderFn = getColumnRenderer(element);

    if (!renderFn) {
      return undefined as unknown as ColumnViewRenderer<TRow, TValue>;
    }

    // Cell cache for this field - maps cell element to its Vue app
    const cellCache = new WeakMap<HTMLElement, CellAppCache>();

    return (ctx: CellRenderContext<TRow, TValue>) => {
      const cellEl = (ctx as any).cellEl as HTMLElement | undefined;

      if (cellEl) {
        // Check if we have a cached app for this cell
        const cached = cellCache.get(cellEl);
        if (cached) {
          // Update the existing app with new context
          cached.update(ctx as CellRenderContext<unknown, unknown>);
          return cached.container;
        }

        // Create new container and Vue app for this cell
        const container = document.createElement('div');
        container.className = 'vue-cell-renderer';
        container.style.display = 'contents';

        // Create reactive context that can be updated
        let currentCtx = ctx as CellRenderContext<unknown, unknown>;

        const app = createApp({
          render() {
            return renderFn(currentCtx);
          },
        });

        app.mount(container);

        // Store in cache with update function
        cellCache.set(cellEl, {
          app,
          container,
          update: (newCtx) => {
            currentCtx = newCtx;
            // Force re-render
            app._instance?.update();
          },
        });

        return container;
      }

      // Fallback: create container without caching
      const container = document.createElement('div');
      container.className = 'vue-cell-renderer';
      container.style.display = 'contents';

      const app = createApp({
        render() {
          return renderFn(ctx as CellRenderContext<unknown, unknown>);
        },
      });

      app.mount(container);
      this.mountedViews.push({ app, container });

      return container;
    };
  }

  /**
   * Creates an editor spec that renders a Vue component for cell editing.
   * Returns a function that creates the editor DOM element.
   */
  createEditor<TRow = unknown, TValue = unknown>(element: HTMLElement): ColumnEditorSpec<TRow, TValue> {
    const editorFn = getColumnEditor(element);

    if (!editorFn) {
      return undefined as unknown as ColumnEditorSpec<TRow, TValue>;
    }

    // Return a function that creates the editor element
    return (ctx: ColumnEditorContext<TRow, TValue>): HTMLElement => {
      const container = document.createElement('div');
      container.className = 'vue-cell-editor';
      container.style.display = 'contents';

      const app = createApp({
        render() {
          return editorFn(ctx as ColumnEditorContext<unknown, unknown>);
        },
      });

      app.mount(container);
      this.mountedViews.push({ app, container });

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
        // Render VNodes into container
        const app = createApp({
          render() {
            return vnodes;
          },
        });
        app.mount(container);
        this.mountedViews.push({ app, container });
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
        // Render VNodes into container
        const app = createApp({
          render() {
            return vnodes;
          },
        });
        app.mount(container);
        this.mountedViews.push({ app, container });
      }

      return container;
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
  getTypeDefault<TRow = unknown>(type: string): BaseTypeDefault<TRow> | undefined {
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

      const app = createApp({
        render() {
          return renderFn(ctx);
        },
      });

      app.mount(container);
      this.mountedViews.push({ app, container });

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

      const app = createApp({
        render() {
          return renderFn(ctx);
        },
      });

      app.mount(container);
      this.mountedViews.push({ app, container });

      return container;
    };
  }

  // #endregion

  /**
   * Cleanup all mounted Vue apps.
   */
  cleanup(): void {
    for (const { app, container } of this.mountedViews) {
      try {
        app.unmount();
        container.remove();
      } catch {
        // Ignore cleanup errors
      }
    }
    this.mountedViews = [];
  }
}

/**
 * @deprecated Use `GridAdapter` instead. This alias will be removed in a future version.
 * @see {@link GridAdapter}
 */
export const VueGridAdapter = GridAdapter;
