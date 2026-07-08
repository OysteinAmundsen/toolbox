/**
 * Tests for GridToolButtons component.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GridToolButtons } from './grid-tool-button';

describe('GridToolButtons', () => {
  let React: typeof import('react');
  let ReactDOM: typeof import('react-dom/client');

  beforeEach(async () => {
    React = await import('react');
    ReactDOM = await import('react-dom/client');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders tbw-grid-tool-buttons and passes children through', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const root = ReactDOM.createRoot(container);
    root.render(
      React.createElement(
        GridToolButtons,
        null,
        React.createElement('button', { className: 'tbw-toolbar-btn', title: 'Export' }, 'Export'),
        React.createElement('button', { className: 'tbw-toolbar-btn', title: 'Print' }, 'Print'),
      ),
    );

    await vi.waitFor(() => {
      expect(container.querySelector('tbw-grid-tool-buttons')).toBeTruthy();
    });

    const wrapper = container.querySelector('tbw-grid-tool-buttons') as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.querySelectorAll('button')).toHaveLength(2);
    expect(wrapper.querySelector('button[title="Export"]')).toBeTruthy();
    expect(wrapper.querySelector('button[title="Print"]')).toBeTruthy();

    root.unmount();
  });
});
