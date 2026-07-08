import { createApp, defineComponent, h, type App } from 'vue';
import TbwGridType from './TbwGridType.vue';
import { clearFieldRegistries, getTypeEditor, getTypeRenderer } from './vue-grid-adapter';
describe('TbwGridType.vue', () => {
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
    props: Record<string, unknown> = { name: 'currency' },
    slots: Record<string, (props: unknown) => unknown> = {},
  ) {
    app = createApp(defineComponent({ render: () => h(TbwGridType, props, slots) }));
    app.mount(container);
    return container.querySelector('tbw-grid-type') as HTMLElement;
  }
  describe('prop forwarding', () => {
    it('renders a tbw-grid-type element with the name attribute', () => {
      const el = mount({ name: 'currency' });
      expect(el).not.toBeNull();
      expect(el.getAttribute('name')).toBe('currency');
    });
    it('sets no data-* attributes when params is not provided', () => {
      const el = mount({ name: 'date' });
      const dataAttrs = [...el.attributes].filter((a) => a.name.startsWith('data-'));
      expect(dataAttrs).toHaveLength(0);
    });
    it('converts camelCase param keys to data-kebab-case attributes', () => {
      const el = mount({ name: 'number', params: { decimalPlaces: 2 } });
      expect(el.getAttribute('data-decimal-places')).toBe('2');
    });
    it('converts underscore param keys to data-kebab-case attributes', () => {
      const el = mount({ name: 'number', params: { decimal_places: 3 } });
      expect(el.getAttribute('data-decimal-places')).toBe('3');
    });
    it('coerces boolean and numeric param values to strings', () => {
      const el = mount({ name: 'number', params: { compact: true, decimals: 4 } });
      expect(el.getAttribute('data-compact')).toBe('true');
      expect(el.getAttribute('data-decimals')).toBe('4');
    });
    it('handles multiple params', () => {
      const el = mount({ name: 'currency', params: { symbol: '$', groupSeparator: ',', decimalSep: '.' } });
      expect(el.getAttribute('data-symbol')).toBe('$');
      expect(el.getAttribute('data-group-separator')).toBe(',');
      expect(el.getAttribute('data-decimal-sep')).toBe('.');
    });
  });
  describe('slot registration', () => {
    it('registers nothing when no slots are provided', () => {
      const el = mount({ name: 'text' });
      expect(getTypeRenderer(el)).toBeUndefined();
      expect(getTypeEditor(el)).toBeUndefined();
    });
    it('registers a type renderer when only the #cell slot is provided', () => {
      const el = mount({ name: 'currency' }, { cell: () => h('span', '$') });
      expect(getTypeRenderer(el)).toBeTypeOf('function');
      expect(getTypeEditor(el)).toBeUndefined();
    });
    it('registers a type editor when only the #editor slot is provided', () => {
      const el = mount({ name: 'currency' }, { editor: () => h('input') });
      expect(getTypeEditor(el)).toBeTypeOf('function');
      expect(getTypeRenderer(el)).toBeUndefined();
    });
    it('registers both renderer and editor when both slots are provided', () => {
      const el = mount(
        { name: 'currency' },
        {
          cell: () => h('span', '$'),
          editor: () => h('input'),
        },
      );
      expect(getTypeRenderer(el)).toBeTypeOf('function');
      expect(getTypeEditor(el)).toBeTypeOf('function');
    });
  });
  describe('renderer context bridging', () => {
    it('cell renderer forwards value, row, and column to the slot', () => {
      const seen: Array<{ value: unknown; row: unknown; column: unknown }> = [];
      const el = mount(
        { name: 'currency' },
        {
          cell: (props) => {
            seen.push(props as { value: unknown; row: unknown; column: unknown });
            return h('span');
          },
        },
      );
      const renderer = getTypeRenderer(el)!;
      const column = { field: 'salary' } as never;
      renderer({ value: 100, row: { salary: 100 }, column } as never);
      expect(seen).toHaveLength(1);
      expect(seen[0]).toEqual({ value: 100, row: { salary: 100 }, column });
    });
    it('editor renderer forwards the full editor context to the slot', () => {
      const seen: Array<Record<string, unknown>> = [];
      const el = mount(
        { name: 'currency' },
        {
          editor: (props) => {
            seen.push(props as Record<string, unknown>);
            return h('input');
          },
        },
      );
      const editor = getTypeEditor(el)!;
      const ctx = {
        value: 100,
        row: { salary: 100 },
        column: { field: 'salary' },
        field: 'salary',
        rowId: 'r1',
        commit: () => undefined,
        cancel: () => undefined,
        updateRow: () => undefined,
        onValueChange: () => undefined,
      };
      editor(ctx as never);
      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatchObject({
        value: 100,
        field: 'salary',
        rowId: 'r1',
      });
    });
  });
});
