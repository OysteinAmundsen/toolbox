/**
 * Column shorthand parsing for `@toolbox-web/grid`.
 *
 * Lives in core (issue #276) so declarative light-DOM configs
 * (`<tbw-grid-column field="price:number">`, `<tbw-grid columns='["id:number","name"]'>`)
 * and every framework adapter share ONE implementation. The three adapters
 * (`grid-react`, `grid-vue`, `grid-angular`) re-export these helpers instead
 * of maintaining byte-drifting copies.
 *
 * Exported from `libs/grid/src/public.ts` as part of the public API.
 */
import type { ColumnConfig } from '../types';

// #region Column Shorthand

/**
 * Type for column shorthand notation.
 *
 * Supports:
 * - Simple string: `'name'` → `{ field: 'name', header: 'Name' }`
 * - With type: `'salary:number'` → `{ field: 'salary', header: 'Salary', type: 'number' }`
 * - Full config object: `{ field: 'id', header: 'ID', width: 80 }` (passed through)
 *
 * @example
 * ```ts
 * // All equivalent:
 * const cols1 = ['id', 'name', 'email'];
 * const cols2 = ['id:number', 'name:string', 'email'];
 * const cols3 = [{ field: 'id' }, { field: 'name' }, { field: 'email' }];
 * ```
 * @since 3.0.0
 */
export type ColumnShorthand<TRow = unknown> = string | ColumnConfig<TRow>;

/** Capitalize the first letter of a string for header generation. */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate a human-readable header from a field name.
 *
 * Handles camelCase, snake_case, and kebab-case.
 *
 * @example
 * generateHeader('firstName') → 'First Name'
 * generateHeader('last_name') → 'Last Name'
 * generateHeader('email-address') → 'Email Address'
 * generateHeader('id') → 'ID' (special case)
 */
function generateHeader(field: string): string {
  if (field.toLowerCase() === 'id') return 'ID';

  const words = field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .split(' ')
    .filter(Boolean);

  return words.map(capitalize).join(' ');
}

/** Valid column types from the shorthand notation. */
const VALID_TYPES = new Set(['string', 'number', 'boolean', 'date', 'datetime', 'currency']);

/**
 * Parse a column shorthand string into a ColumnConfig.
 *
 * Supports formats:
 * - `'fieldName'` → `{ field: 'fieldName', header: 'Field Name' }`
 * - `'fieldName:type'` → `{ field: 'fieldName', header: 'Field Name', type: 'type' }`
 *
 * The `:type` suffix is only split off when it names a recognized primitive
 * type; otherwise the whole string is treated as the field name.
 *
 * @param shorthand - The shorthand string (e.g., 'name', 'salary:number')
 * @returns A ColumnConfig object
 * @since 3.0.0
 */
export function parseColumnShorthand<TRow = unknown>(shorthand: string): ColumnConfig<TRow> {
  const colonIndex = shorthand.lastIndexOf(':');

  if (colonIndex > 0) {
    const potentialType = shorthand.slice(colonIndex + 1).toLowerCase();

    if (VALID_TYPES.has(potentialType)) {
      const field = shorthand.slice(0, colonIndex);
      return {
        field: field as keyof TRow & string,
        header: generateHeader(field),
        type: potentialType as ColumnConfig['type'],
      };
    }
  }

  return {
    field: shorthand as keyof TRow & string,
    header: generateHeader(shorthand),
  };
}

/**
 * Normalize an array of column shorthands to ColumnConfig objects. Strings are
 * expanded via {@link parseColumnShorthand}; objects pass through untouched.
 *
 * @param columns - Array of column shorthands (strings or ColumnConfig objects)
 * @returns Array of ColumnConfig objects
 * @since 3.0.0
 */
export function normalizeColumns<TRow = unknown>(columns: ColumnShorthand<TRow>[]): ColumnConfig<TRow>[] {
  return columns.map((col) => (typeof col === 'string' ? parseColumnShorthand<TRow>(col) : col));
}

/**
 * Apply column defaults to a list of columns. Individual column properties
 * override defaults — the per-column value always wins over the default.
 *
 * @param columns - Normalized columns to merge defaults into
 * @param defaults - Partial column config applied as a baseline; pass `undefined` to no-op
 * @returns A new array with the defaults merged in (input is not mutated)
 * @since 3.0.0
 */
export function applyColumnDefaults<TRow = unknown>(
  columns: ColumnConfig<TRow>[],
  defaults: Partial<ColumnConfig<TRow>> | undefined,
): ColumnConfig<TRow>[] {
  if (!defaults) return columns;
  return columns.map((col) => ({ ...defaults, ...col }));
}

/**
 * Check if an array of columns contains any shorthand strings.
 *
 * @param columns - Array to check
 * @returns True if any element is a string shorthand
 * @since 3.0.0
 */
export function hasColumnShorthands<TRow>(columns: ColumnShorthand<TRow>[]): boolean {
  return columns.some((col) => typeof col === 'string');
}

// #endregion
