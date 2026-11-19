/**
 * HTML5 drag image for RowDragDropPlugin: a full-row clone for single-row drags
 * (more legible than the handle alone), a count badge for multi-row drags.
 */

/**
 * Set the drag image for a drag of `count` rows started on `rowEl` (from
 * `handle` when the drag began on the grip).
 *
 * The single-row clone is appended off-screen INSIDE `host`, snapshotted by the
 * browser via `setDragImage`, then removed on the next tick. The cursor offset
 * is preserved relative to where the user pressed.
 */
export function setRowDragImage(
  de: DragEvent,
  rowEl: HTMLElement,
  handle: HTMLElement | null,
  host: HTMLElement,
  count: number,
): void {
  const dt = de.dataTransfer;
  if (!dt) return;
  if (count > 1) {
    const badge = document.createElement('div');
    badge.className = 'tbw-row-drag-count';
    badge.textContent = `${count} rows`;
    document.body.appendChild(badge);
    try {
      dt.setDragImage(badge, 10, 10);
    } catch {
      /* ignore */
    }
    setTimeout(() => badge.remove(), 0);
    return;
  }

  const rect = rowEl.getBoundingClientRect();
  const clone = rowEl.cloneNode(true) as HTMLElement;
  clone.classList.add('tbw-row-drag-clone');
  // Strip transient classes that would look wrong in the drag image.
  clone.classList.remove('dragging', 'drop-target', 'drop-before', 'drop-after', 'flip-animating', 'row-focus');
  clone.removeAttribute('aria-selected');
  // Preserve the actual rendered width so cells don't reflow in the snapshot.
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  // The clone MUST stay inside the grid host: every core row/cell rule is
  // scoped under `tbw-grid …` (see core/styles/*.css), and the
  // `--tbw-column-template` custom property is set on the host. If the
  // clone is moved to `document.body`, none of those rules match and the
  // drag image collapses to an empty box. Off-screen positioning via
  // `position: fixed` works the same regardless of the DOM parent.
  host.appendChild(clone);
  // Cursor offset: where the user pressed inside the source row. Falls
  // back to the centre of the handle when initiated from the grip.
  let offsetX = de.clientX - rect.left;
  let offsetY = de.clientY - rect.top;
  if (handle) {
    const handleRect = handle.getBoundingClientRect();
    offsetX = handleRect.left - rect.left + handleRect.width / 2;
    offsetY = handleRect.top - rect.top + handleRect.height / 2;
  }
  // Clamp into the row bounds so the cursor stays inside the drag image.
  offsetX = Math.max(0, Math.min(rect.width, offsetX));
  offsetY = Math.max(0, Math.min(rect.height, offsetY));
  try {
    dt.setDragImage(clone, offsetX, offsetY);
  } catch {
    /* JSDOM/happy-dom: harmless */
  }
  setTimeout(() => clone.remove(), 0);
}
