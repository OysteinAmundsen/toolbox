/**
 * Column shorthand parsing for `@toolbox-web/grid-angular`.
 *
 * Intentionally duplicated across the React, Vue, and Angular adapters so each
 * adapter has zero shared-runtime dependency. Do not extract into a shared
 * package: the helpers are tiny (~100 lines), the duplication keeps each
 * adapter independently tree-shakeable, and a shared package would force
 * consumers to install an extra dep just to import shorthand support.
 *
 * If you change behavior here, mirror the change in `grid-react` and
 * `grid-vue`. The three implementations are kept byte-equivalent.
 */
import type { ColumnConfig } from '@toolbox-web/grid';

/**
 * Type for column shorthand notation.
 *
 * Supports:
 * - Simple string: `'name'` → `{ field: 'name', header: 'Name' }`
 * - With type: `'salary:number'` → `{ field: 'salary', header: 'Salary', type: 'number' }`
 * - Full config object: `{ field: 'id', header: 'ID', width: 80 }` (passed through)
 *
 * @example
 * ```typescript
 * // All equivalent:
 * const cols1 = ['id', 'name', 'email'];
 * const cols2 = ['id:number', 'name:string', 'email'];
 * const cols3 = [{ field: 'id' }, { field: 'name' }, { field: 'email' }];
 * ```
 * @since 1.4.0
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
 * @param shorthand - The shorthand string (e.g., 'name', 'salary:number')
 * @returns A ColumnConfig object
 * @since 1.4.0
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
 * Normalize an array of column shorthands to ColumnConfig objects.
 *
 * @param columns - Array of column shorthands (strings or ColumnConfig objects)
 * @returns Array of ColumnConfig objects
 * @since 1.4.0
 */
export function normalizeColumns<TRow = unknown>(columns: ColumnShorthand<TRow>[]): ColumnConfig<TRow>[] {
  return columns.map((col) => (typeof col === 'string' ? parseColumnShorthand<TRow>(col) : col));
}

/**
 * Apply column defaults to a list of columns. Individual column properties
 * override defaults.
 * @since 1.4.0
 */
export function applyColumnDefaults<TRow = unknown>(
  columns: ColumnConfig<TRow>[],
  defaults: Partial<ColumnConfig<TRow>> | undefined,
): ColumnConfig<TRow>[] {
  if (!defaults) return columns;
  return columns.map((col) => ({ ...defaults, ...col }));
}

/** Check if an array of columns contains any shorthand strings. * @since 1.4.0
 */
export function hasColumnShorthands<TRow>(columns: ColumnShorthand<TRow>[]): boolean {
  return columns.some((col) => typeof col === 'string');
}
