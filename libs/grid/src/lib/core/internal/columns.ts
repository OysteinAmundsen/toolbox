import type { ColumnConfig, ColumnInternal, ElementWithPart, GridHost } from '../types';
import { FitModeEnum } from '../types';
import { parseColumnShorthand } from './column-shorthand';
import { INVALID_COLUMN_WIDTH, warnDiagnostic } from './diagnostics';

// #region Light DOM Parsing
/** Global DataGridElement class (may or may not be registered) */
interface DataGridElementClass {
  getAdapters?: () => readonly {
    canHandle: (el: HTMLElement) => boolean;
    createRenderer: (el: HTMLElement) => ((ctx: unknown) => Node | string | void) | undefined;
    createEditor: (el: HTMLElement) => ((ctx: unknown) => HTMLElement | string) | undefined;
    createHeaderRenderer?: (el: HTMLElement) => ((ctx: unknown) => Node | string | void | null) | undefined;
    createHeaderLabelRenderer?: (el: HTMLElement) => ((ctx: unknown) => Node | string | void | null) | undefined;
  }[];
}

/**
 * Parse `<tbw-grid-column>` elements from the host light DOM into column config objects,
 * capturing template elements for later cloning / compilation.
 */
export function parseLightDomColumns(host: HTMLElement): ColumnInternal[] {
  const domColumns = Array.from(host.querySelectorAll('tbw-grid-column')) as HTMLElement[];
  return domColumns
    .map((el) => {
      const rawField = el.getAttribute('field') || '';
      if (!rawField) return null;
      // Support `field="price:number"` shorthand (issue #276). The suffix is
      // only split off when it names a recognized primitive type. A non-empty
      // `type`/`header` attribute wins over the shorthand-derived value; an
      // empty attribute falls through to the shorthand, matching the truthy
      // (`|| undefined`) checks used elsewhere in this parser.
      const shorthand = rawField.includes(':') ? parseColumnShorthand(rawField) : undefined;
      const field = shorthand?.field ?? rawField;
      // Core does not gate `type` to a fixed allowlist — any string passes
      // through so custom column types (resolved by plugins/typeDefaults)
      // work declaratively. `ColumnConfig.type` is `ColumnType`
      // (`PrimitiveColumnType | (string & {})`), so no cast is needed.
      const type = el.getAttribute('type') || shorthand?.type || undefined;
      const header = el.getAttribute('header') || shorthand?.header || undefined;
      // Treat `attr="false"` as false. Framework adapters (notably Vue)
      // serialize boolean props to string attributes on custom elements,
      // so a Vue template `:sortable="false"` reaches the DOM as
      // `sortable="false"`. Without this guard `hasAttribute('sortable')`
      // would return true and force the column to be sortable.
      const sortable = el.hasAttribute('sortable') && el.getAttribute('sortable') !== 'false';
      // `__element` exposes the originating light-DOM element so plugins can
      // read their own attributes in `processColumns` (issue #272). Core no
      // longer parses plugin-owned attributes such as `editable` (editing),
      // `pinned` (pinned-columns) or `hidden`/`lock-visible` (visibility).
      const config: ColumnInternal = { field, type, header, sortable, __element: el };

      // Parse width attribute (supports px values, percentages, or plain numbers)
      const widthAttr = el.getAttribute('width');
      if (widthAttr) {
        const numericWidth = parseFloat(widthAttr);
        if (!isNaN(numericWidth) && /^\d+(\.\d+)?$/.test(widthAttr.trim())) {
          config.width = numericWidth;
        } else {
          config.width = widthAttr; // e.g. "100px", "20%", "1fr"
        }
      }

      // Parse minWidth attribute (numeric only)
      const minWidthAttr = el.getAttribute('minWidth') || el.getAttribute('min-width');
      if (minWidthAttr) {
        const numericMinWidth = parseFloat(minWidthAttr);
        if (!isNaN(numericMinWidth)) {
          config.minWidth = numericMinWidth;
        }
      }

      // Parse order attribute (non-negative integer only)
      const orderAttr = el.getAttribute('order');
      if (orderAttr) {
        const numericOrder = parseInt(orderAttr, 10);
        if (Number.isFinite(numericOrder) && numericOrder >= 0) {
          config.order = numericOrder;
        }
      }

      if (el.hasAttribute('resizable')) {
        // `resizable` defaults to true at the column level, so an explicit
        // `resizable="false"` (e.g. emitted by Vue's `:resizable="false"`)
        // must propagate as `false` — not be left undefined — or the
        // header renderer will fall back to the default and add a handle.
        config.resizable = el.getAttribute('resizable') !== 'false';
      }

      // Parse options attribute for select/typeahead: "value1:Label1,value2:Label2" or "value1,value2"
      const optionsAttr = el.getAttribute('options');
      if (optionsAttr) {
        config.options = optionsAttr.split(',').map((item) => {
          const [value, label] = item.includes(':') ? item.split(':') : [item.trim(), item.trim()];
          return { value: value.trim(), label: label?.trim() || value.trim() };
        });
      }
      const viewTpl = el.querySelector('tbw-grid-column-view');
      // The editor template is plugin-owned (editing reads it from `__element`)
      // but the framework-adapter editor path below still needs the element.
      const editorTpl = el.querySelector('tbw-grid-column-editor');
      const headerTpl = el.querySelector('tbw-grid-column-header');
      if (viewTpl) config.__viewTemplate = viewTpl as HTMLElement;
      if (headerTpl) config.__headerTemplate = headerTpl as HTMLElement;

      // Check if framework adapters can handle template wrapper elements or the column element itself
      // React adapter registers on the column element, Angular uses inner template wrappers
      const DataGridElementClassRef = (globalThis as { DataGridElement?: DataGridElementClass }).DataGridElement;
      const adapters = DataGridElementClassRef?.getAdapters?.() ?? [];

      // First check inner view template, then column element itself
      const viewTarget = (viewTpl ?? el) as HTMLElement;
      const viewAdapter = adapters.find((a) => a.canHandle(viewTarget));
      if (viewAdapter) {
        // Only assign if adapter returns a truthy renderer
        // Adapters return undefined when only an editor is registered (no view template)
        const renderer = viewAdapter.createRenderer(viewTarget);
        if (renderer) {
          config.viewRenderer = renderer;
        }
      }

      // First check inner editor template, then column element itself
      const editorTarget = (editorTpl ?? el) as HTMLElement;
      const editorAdapter = adapters.find((a) => a.canHandle(editorTarget));
      if (editorAdapter) {
        // Only assign if adapter returns a truthy editor
        const editor = editorAdapter.createEditor(editorTarget);
        if (editor) {
          config.editor = editor;
        }
      }

      // Header (full cell) + header label renderers. Both hooks are
      // optional on the adapter — only Vue's slot-based <TbwGridColumn>
      // currently registers them today, but the API is symmetric so any
      // adapter exposing a template/slot surface for header customization
      // can opt in. Pulls from the column element itself; no inner
      // template wrapper is involved (slot/template lives in the SFC).
      const headerAdapter = adapters.find(
        (a) => a.canHandle(el) && (a.createHeaderRenderer || a.createHeaderLabelRenderer),
      );
      if (headerAdapter) {
        const headerRenderer = headerAdapter.createHeaderRenderer?.(el);
        if (headerRenderer) {
          config.headerRenderer = headerRenderer as ColumnInternal['headerRenderer'];
        }
        const headerLabelRenderer = headerAdapter.createHeaderLabelRenderer?.(el);
        if (headerLabelRenderer) {
          config.headerLabelRenderer = headerLabelRenderer as ColumnInternal['headerLabelRenderer'];
        }
      }

      return config;
    })
    .filter((c): c is ColumnInternal => !!c);
}
// #endregion

// #region Column Ordering
/**
 * Apply initial column ordering based on the `order` property.
 *
 * Reorders columns using a splice-based algorithm: columns without an explicit `order`
 * stay in their relative order, then columns with `order` are inserted (ascending by order value)
 * at their target indices in the final result.
 *
 * @param columns - Column array to reorder (mutated in-place)
 * @returns The mutated columns array (same reference)
 *
 * @example
 * // Columns: [{ field: 'a' }, { field: 'b', order: 0 }, { field: 'c' }]
 * // Result:  [{ field: 'b' }, { field: 'a' }, { field: 'c' }]
 */
export function applyInitialOrder<T>(columns: ColumnInternal<T>[]): ColumnInternal<T>[] {
  // Separate ordered and unordered columns, filtering for finite non-negative integers
  const ordered: Array<{ col: ColumnInternal<T>; order: number }> = [];
  const unordered: ColumnInternal<T>[] = [];

  for (const col of columns) {
    if (typeof col.order === 'number' && Number.isFinite(col.order) && col.order >= 0) {
      ordered.push({ col, order: Math.floor(col.order) });
    } else {
      unordered.push(col);
    }
  }

  if (ordered.length === 0) {
    return columns; // No reordering needed
  }

  // Sort ordered columns by their order value (stable sort, so duplicates preserve declaration order)
  ordered.sort((a, b) => a.order - b.order);

  // Build result: fill indices with unordered columns, then splice ordered at their positions
  const result: ColumnInternal<T>[] = [];
  let unorderedIndex = 0;

  // Process each ordered column and insert it at its target index
  for (const { col, order } of ordered) {
    // Fill up to the target index with unordered columns
    while (result.length < order && unorderedIndex < unordered.length) {
      result.push(unordered[unorderedIndex++]);
    }

    // Insert the ordered column at its target index (clamp to result.length if beyond bounds)
    const insertPos = Math.min(order, result.length);
    result.splice(insertPos, 0, col);
  }

  // Append remaining unordered columns
  while (unorderedIndex < unordered.length) {
    result.push(unordered[unorderedIndex++]);
  }

  // Copy result back to original array
  columns.length = 0;
  columns.push(...result);

  return columns;
}
// #endregion

// #region Column Merging
/**
 * Merge programmatic columns with light DOM columns by field name, allowing DOM-provided
 * attributes / templates to supplement (not overwrite) programmatic definitions.
 * Any DOM columns without a programmatic counterpart are appended.
 * When multiple DOM columns exist for the same field (e.g., separate renderer and editor),
 * their properties are merged together.
 */
export function mergeColumns(
  programmatic: ColumnConfig[] | undefined,
  dom: ColumnConfig[] | undefined,
): ColumnInternal[] {
  if ((!programmatic || !programmatic.length) && (!dom || !dom.length)) return [];
  if (!programmatic || !programmatic.length) return (dom || []) as ColumnInternal[];
  if (!dom || !dom.length) return programmatic as ColumnInternal[];

  // Build domMap by merging multiple DOM columns with the same field
  // This supports React pattern where renderer and editor are in separate GridColumn elements
  const domMap: Record<string, ColumnInternal> = {};
  const domArr = dom as ColumnInternal[];
  for (let i = 0; i < domArr.length; i++) {
    const c = domArr[i];
    const existing = domMap[c.field];
    if (existing) {
      // Merge this column's properties into the existing one
      if (c.header && !existing.header) existing.header = c.header;
      if (c.type && !existing.type) existing.type = c.type;
      if (c.sortable) existing.sortable = true;
      if (c.resizable) existing.resizable = true;
      if (c.width != null && existing.width == null) existing.width = c.width;
      if (c.minWidth != null && existing.minWidth == null) existing.minWidth = c.minWidth;
      if (c.__viewTemplate) existing.__viewTemplate = c.__viewTemplate;
      if (c.__headerTemplate) existing.__headerTemplate = c.__headerTemplate;
      if (c.__element && !existing.__element) existing.__element = c.__element;
      // Support both 'renderer' alias and 'viewRenderer'
      const cRenderer = c.renderer || c.viewRenderer;
      const existingRenderer = existing.renderer || existing.viewRenderer;
      if (cRenderer && !existingRenderer) {
        existing.viewRenderer = cRenderer;
        if (c.renderer) existing.renderer = cRenderer;
      }
      if (c.editor && !existing.editor) existing.editor = c.editor;
      if (c.headerRenderer && !existing.headerRenderer) existing.headerRenderer = c.headerRenderer;
      if (c.headerLabelRenderer && !existing.headerLabelRenderer) existing.headerLabelRenderer = c.headerLabelRenderer;
    } else {
      domMap[c.field] = { ...c };
    }
  }

  const merged: ColumnInternal[] = (programmatic as ColumnInternal[]).map((c) => {
    const d = domMap[c.field];
    if (!d) return c;
    const m: ColumnInternal = { ...c };
    if (d.header && !m.header) m.header = d.header;
    if (d.type && !m.type) m.type = d.type;
    m.sortable = c.sortable || d.sortable;
    if (c.resizable === true || d.resizable === true) m.resizable = true;
    // Merge width/minWidth from DOM if not set programmatically
    if (d.width != null && m.width == null) m.width = d.width;
    if (d.minWidth != null && m.minWidth == null) m.minWidth = d.minWidth;
    if (d.__viewTemplate) m.__viewTemplate = d.__viewTemplate;
    if (d.__headerTemplate) m.__headerTemplate = d.__headerTemplate;
    if (d.__element && !m.__element) m.__element = d.__element;
    // Merge framework adapter renderers/editors from DOM (support both 'renderer' alias and 'viewRenderer')
    const dRenderer = d.renderer || d.viewRenderer;
    const mRenderer = m.renderer || m.viewRenderer;
    if (dRenderer && !mRenderer) {
      m.viewRenderer = dRenderer;
      if (d.renderer) m.renderer = dRenderer;
    }
    if (d.editor && !m.editor) m.editor = d.editor;
    // Header renderers are mutually exclusive: `headerRenderer` (full control) has precedence
    // over `headerLabelRenderer` in `renderHeader`. Only fill from DOM when the programmatic
    // column has neither — otherwise a DOM `headerRenderer` would shadow a programmatic
    // `headerLabelRenderer` (and vice versa).
    if (!m.headerRenderer && !m.headerLabelRenderer) {
      if (d.headerRenderer) m.headerRenderer = d.headerRenderer;
      else if (d.headerLabelRenderer) m.headerLabelRenderer = d.headerLabelRenderer;
    }
    delete domMap[c.field];
    return m;
  });
  const remainingFields = Object.keys(domMap);
  for (let i = 0; i < remainingFields.length; i++) merged.push(domMap[remainingFields[i]]);
  return merged;
}
// #endregion

// #region Part Helpers
/**
 * Safely add a token to an element's `part` attribute (supporting the CSS ::part API)
 * without duplicating values. Falls back to string manipulation if `el.part` API isn't present.
 */
export function addPart(el: HTMLElement, token: string): void {
  try {
    (el as ElementWithPart).part?.add?.(token);
  } catch {
    /* empty */
  }
  const existing = el.getAttribute('part');
  if (!existing) el.setAttribute('part', token);
  else if (!existing.split(/\s+/).includes(token)) el.setAttribute('part', existing + ' ' + token);
}
// #endregion

// #region Auto-Sizing
/**
 * Measure rendered header + visible cell content to assign initial pixel widths
 * to columns when in `content` fit mode. Runs only once unless fit mode changes.
 */
export function autoSizeColumns(grid: GridHost): void {
  const mode = grid.effectiveConfig?.fitMode || grid.fitMode || FitModeEnum.STRETCH;
  // Run for both stretch (to derive baseline pixel widths before fr distribution) and fixed.
  if (mode !== FitModeEnum.STRETCH && mode !== FitModeEnum.FIXED) return;
  if (grid.__didInitialAutoSize) return;
  if (!grid.isConnected) return;
  const headerCells = Array.from(grid._headerRowEl?.children || []) as HTMLElement[];
  if (!headerCells.length) return;
  let changed = false;
  const visibleCols = grid._visibleColumns;
  for (let i = 0; i < visibleCols.length; i++) {
    const col = visibleCols[i] as ColumnInternal;
    if (col.width) continue;
    const headerCell = headerCells[i];
    let max = headerCell ? headerCell.scrollWidth : 0;
    for (let j = 0; j < grid._rowPool.length; j++) {
      const cell = grid._rowPool[j].children[i] as HTMLElement | undefined;
      if (cell) {
        const w = cell.scrollWidth;
        if (w > max) max = w;
      }
    }
    if (max > 0) {
      col.width = max + 2;
      col.__autoSized = true;
      changed = true;
    }
  }
  if (changed) updateTemplate(grid);
  grid.__didInitialAutoSize = true;
}
// #endregion

// #region Template Generation
/**
 * Compute and apply the CSS grid template string that drives column layout.
 * Uses `fr` units for flexible (non user-resized) columns in stretch mode, otherwise
 * explicit pixel widths or auto sizing.
 */
// Valid CSS grid track size patterns: numbers with units (px, %, fr, em, rem, etc.),
// calc(), min-content, max-content, minmax(), fit-content(), auto
const VALID_CSS_WIDTH =
  /^(?:\d+(?:\.\d+)?(?:px|%|fr|em|rem|ch|vw|vh|vmin|vmax)|calc\(.+\)|min-content|max-content|minmax\(.+\)|fit-content\(.+\)|auto)$/i;

/** Resolve a column width to a CSS grid track value. Numbers get `px` appended; strings pass through with a dev-mode validity check. */
function resolveWidth(width: string | number, field?: string): string {
  if (typeof width === 'number') return `${width}px`;
  if (!VALID_CSS_WIDTH.test(width)) {
    warnDiagnostic(
      INVALID_COLUMN_WIDTH,
      `Column '${field ?? '?'}' has an invalid CSS width value: '${width}'. Expected a number (px) or a valid CSS unit string (e.g. '30%', '2fr', 'calc(...)').`,
    );
  }
  return width;
}

export function updateTemplate(grid: GridHost): void {
  // Modes:
  //  - 'stretch': columns with explicit width use that width; columns without width are flexible
  //               Uses minmax(minWidth, maxWidth) when both min/max specified (bounded flex)
  //               Uses minmax(minWidth, 1fr) when only min specified (grows unbounded)
  //               Uses minmax(defaultMin, maxWidth) when only max specified (capped growth)
  //  - 'fixed': columns with explicit width use that width; columns without width use max-content
  const mode = grid.effectiveConfig?.fitMode || grid.fitMode || FitModeEnum.STRETCH;

  if (mode === FitModeEnum.STRETCH) {
    grid._gridTemplate = grid._visibleColumns
      .map((c: ColumnInternal) => {
        if (c.width != null) return resolveWidth(c.width, c.field);
        // Flexible column: pure 1fr unless minWidth specified
        const min = c.minWidth;
        return min != null ? `minmax(${min}px, 1fr)` : '1fr';
      })
      .join(' ')
      .trim();
  } else {
    // fixed mode: explicit pixel widths or max-content for content-based sizing
    grid._gridTemplate = grid._visibleColumns
      .map((c: ColumnInternal) => {
        if (c.width != null) return resolveWidth(c.width, c.field);
        return 'max-content';
      })
      .join(' ');
  }
  grid.style.setProperty('--tbw-column-template', grid._gridTemplate);
}
// #endregion
