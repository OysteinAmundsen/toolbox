/**
 * `[data-field="…"]` attribute selector for any field. Column fields can come from data (Pivot
 * builds `${groupValue}|${valueField}`), so they may hold `"`, `\` or line breaks, which end or
 * break an unescaped quoted value and make `querySelectorAll` throw.
 *
 * Those characters are written as CSS hex escapes with a terminating space (`"` → `\22 `). That
 * is plain CSS string syntax, accepted by browsers and happy-dom alike; `\"` and `CSS.escape`
 * (an identifier escape, `\32 4` for a leading digit) are rejected by happy-dom inside quotes.
 *
 * @param field - Column field
 * @returns Attribute selector matching `data-field` exactly
 */
export function dataFieldSelector(field: string): string {
  return `[data-field="${field.replace(/["\\\n\r\f]/g, (ch) => `\\${ch.charCodeAt(0).toString(16)} `)}"]`;
}
