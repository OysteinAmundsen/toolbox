/**
 * Tests for TbwGridColumn SFC wrapper.
 *
 * Covers the four conditional slot registrations in `onMounted`:
 * - `#cell` slot → `registerColumnRenderer` (verified via `getColumnRenderer`)
 * - `#editor` slot → `registerColumnEditor`
 * - `#header` slot → `registerColumnHeaderRenderer`
 * - `#headerLabel` slot → `registerColumnHeaderLabelRenderer`
 *
 * Also covers prop forwarding to the underlying `<tbw-grid-column>`.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h, type App } from 'vue';
import TbwGridColumn from './TbwGridColumn.vue';
import {
  clearFieldRegistries,
  getColumnEditor,
  getColumnHeaderLabelRenderer,
  getColumnHeaderRenderer,
  getColumnRenderer,
} from './vue-grid-adapter';

describe('TbwGridColumn.vue', () => {
  let container: HTMLElement;
  let app: App | null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    app = null;
    clearFieldRegistries();
  });

  afterEach(() => {
    app?.unmount();
    container.remove();
    clearFieldRegistries();
  });

  function mount(
    props: Record<string, unknown> = { field: 'name' },
    slots: Record<string, (props: unknown) => unknown> = {},
  ) {
    app = createApp(defineComponent({ render: () => h(TbwGridColumn, props, slots) }));
    app.mount(container);
    return container.querySelector('tbw-grid-column') as HTMLElement;
  }

  describe('prop forwarding', () => {
    it('forwards field, header, type, and align', () => {
      const el = mount({ field: 'status', header: 'Status', type: 'enum', align: 'center' });
      expect(el.getAttribute('field')).toBe('status');
      expect(el.getAttribute('header')).toBe('Status');
      expect(el.getAttribute('type')).toBe('enum');
      expect(el.getAttribute('align')).toBe('center');
    });
  });

  describe('slot registration', () => {
    it('registers nothing when no slots are provided', () => {
      const el = mount();
      expect(getColumnRenderer(el)).toBeUndefined();
      expect(getColumnEditor(el)).toBeUndefined();
      expect(getColumnHeaderRenderer(el)).toBeUndefined();
      expect(getColumnHeaderLabelRenderer(el)).toBeUndefined();
    });

    it('registers a cell renderer when #cell slot is provided', () => {
      const el = mount({ field: 'name' }, { cell: () => h('span', 'cell') });
      expect(getColumnRenderer(el)).toBeTypeOf('function');
    });

    it('registers an editor when #editor slot is provided', () => {
      const el = mount({ field: 'name' }, { editor: () => h('input') });
      expect(getColumnEditor(el)).toBeTypeOf('function');
    });

    it('registers a header renderer when #header slot is provided', () => {
      const el = mount({ field: 'name' }, { header: () => h('div', 'hdr') });
      expect(getColumnHeaderRenderer(el)).toBeTypeOf('function');
    });

    it('registers a header-label renderer when #headerLabel slot is provided', () => {
      const el = mount({ field: 'name' }, { headerLabel: () => h('span', 'lbl') });
      expect(getColumnHeaderLabelRenderer(el)).toBeTypeOf('function');
    });

    it('registers all four when all slots are provided', () => {
      const el = mount(
        { field: 'name' },
        {
          cell: () => h('span'),
          editor: () => h('input'),
          header: () => h('div'),
          headerLabel: () => h('span'),
        },
      );
      expect(getColumnRenderer(el)).toBeTypeOf('function');
      expect(getColumnEditor(el)).toBeTypeOf('function');
      expect(getColumnHeaderRenderer(el)).toBeTypeOf('function');
      expect(getColumnHeaderLabelRenderer(el)).toBeTypeOf('function');
    });
  });

  describe('renderer context bridging', () => {
    it('cell renderer forwards value/row/column to the slot', () => {
      const seen: Array<{ value: unknown; row: unknown; column: unknown }> = [];
      const el = mount(
        { field: 'name' },
        {
          cell: (props) => {
            seen.push(props as { value: unknown; row: unknown; column: unknown });
            return h('span');
          },
        },
      );
      const renderer = getColumnRenderer(el)!;
      const column = { field: 'name' } as never;
      renderer({ value: 'Alice', row: { name: 'Alice' }, column } as never);
      expect(seen).toEqual([{ value: 'Alice', row: { name: 'Alice' }, column }]);
    });

    it('editor renderer forwards the full editor context', () => {
      const seen: Array<Record<string, unknown>> = [];
      const el = mount(
        { field: 'name' },
        {
          editor: (props) => {
            seen.push(props as Record<string, unknown>);
            return h('input');
          },
        },
      );
      const editor = getColumnEditor(el)!;
      const ctx = {
        value: 'A',
        row: { name: 'A' },
        column: { field: 'name' },
        field: 'name',
        rowId: 'r1',
        commit: () => undefined,
        cancel: () => undefined,
        updateRow: () => undefined,
        onValueChange: () => undefined,
      };
      editor(ctx as never);
      expect(seen[0]).toMatchObject({ value: 'A', field: 'name', rowId: 'r1' });
    });

    it('header renderer forwards sort/filter context and helpers', () => {
      const seen: Array<Record<string, unknown>> = [];
      const el = mount(
        { field: 'name' },
        {
          header: (props) => {
            seen.push(props as Record<string, unknown>);
            return h('div');
          },
        },
      );
      const cellEl = document.createElement('div');
      const renderSortIcon = () => document.createElement('span');
      const renderFilterButton = () => document.createElement('button');
      getColumnHeaderRenderer(el)!({
        column: { field: 'name' },
        value: 'Name',
        sortState: 'asc',
        filterActive: true,
        cellEl,
        renderSortIcon,
        renderFilterButton,
      } as never);
      expect(seen[0]).toMatchObject({ value: 'Name', sortState: 'asc', filterActive: true });
      expect(seen[0].cellEl).toBe(cellEl);
    });

    it('headerLabel renderer forwards column and value only', () => {
      const seen: Array<Record<string, unknown>> = [];
      const el = mount(
        { field: 'name' },
        {
          headerLabel: (props) => {
            seen.push(props as Record<string, unknown>);
            return h('span');
          },
        },
      );
      getColumnHeaderLabelRenderer(el)!({ column: { field: 'name' }, value: 'Name' } as never);
      expect(seen[0]).toEqual({ column: { field: 'name' }, value: 'Name' });
    });
  });
});
