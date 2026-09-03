/**
 * Column `options` serialization for the declarative `<GridColumn>` API.
 *
 * Mirrored verbatim in `@toolbox-web/grid-vue`. This deliberately does NOT live
 * in `@toolbox-web/grid`: core's `index.js` sits at ~48.4 kB gzipped against a
 * 50 kB hard budget, and no core consumer calls a serializer — only the
 * declarative adapter column components do. See the DECIDED entry in
 * `.github/knowledge/adapters.md`.
 *
 * The format authority is core's `parseLightDomColumns`
 * (`core/internal/columns.ts`), which reads the `options` attribute as CSV
 * (`"admin:Admin,user"`). Keep this function in lockstep with that parser; the
 * round-trip test in `column-options.spec.ts` pins the contract.
 */

/**
 * Select/typeahead options accepted by `<GridColumn options={...} />`.
 *
 * Either bare values (label defaults to the value) or `{ label, value }`
 * pairs. Values and labels are serialized into an attribute, so they must not
 * contain `,` or `:`.
 * @since 2.5.0
 */
export type ColumnOptions = Array<string | number> | Array<{ label: string; value: string | number }>;

/**
 * Flatten {@link ColumnOptions} into the `options` attribute CSV understood by
 * the core column parser. Returns `undefined` for an empty list so the
 * attribute is omitted entirely.
 */
export function serializeColumnOptions(options: ColumnOptions): string | undefined {
  if (options.length === 0) return undefined;
  return options
    .map((option) => {
      if (typeof option === 'string' || typeof option === 'number') return warnIfAmbiguous(String(option));
      const value = warnIfAmbiguous(String(option.value));
      const label = warnIfAmbiguous(option.label);
      return option.label === value ? value : `${value}:${label}`;
    })
    .join(',');
}

/** A `,` or `:` in a value or label silently splits it into extra options. */
function warnIfAmbiguous(part: string): string {
  if (part.includes(',') || part.includes(':')) {
    console.warn(
      `[tbw-grid:column] Option "${part}" contains "," or ":", which the grid's ` +
        `options parser treats as separators. The option list will not round-trip. ` +
        `Use the \`columns\` config instead of the \`options\` prop for such values.`,
    );
  }
  return part;
}
