import type {
  CellRenderContext,
  ColumnEditorContext,
  ColumnEditorSpec,
  ColumnViewRenderer,
  GridConfig as CoreGridConfig,
  DataGridElement,
  FrameworkAdapter,
  TypeDefault,
} from '@toolbox-web/grid';
import type { ReactNode } from 'react';
import { notifyEditorMounted, registerEditorMountHook, type EditorMountHook } from './editor-mount-hooks';
import { getToolPanelRenderer, type ToolPanelContext } from './grid-tool-panel';
import type { TypeDefault as ReactTypeDefault, TypeDefaultsMap } from './grid-type-registry';
import { removeFromContainer, renderToContainer } from './portal-bridge';
import { cleanupConfigRootsIn, processGridConfig } from './react-column-config';

// Re-export so feature secondary entries can install editor-mount hooks
// via `import { registerEditorMountHook } from '@toolbox-web/grid-react'`.
export { registerEditorMountHook, type EditorMountHook };

// #region Feature bridge registries

/**
 * Context handed to feature bridge installers so they can hook the adapter's
 * portal lifecycle without depending on its private fields.
 * @internal
 */
export interface FeatureBridgeContext {
  /** Track a portal key + container for cleanup on releaseCell / destroy. */
  trackPortal(key: string, container: HTMLElement, isEditor: boolean): void;
}

/**
 * Installer signature: given a grid element + bridge context, returns the
 * row-renderer the adapter should expose, or undefined if no React template
 * is registered for that grid.
 * @internal
 */
export type RowRendererBridge = <TRow = unknown>(
  gridEl: HTMLElement,
  ctx: FeatureBridgeContext,
) => ((row: TRow, rowIndex: number) => HTMLElement) | undefined;

/**
 * Installer signature for the type-default `filterPanelRenderer` wrapper.
 * Receives the user's React render function (typed loosely as `unknown` so
 * the adapter does not depend on filtering types) and returns the imperative
 * `(container, params) => void` form required by the core grid.
 * @internal
 */
export type FilterPanelTypeDefaultBridge = (
  renderFn: unknown,
  gridEl: HTMLElement | undefined,
  ctx: FeatureBridgeContext,
) => NonNullable<TypeDefault['filterPanelRenderer']>;

let detailRendererBridge: RowRendererBridge | null = null;
let responsiveCardRendererBridge: RowRendererBridge | null = null;
let filterPanelTypeDefaultBridge: FilterPanelTypeDefaultBridge | null = null;

/**
 * Install the master-detail row-renderer bridge. Called once on import by
 * `@toolbox-web/grid-react/features/master-detail`. Mirrors how core grid
 * plugins augment the grid via `registerPlugin()`.
 * @internal Plugin API
 */
export function registerDetailRendererBridge(bridge: RowRendererBridge): void {
  detailRendererBridge = bridge;
}

/**
 * Install the responsive card row-renderer bridge. Called once on import by
 * `@toolbox-web/grid-react/features/responsive`.
 * @internal Plugin API
 */
export function registerResponsiveCardRendererBridge(bridge: RowRendererBridge): void {
  responsiveCardRendererBridge = bridge;
}

/**
 * Install the type-default `filterPanelRenderer` wrapper. Called once on
 * import by `@toolbox-web/grid-react/features/filtering`. Without this
 * bridge, type-default filterPanelRenderer entries are dropped silently —
 * filter panels only work if the filtering feature is also imported, which
 * is the same precondition as the FilteringPlugin itself (TBW031).
 * @internal Plugin API
 */
export function registerFilterPanelTypeDefaultBridge(bridge: FilterPanelTypeDefaultBridge): void {
  filterPanelTypeDefaultBridge = bridge;
}

// #endregion

/**
 * Registry mapping grid elements to their React render functions.
 * Each column element stores its renderer/editor functions here.
 */
interface ColumnRegistry {
  renderer?: (ctx: CellRenderContext<unknown, unknown>) => ReactNode;
  editor?: (ctx: ColumnEditorContext<unknown, unknown>) => ReactNode;
}

const columnRegistries = new WeakMap<HTMLElement, ColumnRegistry>();

// Secondary registry by field name to handle React element re-creation
// React may create new DOM elements on re-render, so we also store by field
const fieldRegistries = new Map<string, ColumnRegistry>();

/**
 * Register a React cell renderer for a column element.
 * Called by GridColumn when it has a children render prop.
 */
export function registerColumnRenderer(
  element: HTMLElement,
  renderer: (ctx: CellRenderContext<unknown, unknown>) => ReactNode,
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
 * Register a React cell editor for a column element.
 * Called by GridColumn when it has an editor prop.
 */
export function registerColumnEditor(
  element: HTMLElement,
  editor: (ctx: ColumnEditorContext<unknown, unknown>) => ReactNode,
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
): ((ctx: CellRenderContext<unknown, unknown>) => ReactNode) | undefined {
  let renderer = columnRegistries.get(element)?.renderer;

  // Fallback to field-based lookup for React element re-creation scenarios
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
): ((ctx: ColumnEditorContext<unknown, unknown>) => ReactNode) | undefined {
  let editor = columnRegistries.get(element)?.editor;

  // Fallback to field-based lookup for React element re-creation scenarios
  if (!editor) {
    const field = element.getAttribute('field');
    if (field) {
      editor = fieldRegistries.get(field)?.editor;
    }
  }

  return editor;
}

/**
 * Debug helper: Get list of registered fields.
 * @internal
 */
export function getRegisteredFields(): string[] {
  return Array.from(fieldRegistries.keys());
}

/**
 * Cache for cell containers and their portal keys.
 * WeakMap keyed by cell element for automatic GC when cells are removed.
 */
interface CellPortalCache {
  portalKey: string;
  container: HTMLElement;
}

/**
 * Framework adapter that enables React component integration
 * with the grid's light DOM configuration API.
 *
 * ## Usage
 *
 * The adapter is automatically registered when using the DataGrid component.
 * For advanced use cases, you can manually register:
 *
 * ```tsx
 * import { GridElement } from '@toolbox-web/grid';
 * import { GridAdapter } from '@toolbox-web/grid-react';
 *
 * // One-time registration
 * GridElement.registerAdapter(new GridAdapter());
 * ```
 *
 * ## Declarative usage with DataGrid:
 *
 * ```tsx
 * <DataGrid rows={data} gridConfig={config}>
 *   <GridColumn field="status">
 *     {(ctx) => <StatusBadge value={ctx.value} />}
 *   </GridColumn>
 *   <GridColumn field="name" editor={(ctx) => (
 *     <NameEditor value={ctx.value} onCommit={ctx.commit} onCancel={ctx.cancel} />
 *   )} />
 * </DataGrid>
 * ```
 * @since 0.11.0
 */
export class GridAdapter implements FrameworkAdapter {
  /** Portal keys for all managed portals (for cleanup on destroy). */
  private allPortalKeys = new Set<string>();
  /** Portal keys for editor-specific portals (for per-cell cleanup via releaseCell). */
  private editorPortalKeys = new Set<string>();
  /** Maps portal keys to their containers (for container-based lookups in releaseCell/unmount). */
  private keyToContainer = new Map<string, HTMLElement>();
  /**
   * Reverse index: container element → portal key. Maintained alongside
   * `keyToContainer` so `releaseCell` can resolve only the containers
   * actually inside the released cell (via `cellEl.querySelectorAll`)
   * instead of scanning every tracked portal — important for grids with
   * many cells, where `releaseCell` runs on every cell teardown.
   */
  private containerToKey = new WeakMap<HTMLElement, string>();
  /**
   * Per-editor `before-edit-close` listener teardown functions, keyed by portal key.
   *
   * The grid's editing plugin emits `before-edit-close` on the host `<tbw-grid>`
   * before tearing down a row's managed editors. React editors commonly write
   * `onBlur={commit}` to flush local state on click-away, but Tab / programmatic
   * row exit rebuilds the cell DOM synchronously without giving the focused
   * input a chance to fire `blur` first.
   *
   * To bridge that gap we call `.blur()` on the focused input inside the editor
   * container as soon as `before-edit-close` fires. The native `.blur()` method
   * is what React's event system actually observes — React 17+ delegates focus
   * events at the root by listening to `focusout` (bubbling) and mapping it to
   * `onBlur`. A bare `dispatchEvent(new FocusEvent('blur'))` would be ignored
   * by React because `blur` does not bubble. Calling the native `.blur()`
   * dispatches the full focus-loss chain (`blur` + `focusout`) and also moves
   * focus off the input — both desirable here since the editor DOM is about to
   * be torn down anyway.
   *
   * Mirrors the Angular adapter's `BaseGridEditor.onBeforeEditClose()` hook.
   * Requires zero per-editor code: any editor with `onBlur={commit}` is
   * automatically covered for Tab commits and programmatic row exit.
   */
  private editorBeforeCloseUnsubs = new Map<string, () => void>();
  private typeDefaults: TypeDefaultsMap | null = null;

  /**
   * Sets the type defaults map for this adapter.
   * Called by DataGrid when it receives type defaults from context.
   *
   * @internal
   */
  setTypeDefaults(defaults: TypeDefaultsMap | null): void {
    this.typeDefaults = defaults;
  }

  /**
   * FrameworkAdapter.processConfig implementation.
   * Called automatically by the grid's `set gridConfig` setter.
   * Converts React renderer/editor functions to DOM-returning functions.
   */
  processConfig<TRow = unknown>(config: CoreGridConfig<TRow>): CoreGridConfig<TRow> {
    return (processGridConfig(config as any) ?? config) as CoreGridConfig<TRow>;
  }

  /**
   * Determines if this adapter can handle the given element.
   * Checks if a renderer or editor is registered for this element.
   */
  canHandle(element: HTMLElement): boolean {
    const field = element.getAttribute('field');
    let registry = columnRegistries.get(element);

    // If not found in WeakMap, try field-based lookup
    // This handles the case where React re-renders and creates new elements
    if (!registry && field) {
      const fieldRegistry = fieldRegistries.get(field);
      if (fieldRegistry && (fieldRegistry.renderer || fieldRegistry.editor)) {
        // Copy registration to new element for future WeakMap lookups
        registry = fieldRegistry;
        columnRegistries.set(element, registry);
      }
    }

    const hasRenderer = registry?.renderer !== undefined;
    const hasEditor = registry?.editor !== undefined;
    return registry !== undefined && (hasRenderer || hasEditor);
  }

  /**
   * Creates a view renderer function that renders a React component
   * and returns its container DOM element.
   *
   * Uses a cell cache to reuse portals for performance - instead of
   * creating new portals on each render, we reuse existing ones and
   * update their content.
   *
   * Returns undefined if no renderer is registered for this element,
   * allowing the grid to use its default rendering.
   */
  createRenderer<TRow = unknown, TValue = unknown>(element: HTMLElement): ColumnViewRenderer<TRow, TValue> | undefined {
    const renderFn = getColumnRenderer(element);

    if (!renderFn) {
      // Return undefined so the grid uses default rendering
      // This is important when GridColumn only has an editor (no children)
      return undefined;
    }

    // Resolve grid once from the column element (stable in the DOM)
    const gridEl = element.closest('tbw-grid') as HTMLElement | null;
    // Cell cache for this field - maps cell element to its portal key + container
    const cellCache = new WeakMap<HTMLElement, CellPortalCache>();
    return (ctx: CellRenderContext<TRow, TValue>) => {
      // Get the cell element from context (if available)
      const cellEl = (ctx as any).cellEl as HTMLElement | undefined;

      if (cellEl) {
        // Check if we have a cached portal for this cell
        const cached = cellCache.get(cellEl);
        if (cached) {
          if (cellEl.contains(cached.container)) {
            // Reuse existing portal - update element synchronously
            renderToContainer(cached.container, renderFn(ctx as CellRenderContext<unknown, unknown>), cached.portalKey);
            return cached.container;
          }
          // Container was detached (typically by editor-injection's cell wipe).
          // Tear down the stale React root synchronously before creating a
          // fresh one — otherwise the orphan throws `removeChild` on the
          // next user-triggered React commit (issue #250).
          removeFromContainer(cached.portalKey, { sync: true });
          this.untrackPortal(cached.portalKey);
          cellCache.delete(cellEl);
        }

        // Create new container and portal for this cell
        const container = document.createElement('div');
        container.className = 'react-cell-renderer';
        container.style.display = 'contents';

        const portalKey = renderToContainer(
          container,
          renderFn(ctx as CellRenderContext<unknown, unknown>),
          undefined,
          gridEl ?? undefined,
        );

        // Cache for reuse
        cellCache.set(cellEl, { portalKey, container });
        this.trackPortal(portalKey, container, false);

        return container;
      }

      // Fallback: no cellEl in context, create new container each time
      const container = document.createElement('div');
      container.className = 'react-cell-renderer';
      container.style.display = 'contents';

      const portalKey = renderToContainer(
        container,
        renderFn(ctx as CellRenderContext<unknown, unknown>),
        undefined,
        gridEl ?? undefined,
      );
      this.trackPortal(portalKey, container, false);

      return container;
    };
  }

  /**
   * Creates an editor spec that renders a React component
   * with commit/cancel callbacks passed as props.
   */
  createEditor<TRow = unknown, TValue = unknown>(element: HTMLElement): ColumnEditorSpec<TRow, TValue> {
    const editorFn = getColumnEditor(element);

    if (!editorFn) {
      return () => document.createElement('div');
    }

    // Resolve grid once from the column element (stable in the DOM)
    const gridEl = (element.closest('tbw-grid') as HTMLElement | null) ?? undefined;

    return (ctx: ColumnEditorContext<TRow, TValue>) => {
      // Create container for React
      const container = document.createElement('div');
      container.className = 'react-cell-editor';
      container.style.display = 'contents';

      const portalKey = renderToContainer(
        container,
        editorFn(ctx as ColumnEditorContext<unknown, unknown>),
        undefined,
        gridEl,
      );

      // Track for cleanup (editor-specific for per-cell cleanup via releaseCell)
      this.trackPortal(portalKey, container, true);

      // Run editor-mount hooks (e.g. `before-edit-close` blur bridge installed
      // by `@toolbox-web/grid-react/features/editing`). Each hook's teardown
      // is bundled into a single function stored alongside the portal key so
      // `untrackPortal` releases all editor lifecycle work at once.
      if (gridEl) {
        this.editorBeforeCloseUnsubs.set(portalKey, notifyEditorMounted(container, gridEl));
      }

      return container;
    };
  }

  /**
   * Creates a detail renderer function for MasterDetailPlugin.
   * Implementation is installed by `@toolbox-web/grid-react/features/master-detail`
   * via {@link registerDetailRendererBridge}. Returns undefined if the
   * master-detail feature has not been imported, or if no GridDetailPanel
   * was registered for this grid.
   */
  createDetailRenderer<TRow = unknown>(
    gridElement: HTMLElement,
  ): ((row: TRow, rowIndex: number) => HTMLElement) | undefined {
    return detailRendererBridge?.<TRow>(gridElement, this.bridgeContext);
  }

  /**
   * Framework adapter hook called by MasterDetailPlugin during attach().
   * Parses the <tbw-grid-detail> element and returns a React-based renderer.
   */
  parseDetailElement<TRow = unknown>(
    detailElement: Element,
  ): ((row: TRow, rowIndex: number) => HTMLElement | string) | undefined {
    const gridElement = detailElement.closest('tbw-grid') as HTMLElement | null;
    if (!gridElement) return undefined;

    return this.createDetailRenderer<TRow>(gridElement);
  }

  /**
   * Creates a responsive card renderer function for ResponsivePlugin.
   * Implementation is installed by `@toolbox-web/grid-react/features/responsive`
   * via {@link registerResponsiveCardRendererBridge}. Returns undefined if
   * the responsive feature has not been imported, or if no GridResponsiveCard
   * was registered for this grid.
   */
  createResponsiveCardRenderer<TRow = unknown>(
    gridElement: HTMLElement,
  ): ((row: TRow, rowIndex: number) => HTMLElement) | undefined {
    return responsiveCardRendererBridge?.<TRow>(gridElement, this.bridgeContext);
  }

  /**
   * FrameworkAdapter hook called by ResponsivePlugin during attach().
   * Parses the `<tbw-grid-responsive-card>` element and delegates to
   * {@link createResponsiveCardRenderer}. Needed for parity with the Vue
   * and Angular adapters so ResponsivePlugin's standard lookup path works
   * for React users as well, not just via the imperative
   * `refreshResponsiveCardRenderer` hook in DataGrid.
   */
  parseResponsiveCardElement<TRow = unknown>(
    cardElement: Element,
  ): ((row: TRow, rowIndex: number) => HTMLElement) | undefined {
    const gridElement = cardElement.closest('tbw-grid') as HTMLElement | null;
    if (!gridElement) return undefined;

    return this.createResponsiveCardRenderer<TRow>(gridElement);
  }

  /**
   * Creates a tool panel renderer from a light DOM element.
   * Renders React components into tool panel containers.
   */
  createToolPanelRenderer(element: HTMLElement): ((container: HTMLElement) => void | (() => void)) | undefined {
    const renderFn = getToolPanelRenderer(element);

    if (!renderFn) {
      return undefined;
    }

    const gridElement = element.closest('tbw-grid') as DataGridElement | null;

    return (container: HTMLElement) => {
      const ctx: ToolPanelContext = {
        grid: gridElement ?? (container as DataGridElement),
      };

      const portalKey = renderToContainer(container, renderFn(ctx), undefined, gridElement ?? undefined);
      this.trackPortal(portalKey, container, false);

      // Return cleanup function — sync removal ensures React fully unmounts
      // portal content before the shell clears the container (innerHTML = '').
      return () => {
        removeFromContainer(portalKey, { sync: true });
        this.untrackPortal(portalKey);
      };
    };
  }

  /**
   * Gets type-level defaults from the type defaults map.
   *
   * This enables application-wide type defaults configured via GridTypeProvider.
   * The returned TypeDefault contains renderer/editor functions that render
   * React components into the grid's cells.
   *
   * @example
   * ```tsx
   * // App.tsx
   * const typeDefaults = {
   *   country: {
   *     renderer: (ctx) => <CountryBadge code={ctx.value} />,
   *     editor: (ctx) => <CountrySelect value={ctx.value} onCommit={ctx.commit} />
   *   }
   * };
   *
   * <GridTypeProvider defaults={typeDefaults}>
   *   <App />
   * </GridTypeProvider>
   *
   * // Any grid with type: 'country' columns will use these components
   * ```
   */
  getTypeDefault<TRow = unknown>(type: string, gridEl?: HTMLElement): TypeDefault<TRow> | undefined {
    if (!this.typeDefaults) {
      return undefined;
    }

    // TypeDefault stored in registry uses unknown since it's framework-agnostic storage.
    // We cast to TRow for type-safe usage at consumption time.
    const reactDefault = this.typeDefaults[type] as ReactTypeDefault<TRow> | undefined;
    if (!reactDefault) {
      return undefined;
    }

    const typeDefault: TypeDefault<TRow> = {
      editorParams: reactDefault.editorParams,
    };

    // Create renderer function that renders React component
    if (reactDefault.renderer) {
      typeDefault.renderer = this.createTypeRenderer<TRow>(reactDefault.renderer, gridEl);
    }

    // Create editor function that renders React component
    if (reactDefault.editor) {
      // Type assertion needed: adapter bridges TRow to core's unknown
      typeDefault.editor = this.createTypeEditor<TRow>(reactDefault.editor, gridEl) as TypeDefault['editor'];
    }

    // Create filterPanelRenderer function that renders React component into filter panel.
    // Implementation is installed by `@toolbox-web/grid-react/features/filtering`
    // via {@link registerFilterPanelTypeDefaultBridge}. Without that import,
    // type-default filter panels are dropped silently (filtering itself also
    // requires the feature import, so this is not a new precondition).
    if (reactDefault.filterPanelRenderer && filterPanelTypeDefaultBridge) {
      typeDefault.filterPanelRenderer = filterPanelTypeDefaultBridge(
        reactDefault.filterPanelRenderer,
        gridEl,
        this.bridgeContext,
      );
    }

    return typeDefault;
  }

  /**
   * Creates a renderer function from a React render function for type defaults.
   * @internal
   */
  private createTypeRenderer<TRow = unknown, TValue = unknown>(
    renderFn: (ctx: CellRenderContext<TRow, TValue>) => ReactNode,
    gridEl?: HTMLElement,
  ): ColumnViewRenderer<TRow, TValue> {
    return (ctx: CellRenderContext<TRow, TValue>) => {
      const container = document.createElement('span');
      container.style.display = 'contents';

      // Resolve grid from cellEl (in-DOM) first, then fall back to the gridEl captured at getTypeDefault time
      const resolvedGrid = (ctx.cellEl?.closest('tbw-grid') as HTMLElement | null) ?? gridEl;
      const portalKey = renderToContainer(container, renderFn(ctx) as React.ReactElement, undefined, resolvedGrid);
      this.trackPortal(portalKey, container, false);

      return container;
    };
  }

  /**
   * Creates an editor function from a React render function for type defaults.
   * @internal
   */
  private createTypeEditor<TRow = unknown, TValue = unknown>(
    renderFn: (ctx: ColumnEditorContext<TRow, TValue>) => ReactNode,
    gridEl?: HTMLElement,
  ): ColumnEditorSpec<TRow, TValue> {
    return (ctx: ColumnEditorContext<TRow, TValue>) => {
      const container = document.createElement('span');
      container.style.display = 'contents';

      // Editor context has no cellEl — use the gridEl captured at getTypeDefault time
      const portalKey = renderToContainer(container, renderFn(ctx) as React.ReactElement, undefined, gridEl);
      // Track in editor-specific set for per-cell cleanup via releaseCell
      this.trackPortal(portalKey, container, true);

      return container;
    };
  }

  // #region Portal tracking helpers

  /**
   * Stable bridge context handed to feature installers. Bound once per adapter
   * so feature bridges can call `trackPortal` without each invocation creating
   * a fresh closure.
   */
  private readonly bridgeContext: FeatureBridgeContext = {
    trackPortal: (key, container, isEditor) => this.trackPortal(key, container, isEditor),
  };

  /** Register a portal key for lifecycle tracking. */
  private trackPortal(key: string, container: HTMLElement, isEditor: boolean): void {
    this.allPortalKeys.add(key);
    this.keyToContainer.set(key, container);
    this.containerToKey.set(container, key);
    if (isEditor) {
      this.editorPortalKeys.add(key);
    }
  }

  /** Unregister a portal key from all tracking sets. */
  private untrackPortal(key: string): void {
    this.allPortalKeys.delete(key);
    this.editorPortalKeys.delete(key);
    const container = this.keyToContainer.get(key);
    this.keyToContainer.delete(key);
    if (container) this.containerToKey.delete(container);
    const unsub = this.editorBeforeCloseUnsubs.get(key);
    if (unsub) {
      unsub();
      this.editorBeforeCloseUnsubs.delete(key);
    }
  }

  // #endregion

  /**
   * Clean up all mounted portals.
   * Call this when the grid is unmounted.
   */
  destroy(): void {
    // Remove only this adapter's tracked portals, not all grids' portals
    for (const key of this.allPortalKeys) {
      removeFromContainer(key);
    }
    this.allPortalKeys.clear();
    this.editorPortalKeys.clear();
    this.keyToContainer.clear();
    for (const unsub of this.editorBeforeCloseUnsubs.values()) unsub();
    this.editorBeforeCloseUnsubs.clear();
    fieldRegistries.clear();
  }

  /**
   * Called when a cell's content is about to be wiped.
   *
   * Destroys editor portals AND renderer portals whose container is inside
   * the cell. Releasing renderers here is critical: the editing pipeline
   * runs `cell.innerHTML = ''` immediately after this returns, which
   * silently detaches React-managed renderer containers from the DOM.
   * If we leave the React root mounted, its fiber tree still believes
   * the now-orphaned children are present — a subsequent React commit
   * (e.g. the user's `onCellCommit` → `setRows`) tries to `removeChild`
   * those gone nodes and throws `NotFoundError` (issue #250).
   *
   * Calling this BEFORE the wipe lets React unmount cleanly while DOM
   * still matches its fiber tree. The `wrapReactRenderer` cache will
   * detect the missing entry on the next render and create a fresh
   * container — see the cache-validation defense in `createRenderer`
   * and `wrapReactRenderer` (`react-column-config.ts`).
   *
   * Also cleans up config-based editor and renderer roots
   * (from processGridConfig/wrapReactEditor/wrapReactRenderer) that
   * bypass the adapter's own portal tracking.
   */
  releaseCell(cellEl: HTMLElement): void {
    // Resolve only the portal containers actually inside this cell — avoids
    // an O(total portals) scan per cell teardown, which the core can call
    // many times during a render. Scoped DOM query is O(cell descendants),
    // typically O(1) (a cell has 0–1 portal containers).
    const containers = cellEl.querySelectorAll<HTMLElement>('.react-cell-renderer, .react-cell-editor');
    for (const container of containers) {
      const key = this.containerToKey.get(container);
      if (!key) continue;
      removeFromContainer(key, { sync: true });
      this.untrackPortal(key);
    }
    // Clean up config-based editor + renderer roots (wrapReactEditor /
    // wrapReactRenderer in react-column-config.ts)
    cleanupConfigRootsIn(cellEl);
  }

  /**
   * Unmount a specific container (called when cell is recycled).
   */
  unmount(container: HTMLElement): void {
    const key = this.containerToKey.get(container);
    if (key) {
      removeFromContainer(key);
      this.untrackPortal(key);
    }
  }
}
