/**
 * Tests for GridType component.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GridType } from './grid-type';
import { getTypeEditor, getTypeRenderer } from './react-grid-adapter';

describe('GridType', () => {
  let React: typeof import('react');
  let ReactDOM: typeof import('react-dom/client');

  beforeEach(async () => {
    React = await import('react');
    ReactDOM = await import('react-dom/client');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  async function waitForTypeEl(container: HTMLElement): Promise<HTMLElement> {
    await vi.waitFor(() => {
      expect(container.querySelector('tbw-grid-type')).toBeTruthy();
    });
    return container.querySelector('tbw-grid-type') as HTMLElement;
  }

  it('renders tbw-grid-type and kebab-cases params as data-* attributes', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const root = ReactDOM.createRoot(container);
    root.render(
      React.createElement(
        'tbw-grid',
        null,
        React.createElement(
          GridType,
          {
            name: 'currency',
            params: {
              myOption: 'x',
              snake_case: true,
              localeCode: 'en-US',
            },
          },
          ({ value }: { value: unknown }) => React.createElement('span', null, String(value)),
        ),
      ),
    );

    const typeEl = await waitForTypeEl(container);

    expect(typeEl.getAttribute('name')).toBe('currency');
    expect(typeEl.getAttribute('data-my-option')).toBe('x');
    expect(typeEl.getAttribute('data-snake-case')).toBe('true');
    expect(typeEl.getAttribute('data-locale-code')).toBe('en-US');

    root.unmount();
  });

  it('registers type renderer/editor and renders marker child elements', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const renderer = () => React.createElement('span', null, 'cell');
    const editor = () => React.createElement('input');

    const root = ReactDOM.createRoot(container);
    root.render(
      React.createElement(
        'tbw-grid',
        null,
        React.createElement(GridType, {
          name: 'money',
          children: renderer,
          editor,
        } as never),
      ),
    );

    const typeEl = await waitForTypeEl(container);

    expect(typeEl.querySelector('tbw-grid-column-view')).toBeTruthy();
    expect(typeEl.querySelector('tbw-grid-column-editor')).toBeTruthy();
    expect(getTypeRenderer(typeEl)).toBe(renderer);
    expect(getTypeEditor(typeEl)).toBe(editor);

    root.unmount();
  });
});
