/**
 * Tests for TbwGridResponsiveCard SFC wrapper.
 *
 * Covers the slot-registration behavior of the shell:
 * - mounts a `<tbw-grid-responsive-card>` element with `card-row-height`
 *   mirrored from the prop (default `'auto'`, or a numeric override)
 * - registers the default slot renderer into `cardRegistry` on mount
 * - early-returns when no default slot is provided
 * - the registered renderer forwards the slot context unchanged
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h, type App } from 'vue';
import TbwGridResponsiveCard from './TbwGridResponsiveCard.vue';
import { cardRegistry, type ResponsiveCardContext } from './responsive-card-registry';

describe('TbwGridResponsiveCard.vue', () => {
  let container: HTMLElement;
  let app: App | null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    app = null;
  });

  afterEach(() => {
    app?.unmount();
    container.remove();
  });

  function mount(opts: { cardRowHeight?: number | 'auto'; slot?: (ctx: ResponsiveCardContext) => unknown } = {}) {
    const { cardRowHeight, slot } = opts;
    const props = cardRowHeight !== undefined ? { cardRowHeight } : {};
    const slots = slot ? { default: slot } : {};
    app = createApp(defineComponent({ render: () => h(TbwGridResponsiveCard, props, slots) }));
    app.mount(container);
    return container.querySelector('tbw-grid-responsive-card') as HTMLElement;
  }

  it('mounts with default cardRowHeight="auto"', () => {
    const el = mount();
    expect(el.getAttribute('card-row-height')).toBe('auto');
  });

  it('mirrors a numeric cardRowHeight prop onto the element', () => {
    const el = mount({ cardRowHeight: 96 });
    expect(el.getAttribute('card-row-height')).toBe('96');
  });

  it('does NOT register a renderer when no default slot is provided', () => {
    const el = mount();
    expect(cardRegistry.get(el)).toBeUndefined();
  });

  it('registers the default slot renderer on mount', () => {
    const el = mount({ slot: (ctx) => h('div', null, String(ctx.rowIndex)) });
    expect(cardRegistry.get(el)).toBeTypeOf('function');
  });

  it('the registered renderer receives the slot context', () => {
    const seen: ResponsiveCardContext[] = [];
    const el = mount({
      slot: (ctx) => {
        seen.push(ctx);
        return h('div');
      },
    });
    cardRegistry.get(el)?.({ row: { id: 1 }, rowIndex: 0 });
    expect(seen).toEqual([{ row: { id: 1 }, rowIndex: 0 }]);
  });
});
