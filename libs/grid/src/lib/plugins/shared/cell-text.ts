/**
 * Displayed text of a body cell, excluding a custom `loadingRenderer` overlay that lives inside
 * the cell (`aria-hidden` does not remove it from `textContent`). Only text and element children
 * are read, matching `textContent`, which skips comment nodes (e.g. Angular's anchors).
 * @internal
 */
export function readCellDisplayText(cell: HTMLElement): string {
  const loader = cell.querySelector(':scope > .tbw-cell-loading-overlay');
  if (!loader) return cell.textContent?.trim() ?? '';
  let text = '';
  for (const node of cell.childNodes) {
    if (node === loader) continue;
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) text += node.textContent ?? '';
  }
  return text.trim();
}
