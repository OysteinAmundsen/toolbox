import type {
  CellRenderContext,
  ColumnEditorContext,
  ColumnEditorSpec,
  ColumnViewRenderer,
  FrameworkAdapter,
  TypeDefault,
} from '@toolbox-web/grid';
import { createApp, type App, type VNode } from 'vue';
import { detailRegistry, type DetailPanelContext } from './detail-panel-registry';
import type { TypeDefaultsMap, VueTypeDefault } from './grid-type-registry';
import { cardRegistry, type ResponsiveCardContext } from './responsive-card-registry';

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
 * import { VueGridAdapter } from '@toolbox-web/grid-vue';
 *
 * // One-time registration
 * GridElement.registerAdapter(new VueGridAdapter());
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
export class VueGridAdapter implements FrameworkAdapter {
  private mountedViews: MountedView[] = [];
  private typeDefaults: TypeDefaultsMap | null = null;

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
  getTypeDefault<TRow = unknown>(type: string): TypeDefault<TRow> | undefined {
    if (!this.typeDefaults) {
      return undefined;
    }

    const vueDefault = this.typeDefaults[type] as VueTypeDefault<TRow> | undefined;
    if (!vueDefault) {
      return undefined;
    }

    const typeDefault: TypeDefault<TRow> = {
      editorParams: vueDefault.editorParams,
    };

    // Create renderer function that renders Vue component
    if (vueDefault.renderer) {
      typeDefault.renderer = this.createTypeRenderer<TRow>(vueDefault.renderer);
    }

    // Create editor function that renders Vue component
    if (vueDefault.editor) {
      typeDefault.editor = this.createTypeEditor<TRow>(vueDefault.editor) as TypeDefault['editor'];
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
