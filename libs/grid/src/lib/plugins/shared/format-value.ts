/**
 * Call a column `format` outside the core cell pipeline (filter-panel labels, Pivot aggregates).
 *
 * Some of these values have no source row — `valuesHandler` results and Pivot aggregates — so
 * `row` is `undefined` there even though `format` is typed `(value, row: TRow)`. A formatter
 * that reads the row then throws; this guard reports the error and lets the caller fall back
 * to the raw value, mirroring the core cell pipeline (TBW062).
 *
 * @returns The formatted string (`''` for a nullish result), or `undefined` when `format` threw.
 * @internal
 */
export function tryFormat<TRow>(
  format: (value: unknown, row: TRow) => unknown,
  value: unknown,
  row: TRow | undefined,
  onError: (error: unknown) => void,
): string | undefined {
  try {
    // `row` is only undefined where no source row exists (see above); the catch covers it.
    const formatted = format(value, row as TRow);
    return formatted == null ? '' : String(formatted);
  } catch (error) {
    onError(error);
    return undefined;
  }
}
