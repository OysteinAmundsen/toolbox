/**
 * Tests for TbwGridDetailPanel SFC wrapper.
 *
 * Covers the slot-registration behavior of the shell:
 * - mounts a `<tbw-grid-detail>` element with the configured props
 * - registers the default slot renderer into `detailRegistry` on mount
 * - early-returns when no default slot is provided (no registry entry)
 * - the registered renderer forwards the slot context unchanged
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h, type App } from 'vue';
import TbwGridDetailPanel from './TbwGridDetailPanel.vue';
import { detailRegistry, type DetailPanelContext } from './detail-panel-registry';

describe('TbwGridDetailPanel.vue', () => {
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

  function mount(slot?: (ctx: DetailPanelContext) => unknown) {
    const slots = slot ? { default: slot } : {};
    app = createApp(defineComponent({ render: () => h(TbwGridDetailPanel, null, slots) }));
    app.mount(container);
    return container.querySelector('tbw-grid-detail') as HTMLElement;
  }

  it('mounts a <tbw-grid-detail> element', () => {
    const el = mount();
    expect(el).not.toBeNull();
  });

  it('forwards default props to the underlying element', () => {
    const el = mount();
    // withDefaults: showExpandColumn=true, animation='slide'
    expect(el.getAttribute('show-expand-column')).not.toBeNull();
    expect(el.getAttribute('animation')).toBe('slide');
  });

  it('does NOT register a renderer when no default slot is provided', () => {
    const el = mount();
    expect(detailRegistry.get(el)).toBeUndefined();
  });

  it('registers the default slot renderer on mount', () => {
    const el = mount((ctx) => h('div', { 'data-row-index': ctx.rowIndex }, JSON.stringify(ctx.row)));
    const renderer = detailRegistry.get(el);
    expect(renderer).toBeTypeOf('function');
  });

  it('the registered renderer receives the slot context', () => {
    const seen: DetailPanelContext[] = [];
    const el = mount((ctx) => {
      seen.push(ctx);
      return h('div');
    });
    const renderer = detailRegistry.get(el);
    renderer?.({ row: { id: 7, name: 'x' }, rowIndex: 3 });
    expect(seen).toEqual([{ row: { id: 7, name: 'x' }, rowIndex: 3 }]);
  });
});
