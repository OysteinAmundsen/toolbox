/**
 * True when a keyboard event originates in a text-entry control — `<input>`, `<select>`,
 * `<textarea>` or a contenteditable element. Plugin key handlers (e.g. Space to toggle a tree
 * row) must defer to the control so the keystroke is typed rather than swallowed.
 *
 * Reads `composedPath()[0]` so controls inside an editor's open shadow root are recognised;
 * `event.target` is retargeted to the shadow host by the time the grid sees the event.
 * @internal
 */
export function isFormFieldKeyTarget(event: Event): boolean {
  const path = event.composedPath?.() ?? [];
  const target = path.length ? path[0] : event.target;
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target.isContentEditable;
}
