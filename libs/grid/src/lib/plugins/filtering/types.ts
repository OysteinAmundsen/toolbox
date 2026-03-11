/**
 * Filtering Plugin Types
 *
 * Type definitions for the filtering feature.
 */

import type { ColumnConfig } from '../../core/types';

// #region Module Augmentation
// When this plugin is imported, ColumnConfig is augmented with filtering-specific properties
declare module '../../core/types' {
  interface BaseColumnConfig {
    /**
     * Whether this column can be filtered (only applicable when FilteringPlugin is enabled).
     * @default true
     */
    filterable?: boolean;

    /**
     * Configuration for the filter UI (only applicable when FilteringPlugin is enabled).
     * For number columns: { min, max, step }
     * For date columns: { min, max } (ISO date strings)
     * Falls back to editorParams if not set.
     */
    filterParams?: FilterParams;

    /**
     * Custom value extractor for filtering. Use this when the cell value is
     * a complex type (e.g., an array of objects) and the filter should operate
     * on derived primitive values instead.
     *
     * The function receives the raw cell value and the full row, and should
     * return either a single filterable value or an array of filterable values.
     * When an array is returned, each element becomes an individual entry in
     * the filter panel's unique values list. During filtering:
     *
     * - **`notIn`** (set filter): row is hidden if ANY extracted value is in the excluded set
     * - **`in`** (set filter): row passes if ANY extracted value is in the included set
     *
     * @example
     * ```typescript
     * // Array-of-objects column: extract individual names for filtering
     * {
     *   field: 'sellers',
     *   filterValue: (value) =>
     *     (value as { companyName: string }[])?.map(s => s.companyName) ?? [],
     *   format: (value) => (value as { companyName: string }[])?.map(s => s.companyName).join(', ') ?? '',
     * }
     * ```
     */
    filterValue?: (value: unknown, row: any) => unknown | unknown[];
  }

  interface TypeDefault {
    /**
     * Custom filter panel renderer for this type. Requires FilteringPlugin.
     *
     * Use type-level filter panels when you need custom filtering UI for all
     * columns of a specific type (e.g., custom datepickers for all date columns).
     *
     * The renderer receives the container element and `FilterPanelParams` with
     * helper methods for applying filters. Return nothing; append content to container.
     *
     * **Resolution Priority**: Plugin `filterPanelRenderer` → Type `filterPanelRenderer` → Built-in
     *
     * @example
     * ```typescript
     * // All 'date' columns use a custom filter panel with your datepicker
     * typeDefaults: {
     *   date: {
     *     filterPanelRenderer: (container, params) => {
     *       const picker = new MyDateRangePicker();
     *       picker.onApply = (from, to) => {
     *         params.applyTextFilter('between', from, to);
     *       };
     *       picker.onClear = () => params.clearFilter();
     *       container.appendChild(picker);
     *     }
     *   }
     * }
     * ```
     *
     * @see FilterPanelParams for available methods (applySetFilter, applyTextFilter, clearFilter, closePanel)
     */
    filterPanelRenderer?: FilterPanelRenderer;
  }

  // Extend ColumnState to include filter state for persistence
  interface ColumnState {
    /**
     * Filter state for this column (only present when FilteringPlugin is used).
     * Stores the essential filter properties without the redundant 'field'.
     */
    filter?: {
      type: 'text' | 'number' | 'date' | 'set' | 'boolean';
      operator: string;
      value: unknown;
      valueTo?: unknown;
    };
  }

  interface GridConfig {
    /**
     * Grid-wide filtering toggle. Requires `FilteringPlugin` to be loaded.
     *
     * When `false`, disables filtering for all columns regardless of their individual `filterable` setting.
     * When `true` (default), columns with `filterable: true` (or not explicitly set to false) can be filtered.
     *
     * This affects:
     * - Filter button visibility in headers
     * - Filter panel accessibility
     * - Filter keyboard shortcuts
     *
     * @default true
     *
     * @example
     * ```typescript
     * // Disable all filtering at runtime
     * grid.gridConfig = { ...grid.gridConfig, filterable: false };
     *
     * // Re-enable filtering
     * grid.gridConfig = { ...grid.gridConfig, filterable: true };
     * ```
     */
    filterable?: boolean;
  }

  interface PluginNameMap {
    filtering: import('./FilteringPlugin').FilteringPlugin;
  }
}
// #endregion

/**
 * Filter parameters for configuring the filter panel UI.
 * These settings control the filter input constraints.
 */
export interface FilterParams {
  /** Minimum value for number/date filters */
  min?: number | string;
  /** Maximum value for number/date filters */
  max?: number | string;
  /** Step value for number range slider */
  step?: number;
  /** Placeholder text for text inputs */
  placeholder?: string;
}
// #endregion

/**
 * The category of filter applied to a column, which determines the available
 * {@link FilterOperator operators} and the filter panel UI rendered.
 *
 * | Type | Panel UI | Compatible operators |
 * |------|----------|---------------------|
 * | `'text'` | Text input with operator dropdown | `contains`, `notContains`, `equals`, `notEquals`, `startsWith`, `endsWith`, `blank`, `notBlank` |
 * | `'number'` | Range slider with min/max inputs | `lessThan`, `lessThanOrEqual`, `greaterThan`, `greaterThanOrEqual`, `between`, `blank`, `notBlank` |
 * | `'date'` | Date pickers (from/to) | Same as `'number'` |
 * | `'set'` | Checkbox list of unique values | `in`, `notIn`, `blank`, `notBlank` |
 * | `'boolean'` | Checkbox list (`true` / `false` / `(Blank)`) | `in`, `notIn`, `blank`, `notBlank` |
 *
 * The grid auto-detects the filter type from the column's `type` property.
 * Override by setting `filter.type` explicitly in the {@link FilterModel}.
 */
export type FilterType = 'text' | 'number' | 'date' | 'set' | 'boolean';

/**
 * Filter operators used in {@link FilterModel} to define how a cell value is compared
 * against the filter value. Operators are grouped by the column types they apply to.
 *
 * **Multiple filters** on different columns use AND logic — a row must match all active filters.
 *
 * ---
 *
 * ## Text operators (`FilterType: 'text'`)
 *
 * Compare cell values as strings. **Case-insensitive by default** (controlled by `FilterConfig.caseSensitive`).
 * Non-string cell values are coerced via `String()` before comparison.
 *
 * | Operator | Matches when | Example: filter = `"lic"` |
 * |--|--|--|
 * | `contains` | Cell value includes the filter as a substring | `"Alice"` ✓, `"Bob"` ✗ |
 * | `notContains` | Cell value does **not** include the filter substring | `"Bob"` ✓, `"Alice"` ✗ |
 * | `equals` | Cell value exactly equals the filter (after case normalization) | `"lic"` ✓, `"Alice"` ✗ |
 * | `notEquals` | Cell value does **not** equal the filter | `"Alice"` ✓, `"lic"` ✗ |
 * | `startsWith` | Cell value begins with the filter | filter `"Al"` → `"Alice"` ✓ |
 * | `endsWith` | Cell value ends with the filter | filter `"ce"` → `"Alice"` ✓ |
 *
 * **When to use:**
 * - `contains` — the default for free-text search fields; most intuitive for users
 * - `equals` — when filtering on exact known values (e.g. status codes)
 * - `startsWith` / `endsWith` — for prefix/suffix matching (e.g. file extensions, area codes)
 * - `notContains` / `notEquals` — exclusion filters ("show everything except...")
 *
 * ---
 *
 * ## Blank operators (`FilterType: all`)
 *
 * These work universally across all filter types and check for **empty** values.
 * They are evaluated first, before any type-specific logic.
 *
 * | Operator | Matches when | Does NOT match |
 * |--|--|--|
 * | `blank` | Cell is `null`, `undefined`, or `""` (empty string) | `0`, `false`, `NaN` |
 * | `notBlank` | Cell has any non-null, non-empty value | `null`, `undefined`, `""` |
 *
 * **When to use:**
 * - `blank` — find rows with missing data (e.g. "show incomplete records")
 * - `notBlank` — exclude rows with missing data (e.g. "show only filled records")
 *
 * ---
 *
 * ## Numeric / date operators (`FilterType: 'number' | 'date'`)
 *
 * Compare values numerically. An internal `toNumeric()` conversion handles:
 * - Numbers → used directly
 * - `Date` objects → converted via `.getTime()` (milliseconds since epoch)
 * - ISO date strings (e.g. `"2025-03-11"`) → parsed as `Date`, then `.getTime()`
 * - Unparseable values → `NaN`, which fails all comparisons (row excluded)
 *
 * | Operator | Matches when (`cell` vs `filter.value`) |
 * |--|--|
 * | `lessThan` | `cell < value` |
 * | `lessThanOrEqual` | `cell <= value` |
 * | `greaterThan` | `cell > value` |
 * | `greaterThanOrEqual` | `cell >= value` |
 * | `between` | `value <= cell <= valueTo` (inclusive both ends) |
 *
 * The `between` operator requires both `filter.value` (min) and `filter.valueTo` (max).
 * In the built-in UI:
 * - **Number panels** render a dual-thumb range slider with min/max inputs
 * - **Date panels** render "From" and "To" date pickers
 *
 * **When to use:**
 * - `between` — range filters (age 25–35, dates in Q1, prices $10–$50)
 * - `greaterThan` / `lessThan` — open-ended thresholds ("salary above 100k")
 * - `greaterThanOrEqual` / `lessThanOrEqual` — inclusive thresholds
 *
 * ---
 *
 * ## Set operators (`FilterType: 'set' | 'boolean'`)
 *
 * Filter by inclusion/exclusion against a set of discrete values. The built-in filter panel
 * shows a checkbox list of unique values; unchecked items form the excluded set.
 *
 * `filter.value` is an `unknown[]` array containing the set of values.
 *
 * | Operator | Matches when | Typical use |
 * |--|--|--|
 * | `notIn` | Cell value is **not** in the excluded array | Default for checkbox lists — unchecked items are excluded |
 * | `in` | Cell value **is** in the included array | Explicit inclusion ("show only these") |
 *
 * **Blank handling:** Blank cells (`null`, `undefined`, `""`) are represented by the
 * sentinel `BLANK_FILTER_VALUE` (`"(Blank)"`) in the values array. The panel renders a
 * "(Blank)" checkbox; its checked/unchecked state controls whether blank rows are shown.
 *
 * **With `filterValue` extractor:** When a column defines `filterValue` to extract multiple
 * values from a complex cell (e.g. an array of objects):
 * - `notIn` — row is hidden if **any** extracted value is in the excluded set
 * - `in` — row passes if **any** extracted value is in the included set
 * - Empty extraction (no values) is treated as a blank cell
 *
 * **When to use:**
 * - `notIn` — the default for set/boolean filters; maps naturally to "uncheck to hide"
 * - `in` — when programmatically setting a filter to show only specific values
 *
 * ---
 *
 * ## Operator–type compatibility quick reference
 *
 * | Operator | text | number | date | set | boolean |
 * |--|:--:|:--:|:--:|:--:|:--:|
 * | `contains` | ✓ | | | | |
 * | `notContains` | ✓ | | | | |
 * | `equals` | ✓ | | | | |
 * | `notEquals` | ✓ | | | | |
 * | `startsWith` | ✓ | | | | |
 * | `endsWith` | ✓ | | | | |
 * | `blank` | ✓ | ✓ | ✓ | ✓ | ✓ |
 * | `notBlank` | ✓ | ✓ | ✓ | ✓ | ✓ |
 * | `lessThan` | | ✓ | ✓ | | |
 * | `lessThanOrEqual` | | ✓ | ✓ | | |
 * | `greaterThan` | | ✓ | ✓ | | |
 * | `greaterThanOrEqual` | | ✓ | ✓ | | |
 * | `between` | | ✓ | ✓ | | |
 * | `in` | | | | ✓ | ✓ |
 * | `notIn` | | | | ✓ | ✓ |
 *
 * @example
 * ```typescript
 * // Text: free-text search on name column
 * { field: 'name', type: 'text', operator: 'contains', value: 'alice' }
 *
 * // Number: salary above 100k
 * { field: 'salary', type: 'number', operator: 'greaterThan', value: 100000 }
 *
 * // Date: hired in Q1 2025
 * { field: 'hireDate', type: 'date', operator: 'between', value: '2025-01-01', valueTo: '2025-03-31' }
 *
 * // Set: show only Engineering and Sales departments
 * { field: 'department', type: 'set', operator: 'in', value: ['Engineering', 'Sales'] }
 *
 * // Set: hide specific statuses (checkbox-style exclusion)
 * { field: 'status', type: 'set', operator: 'notIn', value: ['Inactive', 'Archived'] }
 *
 * // Blank: find rows missing an email
 * { field: 'email', type: 'text', operator: 'blank', value: '' }
 * ```
 */
export type FilterOperator =
  // Text operators
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  // Blank operators (work with all filter types)
  | 'blank'
  | 'notBlank'
  // Number/Date operators
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'between'
  // Set operators
  | 'in'
  | 'notIn';

/** Filter model representing a single filter condition */
export interface FilterModel {
  /** The field/column to filter on */
  field: string;
  /** The type of filter */
  type: FilterType;
  /** The filter operator */
  operator: FilterOperator;
  /** The filter value (type depends on operator) */
  value: unknown;
  /** Secondary value for 'between' operator */
  valueTo?: unknown;
}

/**
 * Parameters passed to a custom {@link FilterPanelRenderer} when the filter panel
 * opens for a column. Provides all the state and action callbacks needed to build
 * a fully custom filter UI.
 *
 * The object is created fresh each time the panel opens and captures the current
 * filter state for the column. Use the action methods (`applySetFilter`,
 * `applyTextFilter`, `clearFilter`, `closePanel`) to drive filtering — they
 * handle state updates, re-rendering, and panel lifecycle automatically.
 *
 * **Resolution priority** for filter panel renderers:
 * 1. Plugin-level `filterPanelRenderer` (in `FilterConfig`)
 * 2. Type-level `filterPanelRenderer` (in `typeDefaults`)
 * 3. Built-in default panel (checkbox set filter, number range, or date range)
 *
 * Returning `undefined` from a plugin-level renderer falls through to the next
 * level, so you can override only specific columns/fields while keeping defaults
 * for the rest.
 *
 * **Framework adapters** wrap this for idiomatic usage:
 * - **Angular**: Extend `BaseFilterPanel` — params are available as a signal input.
 * - **React**: Use a single-argument `(params) => ReactNode` signature.
 * - **Vue**: Use a single-argument `(params) => VNode` signature.
 *
 * @example
 * ```typescript
 * // Vanilla: radio-button filter for a "status" column, default for everything else
 * new FilteringPlugin({
 *   filterPanelRenderer: (container, params) => {
 *     if (params.field !== 'status') return undefined; // fall through to default
 *
 *     const options = ['All', ...params.uniqueValues.map(String)];
 *     options.forEach(opt => {
 *       const label = document.createElement('label');
 *       label.style.display = 'block';
 *       const radio = document.createElement('input');
 *       radio.type = 'radio';
 *       radio.name = 'status';
 *       radio.checked = opt === 'All' && params.excludedValues.size === 0;
 *       radio.addEventListener('change', () => {
 *         if (opt === 'All') params.clearFilter();
 *         else params.applySetFilter(
 *           params.uniqueValues.filter(v => String(v) !== opt) as unknown[]
 *         );
 *       });
 *       label.append(radio, ` ${opt}`);
 *       container.appendChild(label);
 *     });
 *   },
 * });
 * ```
 *
 * @example
 * ```typescript
 * // React: custom slider filter via single-argument signature
 * <DataGrid
 *   filtering={{
 *     filterPanelRenderer: (params) => (
 *       <MySliderFilter
 *         min={0} max={100}
 *         currentFilter={params.currentFilter}
 *         onApply={(min, max) => params.applyTextFilter('between', min, max)}
 *         onClear={() => params.clearFilter()}
 *       />
 *     ),
 *   }}
 * />
 * ```
 */
export interface FilterPanelParams {
  /**
   * The field name (column key) being filtered.
   * Matches {@link ColumnConfig.field} — use it to conditionally render
   * different UIs for different columns in a shared renderer.
   */
  field: string;

  /**
   * The full column configuration for the filtered column.
   * Useful for reading `column.type`, `column.filterParams`, `column.header`,
   * or any other column metadata to tailor the filter panel UI.
   */
  column: ColumnConfig;

  /**
   * All unique values present in the current dataset for this field,
   * sorted and de-duplicated. For columns with a `filterValue` extractor,
   * these are the extracted/flattened values (not the raw cell values).
   *
   * When a `valuesHandler` is provided in the plugin config, this array
   * contains the values returned by the handler instead of locally-extracted ones.
   *
   * Typical use: render checkboxes, radio buttons, or a searchable list.
   */
  uniqueValues: unknown[];

  /**
   * Currently excluded values for set-type (`notIn`) filters.
   * An empty `Set` means no values are excluded (i.e., all values are shown).
   *
   * Use this to restore checkbox/toggle states when the panel re-opens.
   * A value present in this set should appear **unchecked** in a set filter UI.
   */
  excludedValues: Set<unknown>;

  /**
   * The current search text the user has typed into the filter panel's
   * search input (if any). Persisted across panel open/close cycles for
   * the same field. Defaults to `''` when no search has been performed.
   *
   * Use this to pre-populate a search box if your custom panel includes one.
   */
  searchText: string;

  /**
   * The currently active {@link FilterModel} for this field, or `undefined`
   * if no filter is applied. Inspect this to reflect the active filter state
   * in your UI (e.g., highlight the active operator, show the current value).
   *
   * @example
   * ```typescript
   * if (params.currentFilter?.operator === 'between') {
   *   minInput.value = String(params.currentFilter.value);
   *   maxInput.value = String(params.currentFilter.valueTo);
   * }
   * ```
   */
  currentFilter?: FilterModel;

  /**
   * Apply a **set filter** (`notIn` operator) that excludes the given values.
   * Rows whose field value is in `excludedValues` will be hidden.
   *
   * Calling this automatically closes the panel and triggers a filter-change event.
   *
   * Pass an empty array to clear the set filter (show all values).
   *
   * @param excludedValues - Array of values to exclude.
   * @param valueTo - Optional metadata stored alongside the filter
   *   (e.g., a label, date range, or selected category). Accessible later
   *   via `FilterModel.valueTo` in the `filter-change` event or `currentFilter`.
   *
   * @example
   * ```typescript
   * // Exclude "Inactive" and "Archived" statuses
   * params.applySetFilter(['Inactive', 'Archived']);
   *
   * // Exclude everything except the selected value
   * const excluded = params.uniqueValues.filter(v => v !== selectedValue);
   * params.applySetFilter(excluded as unknown[]);
   * ```
   */
  applySetFilter: (excludedValues: unknown[], valueTo?: unknown) => void;

  /**
   * Apply a **text, number, or date filter** with the given operator and value(s).
   *
   * Calling this automatically closes the panel and triggers a filter-change event.
   *
   * @param operator - The filter operator to apply (e.g., `'contains'`,
   *   `'greaterThan'`, `'between'`). See {@link FilterOperator} for all options.
   * @param value - The primary filter value.
   * @param valueTo - Secondary value required by the `'between'` operator
   *   (defines the upper bound of the range).
   *
   * @example
   * ```typescript
   * // Text: contains search
   * params.applyTextFilter('contains', searchInput.value);
   *
   * // Number: range between 10 and 100
   * params.applyTextFilter('between', 10, 100);
   *
   * // Date: after a specific date
   * params.applyTextFilter('greaterThan', '2025-01-01');
   * ```
   */
  applyTextFilter: (operator: FilterOperator, value: string | number, valueTo?: string | number) => void;

  /**
   * Clear the active filter for this field entirely and close the panel.
   * After calling, the column will show all rows (as if no filter was ever applied).
   *
   * Equivalent to removing the field's entry from the filter model.
   */
  clearFilter: () => void;

  /**
   * Close the filter panel **without** applying or clearing any filter.
   * Use this for a "Cancel" / dismiss action where the user abandons changes.
   *
   * Note: `applySetFilter`, `applyTextFilter`, and `clearFilter` already close
   * the panel automatically — you only need `closePanel` for explicit dismiss.
   */
  closePanel: () => void;
}

/** Custom filter panel renderer function. Return undefined to use default panel for this column. */
export type FilterPanelRenderer = (container: HTMLElement, params: FilterPanelParams) => void | undefined;

/**
 * Async handler for fetching unique filter values from a server.
 *
 * For server-side datasets where not all values are available locally,
 * this handler is called when the filter panel opens to fetch all
 * possible values for the column.
 *
 * @param field - The field/column name
 * @param column - The column configuration
 * @returns Promise resolving to array of unique values
 *
 * @example
 * ```ts
 * valuesHandler: async (field, column) => {
 *   const response = await fetch(`/api/distinct/${field}`);
 *   return response.json(); // ['Engineering', 'Marketing', 'Sales', ...]
 * }
 * ```
 */
export type FilterValuesHandler = (field: string, column: ColumnConfig) => Promise<unknown[]>;

/**
 * Async handler for applying filters on a server.
 *
 * For server-side filtering, this handler is called when filters change.
 * It should fetch filtered data from the server and return the new rows.
 * The plugin will replace the grid's rows with the returned data.
 *
 * @param filters - Current active filter models
 * @param currentRows - Current row array (for reference/optimistic updates)
 * @returns Promise resolving to filtered rows
 *
 * @example
 * ```ts
 * filterHandler: async (filters) => {
 *   const params = new URLSearchParams();
 *   filters.forEach(f => params.append(f.field, `${f.operator}:${f.value}`));
 *   const response = await fetch(`/api/data?${params}`);
 *   return response.json();
 * }
 * ```
 */
export type FilterHandler<TRow = unknown> = (filters: FilterModel[], currentRows: TRow[]) => TRow[] | Promise<TRow[]>;

/**
 * Configuration options for the {@link FilteringPlugin}.
 *
 * Pass this object to the `FilteringPlugin` constructor to customize filtering
 * behavior, panel rendering, server-side integration, and state persistence.
 *
 * @typeParam TRow - The row data type. Inferred when using a typed `filterHandler`.
 *
 * @example
 * ```typescript
 * // Basic usage with defaults
 * new FilteringPlugin()
 *
 * // Customized local filtering
 * new FilteringPlugin({
 *   debounceMs: 200,
 *   caseSensitive: true,
 *   trackColumnState: true,
 * })
 *
 * // Server-side filtering with custom values
 * new FilteringPlugin<Employee>({
 *   valuesHandler: async (field) => {
 *     const res = await fetch(`/api/employees/distinct/${field}`);
 *     return res.json();
 *   },
 *   filterHandler: async (filters) => {
 *     const params = new URLSearchParams();
 *     filters.forEach(f => params.append(f.field, `${f.operator}:${f.value}`));
 *     const res = await fetch(`/api/employees?${params}`);
 *     return res.json();
 *   },
 * })
 * ```
 */
export interface FilterConfig<TRow = unknown> {
  /**
   * Debounce delay in milliseconds for the search input inside the default
   * filter panel. Controls how long the panel waits after the user stops
   * typing before re-filtering the unique values list.
   *
   * Lower values feel more responsive but cause more DOM updates.
   * Higher values reduce work for columns with many unique values.
   *
   * @default 300
   *
   * @example
   * ```typescript
   * // Faster response for small datasets
   * new FilteringPlugin({ debounceMs: 100 })
   *
   * // Slower debounce for columns with thousands of unique values
   * new FilteringPlugin({ debounceMs: 500 })
   * ```
   */
  debounceMs?: number;

  /**
   * Whether text-based filtering comparisons are case-sensitive.
   *
   * When `false` (default), `"alice"` matches `"Alice"`, `"ALICE"`, etc.
   * When `true`, only exact case matches pass the filter.
   *
   * Affects both:
   * - The core `filterRows()` logic (text operators like `contains`, `equals`, etc.)
   * - The search input inside the default filter panel (value list filtering)
   *
   * @default false
   *
   * @example
   * ```typescript
   * // Enable case-sensitive filtering
   * new FilteringPlugin({ caseSensitive: true })
   * ```
   */
  caseSensitive?: boolean;

  /**
   * Whether to trim leading/trailing whitespace from filter input values
   * before applying them.
   *
   * @default true
   *
   * @remarks
   * **Reserved for future use.** This option is accepted in configuration
   * but not yet applied in the current filtering implementation.
   */
  trimInput?: boolean;

  /**
   * Whether to offload filtering to a Web Worker for large datasets.
   *
   * @default true
   *
   * @remarks
   * **Reserved for future use.** This option is accepted in configuration
   * but not yet implemented. Filtering currently runs synchronously on
   * the main thread for all dataset sizes. Performance is excellent for
   * most use cases — the grid handles 10,000+ rows without noticeable delay
   * thanks to result caching and debounced input.
   *
   * When implemented, this will automatically offload `filterRows()` to a
   * Web Worker when the row count exceeds an internal threshold, keeping
   * the main thread responsive during heavy filtering operations.
   */
  useWorker?: boolean;

  /**
   * Custom filter panel renderer that replaces the built-in panel content
   * for **all** columns (unless you return `undefined` for specific columns
   * to fall through to the next level).
   *
   * **Resolution priority** (first non-empty result wins):
   * 1. This plugin-level `filterPanelRenderer`
   * 2. Type-level `filterPanelRenderer` (in `gridConfig.typeDefaults[type]`)
   * 3. Built-in panel (checkbox set filter, number range slider, or date picker)
   *
   * The renderer receives the panel container element and a {@link FilterPanelParams}
   * object with state and action callbacks. Append your UI to the container.
   *
   * **Return `undefined`** (or leave the container empty) to fall through to
   * the next resolution level. This lets you override only specific fields.
   *
   * @example
   * ```typescript
   * // Override only the "status" column, use defaults for everything else
   * new FilteringPlugin({
   *   filterPanelRenderer: (container, params) => {
   *     if (params.field !== 'status') return undefined; // fall through
   *
   *     params.uniqueValues.forEach(val => {
   *       const btn = document.createElement('button');
   *       btn.textContent = String(val);
   *       btn.onclick = () => {
   *         const excluded = params.uniqueValues.filter(v => v !== val);
   *         params.applySetFilter(excluded as unknown[]);
   *       };
   *       container.appendChild(btn);
   *     });
   *   },
   * })
   * ```
   *
   * @example
   * ```typescript
   * // Replace ALL filter panels with a custom component
   * new FilteringPlugin({
   *   filterPanelRenderer: (container, params) => {
   *     const myFilter = new MyCustomFilterElement();
   *     myFilter.field = params.field;
   *     myFilter.values = params.uniqueValues;
   *     myFilter.onApply = (excluded) => params.applySetFilter(excluded);
   *     myFilter.onClear = () => params.clearFilter();
   *     container.appendChild(myFilter);
   *   },
   * })
   * ```
   *
   * @see {@link FilterPanelParams} for all available state and action callbacks.
   * @see {@link FilterPanelRenderer} for the function signature.
   */
  filterPanelRenderer?: FilterPanelRenderer;

  /**
   * Whether filter state should be included in column state persistence.
   *
   * When `true`:
   * - `getColumnState()` includes filter data for each column
   * - Filter changes fire the `column-state-change` event (debounced)
   * - `applyColumnState()` restores filter state from a saved snapshot
   *
   * When `false` (default):
   * - Filters are excluded from column state entirely
   * - Filter changes do **not** fire `column-state-change`
   *
   * Enable this when you persist column state (e.g., to localStorage or a server)
   * and want filter selections to survive page reloads.
   *
   * @default false
   *
   * @example
   * ```typescript
   * // Persist filters alongside column order, widths, and sort state
   * new FilteringPlugin({ trackColumnState: true })
   *
   * // Save/restore cycle:
   * const state = grid.getColumnState();   // includes filter data
   * localStorage.setItem('grid-state', JSON.stringify(state));
   * // ... later ...
   * grid.applyColumnState(JSON.parse(localStorage.getItem('grid-state')!));
   * ```
   */
  trackColumnState?: boolean;

  /**
   * Async handler for fetching unique filter values from a server.
   *
   * When provided, this handler is called **each time a filter panel opens**
   * instead of extracting unique values from the locally-loaded rows. The panel
   * shows a loading indicator while the handler resolves.
   *
   * Use this for server-side or paginated datasets where the client only holds
   * a subset of the data and the local unique values would be incomplete.
   *
   * The returned values populate `FilterPanelParams.uniqueValues` and appear
   * in the checkbox list (or are passed to your custom `filterPanelRenderer`).
   *
   * @example
   * ```typescript
   * new FilteringPlugin({
   *   valuesHandler: async (field, column) => {
   *     const res = await fetch(`/api/data/distinct/${field}`);
   *     return res.json(); // ['Engineering', 'Marketing', 'Sales', ...]
   *   },
   * })
   * ```
   *
   * @example
   * ```typescript
   * // Combine with filterHandler for full server-side filtering
   * new FilteringPlugin<Employee>({
   *   valuesHandler: async (field) => {
   *     const res = await fetch(`/api/employees/distinct/${field}`);
   *     return res.json();
   *   },
   *   filterHandler: async (filters) => {
   *     const body = JSON.stringify(filters);
   *     const res = await fetch('/api/employees/filter', { method: 'POST', body });
   *     return res.json();
   *   },
   * })
   * ```
   *
   * @see {@link FilterValuesHandler} for the full type signature.
   */
  valuesHandler?: FilterValuesHandler;

  /**
   * Async handler for delegating filtering to a server.
   *
   * When provided, the plugin's `processRows()` hook becomes a **passthrough**
   * (returns rows unfiltered) and instead calls this handler whenever the
   * active filters change. The handler should return the filtered rows, which
   * replace the grid's current data.
   *
   * This enables full server-side filtering for large datasets that can't be
   * loaded into the browser. The handler receives the complete list of active
   * {@link FilterModel} objects and the current row array (useful for optimistic
   * updates or reference).
   *
   * The handler may return rows synchronously (plain array) or asynchronously
   * (Promise). While an async handler is pending, the grid retains its current
   * rows until the new data arrives.
   *
   * @example
   * ```typescript
   * // Server-side filtering with query params
   * new FilteringPlugin<Employee>({
   *   filterHandler: async (filters, currentRows) => {
   *     const params = new URLSearchParams();
   *     filters.forEach(f => params.append(f.field, `${f.operator}:${f.value}`));
   *     const res = await fetch(`/api/employees?${params}`);
   *     return res.json();
   *   },
   * })
   * ```
   *
   * @example
   * ```typescript
   * // POST-based filtering with full filter models
   * new FilteringPlugin<Product>({
   *   filterHandler: async (filters) => {
   *     const res = await fetch('/api/products/filter', {
   *       method: 'POST',
   *       headers: { 'Content-Type': 'application/json' },
   *       body: JSON.stringify({ filters }),
   *     });
   *     return res.json();
   *   },
   * })
   * ```
   *
   * @see {@link FilterHandler} for the full type signature.
   * @see {@link FilterChangeDetail} for the event emitted after filter changes.
   */
  filterHandler?: FilterHandler<TRow>;
}

/** Internal state managed by the filtering plugin */
export interface FilterState {
  /** Map of field name to filter model */
  filters: Map<string, FilterModel>;
  /** Cached filtered result for performance */
  cachedResult: unknown[] | null;
  /** Cache key for invalidation */
  cacheKey: string | null;
  /** Currently open filter panel field (null if none open) */
  openPanelField: string | null;
  /** Reference to the open filter panel element */
  panelElement: HTMLElement | null;
  /** Current search text per field */
  searchText: Map<string, string>;
  /** Set of excluded values per field (for set filter) */
  excludedValues: Map<string, Set<unknown>>;
}

/** Event detail emitted when filters change */
export interface FilterChangeDetail {
  /** Current active filters */
  filters: FilterModel[];
  /** Number of rows after filtering */
  filteredRowCount: number;
  /**
   * Inclusion map: field → selected (checked) values.
   * Only present for set-type filters. Useful for server-side filtering
   * where sending the selected values is more efficient than sending
   * the excluded values (which is what `filters[].value` contains for `notIn`).
   */
  selected?: Record<string, unknown[]>;
}
