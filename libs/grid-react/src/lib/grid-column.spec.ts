/**
 * Tests for GridColumn component.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GridColumn, type GridColumnProps } from './grid-column';
import { getColumnEditor, getColumnRenderer } from './react-grid-adapter';

describe('GridColumn', () => {
  let React: typeof import('react');
  let ReactDOM: typeof import('react-dom/client');

  beforeEach(async () => {
    React = await import('react');
    ReactDOM = await import('react-dom/client');
  });

  let mountedRoots: Array<{ unmount(): void }> = [];

  afterEach(() => {
    for (const root of mountedRoots) root.unmount();
    mountedRoots = [];
    document.body.innerHTML = '';
  });

  async function waitForColumnEl(container: HTMLElement): Promise<HTMLElement> {
    await vi.waitFor(() => {
      expect(container.querySelector('tbw-grid-column')).toBeTruthy();
    });
    return container.querySelector('tbw-grid-column') as HTMLElement;
  }

  async function renderColumn(props: GridColumnProps): Promise<HTMLElement> {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    mountedRoots.push(root);
    root.render(React.createElement(GridColumn, props));
    return waitForColumnEl(container);
  }

  it('omits boolean attributes when their props are not set', async () => {
    const columnEl = await renderColumn({ field: 'name' });
    for (const attr of ['sortable', 'resizable', 'editable', 'hidden', 'lock-visible']) {
      expect(columnEl.hasAttribute(attr)).toBe(false);
    }
  });

  // React 19 removes a custom-element attribute set to `false`; the grid would
  // then read the column as "inherit defaults" instead of an explicit opt-out.
  it('forwards explicit false as attr="false"', async () => {
    const columnEl = await renderColumn({
      field: 'name',
      sortable: false,
      resizable: false,
      editable: false,
      lockVisible: false,
    });
    expect(columnEl.getAttribute('sortable')).toBe('false');
    expect(columnEl.getAttribute('resizable')).toBe('false');
    expect(columnEl.getAttribute('editable')).toBe('false');
    expect(columnEl.getAttribute('lock-visible')).toBe('false');
  });

  it('forwards explicit true and keeps hidden as the native boolean property', async () => {
    const columnEl = await renderColumn({ field: 'name', sortable: true, hidden: false });
    expect(columnEl.getAttribute('sortable')).toBe('true');
    expect(columnEl.hasAttribute('hidden')).toBe(false);
  });

  it('renders tbw-grid-column with mapped attributes', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const root = ReactDOM.createRoot(container);
    root.render(
      React.createElement(
        'tbw-grid',
        null,
        React.createElement(GridColumn, {
          field: 'price',
          header: 'Price',
          type: 'number',
          editable: true,
          sortable: true,
          resizable: true,
          width: 120,
          minWidth: 80,
          order: 2,
          hidden: true,
          lockVisible: true,
          multi: true,
        } as never),
      ),
    );

    const columnEl = await waitForColumnEl(container);

    expect(columnEl.getAttribute('field')).toBe('price');
    expect(columnEl.getAttribute('header')).toBe('Price');
    expect(columnEl.getAttribute('type')).toBe('number');
    expect(columnEl.getAttribute('width')).toBe('120px');
    expect(columnEl.getAttribute('min-width')).toBe('80');
    expect(columnEl.getAttribute('order')).toBe('2');

    root.unmount();
  });

  it('registers renderer and editor via element ref callback', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const renderer = () => React.createElement('span', null, 'renderer');
    const editor = () => React.createElement('input');

    const root = ReactDOM.createRoot(container);
    root.render(
      React.createElement(
        'tbw-grid',
        null,
        React.createElement(GridColumn, {
          field: 'status',
          children: renderer,
          editor,
        } as never),
      ),
    );

    const columnEl = await waitForColumnEl(container);

    expect(getColumnRenderer(columnEl)).toBe(renderer);
    expect(getColumnEditor(columnEl)).toBe(editor);

    root.unmount();
  });
});
