/**
 * Spec for the React adapter's column *header* renderer registries.
 *
 * `<GridColumn headerRenderer>` / `headerLabelRenderer` register React render
 * props against the `<tbw-grid-column>` element; the core calls
 * `adapter.createHeaderRenderer(el)` at column-parse time. Vue reached parity
 * first via slots — this spec locks the React side in.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import {
  getColumnHeaderLabelRenderer,
  getColumnHeaderRenderer,
  GridAdapter,
  registerColumnHeaderLabelRenderer,
  registerColumnHeaderRenderer,
} from './react-grid-adapter';

function makeColumnEl(field?: string): HTMLElement {
  const el = document.createElement('tbw-grid-column');
  if (field) el.setAttribute('field', field);
  return el;
}

describe('react header renderer registries', () => {
  it('returns undefined when nothing is registered', () => {
    const el = makeColumnEl('name');
    expect(getColumnHeaderRenderer(el)).toBeUndefined();
    expect(getColumnHeaderLabelRenderer(el)).toBeUndefined();
  });

  it('round-trips a headerRenderer through the element registry', () => {
    const el = makeColumnEl('name');
    const render = () => null;
    registerColumnHeaderRenderer(el, render);
    expect(getColumnHeaderRenderer(el)).toBe(render);
  });

  it('round-trips a headerLabelRenderer through the element registry', () => {
    const el = makeColumnEl('name');
    const render = () => null;
    registerColumnHeaderLabelRenderer(el, render);
    expect(getColumnHeaderLabelRenderer(el)).toBe(render);
  });

  it('falls back to the field registry for a re-created element', () => {
    const first = makeColumnEl('salary');
    const render = () => null;
    registerColumnHeaderRenderer(first, render);

    // React may unmount and re-create the host element; the field fallback
    // keeps the renderer discoverable.
    const second = makeColumnEl('salary');
    expect(getColumnHeaderRenderer(second)).toBe(render);
  });

  it('canHandle() reports true once a header renderer is registered', () => {
    const adapter = new GridAdapter();
    const el = makeColumnEl('department');
    expect(adapter.canHandle(el)).toBe(false);

    registerColumnHeaderRenderer(el, () => null);
    expect(adapter.canHandle(el)).toBe(true);
  });

  it('createHeaderRenderer/createHeaderLabelRenderer return undefined without a registration', () => {
    const adapter = new GridAdapter();
    const el = makeColumnEl('unregistered-field');
    expect(adapter.createHeaderRenderer(el)).toBeUndefined();
    expect(adapter.createHeaderLabelRenderer(el)).toBeUndefined();
  });
});
