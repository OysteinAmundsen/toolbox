/**
 * Tests for TbwGridToolPanel SFC wrapper.
 *
 * Covers:
 * - mounts a `<tbw-grid-tool-panel>` with id/title/icon/position/width
 *   forwarded to the underlying element
 * - `resolvedTitle` three-way fallback: `title` wins, then `label`
 *   (deprecated), else empty string
 * - registers the default slot renderer into `toolPanelRegistry` on mount
 * - early-returns when no default slot is provided
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h, type App } from 'vue';
import TbwGridToolPanel from './TbwGridToolPanel.vue';
import { toolPanelRegistry, type ToolPanelContext } from './tool-panel-registry';

describe('TbwGridToolPanel.vue', () => {
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

  function mount(props: Record<string, unknown>, slot?: (ctx: ToolPanelContext) => unknown) {
    const slots = slot ? { default: slot } : {};
    app = createApp(defineComponent({ render: () => h(TbwGridToolPanel, props, slots) }));
    app.mount(container);
    return container.querySelector('tbw-grid-tool-panel') as HTMLElement;
  }

  describe('resolvedTitle fallback chain', () => {
    it('uses `title` when provided', () => {
      const el = mount({ id: 'p1', title: 'Filters', label: 'IGNORED' });
      expect(el.getAttribute('title')).toBe('Filters');
    });

    it('falls back to `label` when `title` is undefined', () => {
      const el = mount({ id: 'p1', label: 'Legacy Label' });
      expect(el.getAttribute('title')).toBe('Legacy Label');
    });

    it('resolves to empty string when neither is provided', () => {
      const el = mount({ id: 'p1' });
      expect(el.getAttribute('title')).toBe('');
    });
  });

  describe('default props', () => {
    it('mounts with default position="right" and width="250px"', () => {
      const el = mount({ id: 'p1' });
      expect(el.getAttribute('position')).toBe('right');
      expect(el.getAttribute('width')).toBe('250px');
    });

    it('forwards id and icon to the underlying element', () => {
      const el = mount({ id: 'my-panel', icon: '<svg/>' });
      expect(el.getAttribute('id')).toBe('my-panel');
      expect(el.getAttribute('icon')).toBe('<svg/>');
    });
  });

  describe('slot registration', () => {
    it('does NOT register a renderer when no default slot is provided', () => {
      const el = mount({ id: 'p1' });
      expect(toolPanelRegistry.get(el)).toBeUndefined();
    });

    it('registers the default slot renderer on mount', () => {
      const el = mount({ id: 'p1' }, () => h('div'));
      expect(toolPanelRegistry.get(el)).toBeTypeOf('function');
    });

    it('the registered renderer receives the slot context', () => {
      const seen: ToolPanelContext[] = [];
      const el = mount({ id: 'p1' }, (ctx) => {
        seen.push(ctx);
        return h('div');
      });
      const grid = document.createElement('tbw-grid');
      toolPanelRegistry.get(el)?.({ gridElement: grid });
      expect(seen).toHaveLength(1);
      expect(seen[0].gridElement).toBe(grid);
    });
  });
});
