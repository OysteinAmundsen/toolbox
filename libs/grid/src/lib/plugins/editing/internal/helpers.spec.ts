import { afterEach, describe, expect, it, vi } from 'vitest';
import { isEscapeForOpenOverlay, shouldPreventEditClose } from './helpers';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('shouldPreventEditClose (#558)', () => {
  it('returns false without a callback', () => {
    expect(shouldPreventEditClose({}, new KeyboardEvent('keydown', { key: 'Escape' }))).toBe(false);
  });

  it('consults the callback once per event and reuses the verdict', () => {
    const onBeforeEditClose = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const event = new KeyboardEvent('keydown', { key: 'Escape' });

    expect(shouldPreventEditClose({ onBeforeEditClose }, event)).toBe(true);
    expect(shouldPreventEditClose({ onBeforeEditClose }, event)).toBe(true);
    expect(onBeforeEditClose).toHaveBeenCalledTimes(1);

    // A new event gets a fresh consultation.
    expect(shouldPreventEditClose({ onBeforeEditClose }, new KeyboardEvent('keydown', { key: 'Escape' }))).toBe(false);
    expect(onBeforeEditClose).toHaveBeenCalledTimes(2);
  });

  it('keeps separate verdicts for different callbacks (nested grids)', () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    expect(shouldPreventEditClose({ onBeforeEditClose: () => false }, event)).toBe(true);
    expect(shouldPreventEditClose({ onBeforeEditClose: () => true }, event)).toBe(false);
  });
});

describe('isEscapeForOpenOverlay (#558)', () => {
  function setup(triggerAttrs: Record<string, string>, onWrapper = false) {
    const scope = document.createElement('div');
    const wrapper = document.createElement('div');
    const input = document.createElement('input');
    const panel = document.createElement('div');
    panel.id = 'panel';
    const option = document.createElement('div');
    panel.appendChild(option);
    for (const [k, v] of Object.entries(triggerAttrs)) (onWrapper ? wrapper : input).setAttribute(k, v);
    wrapper.appendChild(input);
    scope.appendChild(wrapper);
    document.body.append(scope, panel);
    return { scope, wrapper, input, option };
  }

  function escapeFrom(target: Element, scope: HTMLElement): { claimed: boolean; event: KeyboardEvent } {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    let claimed = false;
    document.addEventListener('keydown', () => (claimed = isEscapeForOpenOverlay(event, scope)), {
      capture: true,
      once: true,
    });
    target.dispatchEvent(event);
    return { claimed, event };
  }

  it('claims Escape from an expanded control with aria-controls', () => {
    const { scope, input } = setup({ 'aria-expanded': 'true', 'aria-controls': 'panel' });
    expect(escapeFrom(input, scope).claimed).toBe(true);
  });

  it('claims Escape from inside an expanded ancestor (ARIA 1.1 combobox wrapper)', () => {
    const { scope, input } = setup({ 'aria-expanded': 'true', 'aria-controls': 'panel' }, true);
    expect(escapeFrom(input, scope).claimed).toBe(true);
  });

  it('claims Escape from inside the owned panel', () => {
    const { scope, option } = setup({ 'aria-expanded': 'true', 'aria-controls': 'panel' });
    expect(escapeFrom(option, scope).claimed).toBe(true);
  });

  it('claims Escape from inside an owned panel rendered inline beside its trigger', () => {
    const { scope, wrapper, option } = setup({ 'aria-expanded': 'true', 'aria-controls': 'panel' });
    wrapper.appendChild(option.parentElement as HTMLElement);
    expect(escapeFrom(option, scope).claimed).toBe(true);
  });

  it('does not claim Escape when the overlay is closed or not owned', () => {
    const closed = setup({ 'aria-expanded': 'false', 'aria-controls': 'panel' });
    expect(escapeFrom(closed.input, closed.scope).claimed).toBe(false);
    document.body.innerHTML = '';
    const noControls = setup({ 'aria-expanded': 'true' });
    expect(escapeFrom(noControls.input, noControls.scope).claimed).toBe(false);
  });

  it('ignores expanded triggers outside the scope', () => {
    const { scope, input } = setup({});
    const outer = document.createElement('div');
    outer.setAttribute('aria-expanded', 'true');
    outer.setAttribute('aria-controls', 'panel');
    document.body.appendChild(outer);
    outer.appendChild(scope);
    expect(escapeFrom(input, scope).claimed).toBe(false);
  });

  it('remembers the verdict after the overlay closes', () => {
    const { scope, input } = setup({ 'aria-expanded': 'true', 'aria-controls': 'panel' });
    const { event } = escapeFrom(input, scope);
    input.setAttribute('aria-expanded', 'false');
    expect(isEscapeForOpenOverlay(event, scope)).toBe(true);
  });

  it('shares the verdict with nested scopes but not with an unrelated one (other grid)', () => {
    const { scope, wrapper, input } = setup({ 'aria-expanded': 'true', 'aria-controls': 'panel' });
    const { event } = escapeFrom(input, scope);
    const unrelated = document.createElement('div');
    document.body.appendChild(unrelated);

    expect(isEscapeForOpenOverlay(event, wrapper)).toBe(true);
    expect(isEscapeForOpenOverlay(event, unrelated)).toBe(false);
  });
});
