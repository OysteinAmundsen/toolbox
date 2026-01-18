import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataGridElement } from './grid';

describe('DataGridElement', () => {
  beforeEach(() => {
    // Ensure custom element is defined
    if (!customElements.get('tbw-grid')) {
      customElements.define('tbw-grid', DataGridElement);
    }
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should create an tbw-grid element', () => {
    const grid = document.createElement('tbw-grid') as DataGridElement;
    expect(grid).toBeInstanceOf(DataGridElement);
  });

  it('should return null for shadowRoot (no Shadow DOM)', () => {
    const grid = document.createElement('tbw-grid') as DataGridElement;
    document.body.appendChild(grid);
    // Grid uses light DOM, so shadowRoot should be null
    expect(grid.shadowRoot).toBeNull();
  });

  it('should resolve ready() promise when connected', async () => {
    const grid = document.createElement('tbw-grid') as DataGridElement;
    document.body.appendChild(grid);
    await expect(grid.ready()).resolves.toBeUndefined();
  });
});
