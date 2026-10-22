import { afterEach, describe, expect, it } from 'vitest';

import { isFormFieldKeyTarget } from './form-field-target';

/** Dispatches a keydown from `el` and evaluates the helper while the event is in flight. */
function checkFrom(el: Element): boolean {
  let result: boolean | undefined;
  const listener = (e: Event) => (result = isFormFieldKeyTarget(e));
  document.body.addEventListener('keydown', listener);
  el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true }));
  document.body.removeEventListener('keydown', listener);
  return result!;
}

describe('isFormFieldKeyTarget', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each(['input', 'select', 'textarea'])('is true for <%s>', (tag) => {
    const el = document.body.appendChild(document.createElement(tag));
    expect(checkFrom(el)).toBe(true);
  });

  it('is true for a contenteditable element', () => {
    const el = document.body.appendChild(document.createElement('div'));
    el.contentEditable = 'true';
    expect(checkFrom(el)).toBe(true);
  });

  it('is false for a non-editable element', () => {
    const el = document.body.appendChild(document.createElement('div'));
    el.tabIndex = 0;
    expect(checkFrom(el)).toBe(false);
  });

  it('sees an input inside an open shadow root (event.target is retargeted to the host)', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const input = host.attachShadow({ mode: 'open' }).appendChild(document.createElement('input'));
    expect(checkFrom(input)).toBe(true);
  });

  it('is false for an event with no target', () => {
    expect(isFormFieldKeyTarget(new KeyboardEvent('keydown', { key: ' ' }))).toBe(false);
  });
});
