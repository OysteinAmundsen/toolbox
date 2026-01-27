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
 * ```tsx
 * // All equivalent:
 * columns={['id', 'name', 'email']}
 * columns={['id:number', 'name:string', 'email']}
 * columns={[{ field: 'id' }, { field: 'name' }, { field: 'email' }]}
 * ```
 */
export type ColumnShorthand<TRow = unknown> = string | ColumnConfig<TRow>;

/**
 * Capitalize the first letter of a string for header generation.
 *
 * @example
 * capitalize('name') → 'Name'
 * capitalize('firstName') → 'FirstName'  // Note: doesn't add spaces
 */
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
  // Special cases
  if (field.toLowerCase() === 'id') return 'ID';

  // Split on camelCase, snake_case, or kebab-case
  const words = field
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase → camel Case
    .replace(/[_-]/g, ' ') // snake_case/kebab-case → words
    .split(' ')
    .filter(Boolean);

  return words.map(capitalize).join(' ');
}

/**
 * Valid column types from the shorthand notation.
 */
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
 *
 * @example
 * parseColumnShorthand('name') → { field: 'name', header: 'Name' }
 * parseColumnShorthand('salary:number') → { field: 'salary', header: 'Salary', type: 'number' }
 */
export function parseColumnShorthand<TRow = unknown>(shorthand: string): ColumnConfig<TRow> {
  const colonIndex = shorthand.lastIndexOf(':');

  // Check if there's a type suffix
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

  // No type suffix, just field name
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
 *
 * @example
 * ```tsx
 * normalizeColumns(['id:number', 'name', { field: 'email', width: 200 }])
 * // Returns:
 * // [
 * //   { field: 'id', header: 'ID', type: 'number' },
 * //   { field: 'name', header: 'Name' },
 * //   { field: 'email', width: 200 }
 * // ]
 * ```
 */
export function normalizeColumns<TRow = unknown>(columns: ColumnShorthand<TRow>[]): ColumnConfig<TRow>[] {
  return columns.map((col) => {
    if (typeof col === 'string') {
      return parseColumnShorthand<TRow>(col);
    }
    return col;
  });
}

/**
 * Check if an array of columns contains any shorthand strings.
 *
 * @param columns - Array to check
 * @returns True if any element is a string shorthand
 */
export function hasColumnShorthands<TRow>(columns: ColumnShorthand<TRow>[]): boolean {
  return columns.some((col) => typeof col === 'string');
}
