import { describe, expect, it } from 'vitest';
import { readCellDisplayText } from './cell-text';

function makeCell(html: string): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.innerHTML = html;
  return cell;
}

describe('readCellDisplayText', () => {
  it('returns trimmed text content when no loader is present', () => {
    expect(readCellDisplayText(makeCell('  <span>Active</span> '))).toBe('Active');
  });

  it('excludes the custom loading overlay', () => {
    const cell = makeCell('<span>Active</span><div class="tbw-cell-loading-overlay"><span>Loading</span></div>');
    expect(readCellDisplayText(cell)).toBe('Active');
  });

  it('ignores direct comment nodes, like textContent does, when a loader is present', () => {
    const cell = makeCell(
      '<!--marker--><span>Active</span><!--container--><div class="tbw-cell-loading-overlay">Loading</div>',
    );
    expect(readCellDisplayText(cell)).toBe('Active');
  });

  it('only treats a direct-child overlay as the loader', () => {
    const cell = makeCell('<div class="nested"><div class="tbw-cell-loading-overlay">Nested</div></div>');
    expect(readCellDisplayText(cell)).toBe('Nested');
  });
});
