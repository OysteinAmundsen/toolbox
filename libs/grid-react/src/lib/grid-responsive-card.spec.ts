/**
 * Tests for the GridResponsiveCard component and registry.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getResponsiveCardRenderer, type ResponsiveCardContext } from './grid-responsive-card';

describe('GridResponsiveCard', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('getResponsiveCardRenderer', () => {
    it('should return undefined for grid without responsive card element', () => {
      const gridElement = document.createElement('tbw-grid');
      container.appendChild(gridElement);

      const renderer = getResponsiveCardRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should return undefined for grid with unregistered responsive card element', () => {
      const gridElement = document.createElement('tbw-grid');
      const cardElement = document.createElement('tbw-grid-responsive-card');
      gridElement.appendChild(cardElement);
      container.appendChild(gridElement);

      const renderer = getResponsiveCardRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should return undefined when grid has no id for fallback lookup', () => {
      const gridElement = document.createElement('tbw-grid');
      container.appendChild(gridElement);

      // No child element, no id — should return undefined
      const renderer = getResponsiveCardRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should attempt id-based fallback when card element has no WeakMap entry', () => {
      const gridElement = document.createElement('tbw-grid');
      gridElement.id = 'grid-with-id';
      const cardElement = document.createElement('tbw-grid-responsive-card');
      gridElement.appendChild(cardElement);
      container.appendChild(gridElement);

      // Has id, but no Map entry → undefined
      const renderer = getResponsiveCardRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should try data-grid-id attribute as fallback', () => {
      const gridElement = document.createElement('tbw-grid');
      gridElement.setAttribute('data-grid-id', 'fallback-card-grid');
      container.appendChild(gridElement);

      const renderer = getResponsiveCardRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });
  });

  describe('ResponsiveCardContext type', () => {
    it('should have expected shape', () => {
      const ctx: ResponsiveCardContext<{ name: string }> = {
        row: { name: 'Test' },
        index: 0,
      };
      expect(ctx.row.name).toBe('Test');
      expect(ctx.index).toBe(0);
    });
  });
});

describe('React component rendering', () => {
  let React: typeof import('react');
  let ReactDOM: typeof import('react-dom/client');
  let GridResponsiveCard: typeof import('./grid-responsive-card').GridResponsiveCard;

  beforeEach(async () => {
    React = await import('react');
    ReactDOM = await import('react-dom/client');
    const mod = await import('./grid-responsive-card');
    GridResponsiveCard = mod.GridResponsiveCard;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should render a tbw-grid-responsive-card element', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderFn = () => React.createElement('div', null, 'card');

    const root = ReactDOM.createRoot(container);
    root.render(React.createElement(GridResponsiveCard, { children: renderFn }));
    await new Promise((r) => setTimeout(r, 0));

    const cardEl = container.querySelector('tbw-grid-responsive-card');
    expect(cardEl).toBeTruthy();

    root.unmount();
  });

  it('should default cardRowHeight to auto', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderFn = () => React.createElement('div', null, 'card');

    const root = ReactDOM.createRoot(container);
    root.render(React.createElement(GridResponsiveCard, { children: renderFn }));
    await new Promise((r) => setTimeout(r, 0));

    const cardEl = container.querySelector('tbw-grid-responsive-card');
    // React 19 sets properties on custom elements instead of attributes
    const height =
      (cardEl as any)?.cardRowHeight ?? cardEl?.getAttribute('cardrowheight') ?? cardEl?.getAttribute('cardRowHeight');
    expect(height).toBe('auto');

    root.unmount();
  });

  it('should set cardRowHeight to numeric value', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderFn = () => React.createElement('div', null, 'card');

    const root = ReactDOM.createRoot(container);
    root.render(React.createElement(GridResponsiveCard, { children: renderFn, cardRowHeight: 80 }));
    await new Promise((r) => setTimeout(r, 0));

    const cardEl = container.querySelector('tbw-grid-responsive-card');
    // React 19 sets properties on custom elements instead of attributes
    const height =
      (cardEl as any)?.cardRowHeight ?? cardEl?.getAttribute('cardrowheight') ?? cardEl?.getAttribute('cardRowHeight');
    expect(height).toBe('80');

    root.unmount();
  });
});
