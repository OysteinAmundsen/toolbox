/**
 * Tests for the ARIA-expanded overlay fallback in EditingPlugin (#251).
 *
 * Covers the heuristic that lets portal-based combobox / autocomplete /
 * datepicker editors keep the row in edit mode without explicitly calling
 * `registerExternalFocusContainer`. The grid recognises an open overlay
 * when an ancestor of the editor declares `aria-expanded="true"` and
 * `aria-controls=<id>` pointing at a visible panel.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditingPlugin } from './EditingPlugin';

async function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitUpgrade(el: HTMLElement & { ready?: () => Promise<void> }): Promise<void> {
  await customElements.whenDefined('tbw-grid');
  await el.ready?.();
  await nextFrame();
  await nextFrame();
}

interface Row {
  id: number;
  city: string;
}

describe('EditingPlugin ARIA overlay fallback (#251)', () => {
  let grid: any;
  let portalPanel: HTMLDivElement;

  beforeEach(async () => {
    await import('../../core/grid');
    document.body.innerHTML = '';
    grid = document.createElement('tbw-grid');
    document.body.appendChild(grid);

    // Pretend a popover library teleported its listbox to <body>.
    portalPanel = document.createElement('div');
    portalPanel.id = 'aria-test-listbox';
    portalPanel.setAttribute('role', 'listbox');
    portalPanel.textContent = 'option 1';
    document.body.appendChild(portalPanel);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function configureWithComboboxEditor(): void {
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID' },
        {
          field: 'city',
          header: 'City',
          editable: true,
          editor: (ctx: any) => {
            const wrapper = document.createElement('div');
            const input = document.createElement('input');
            input.value = String(ctx.value ?? '');
            // Combobox pattern advertised by Downshift / Headless UI / MUI Autocomplete.
            input.setAttribute('role', 'combobox');
            input.setAttribute('aria-expanded', 'true');
            input.setAttribute('aria-controls', portalPanel.id);
            wrapper.appendChild(input);
            return wrapper;
          },
        },
      ],
      plugins: [new EditingPlugin({ editOn: 'click' })],
    };
    grid.rows = [{ id: 1, city: 'Paris' }] satisfies Row[];
  }

  async function startEdit(): Promise<HTMLElement> {
    const row = grid.querySelector('.data-grid-row') as HTMLElement;
    const cityCell = row.querySelector('.cell[data-col="1"]') as HTMLElement;
    cityCell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextFrame();
    await nextFrame();
    return cityCell;
  }

  it('does not commit-and-exit when Enter is pressed on aria-expanded=true control', async () => {
    configureWithComboboxEditor();
    await waitUpgrade(grid);

    const cityCell = await startEdit();
    const combobox = cityCell.querySelector('input[role="combobox"]') as HTMLInputElement;
    expect(combobox).toBeTruthy();

    // Simulate the combobox's "confirm option" Enter (does NOT preventDefault,
    // because the library handles it asynchronously).
    combobox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await nextFrame();
    await nextFrame();

    // The editor host must still be present — the grid deferred Enter to the overlay.
    expect(cityCell.querySelector('input[role="combobox"]')).toBeTruthy();
  });

  it('does not commit-and-exit when clicking inside an aria-controls panel outside the grid', async () => {
    configureWithComboboxEditor();
    await waitUpgrade(grid);

    const cityCell = await startEdit();
    expect(cityCell.querySelector('input[role="combobox"]')).toBeTruthy();

    // Click a child of the portal panel — i.e. an option in the listbox.
    portalPanel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await nextFrame();
    await nextFrame();

    expect(cityCell.querySelector('input[role="combobox"]')).toBeTruthy();
  });

  it('still commits-and-exits when clicking elsewhere outside the grid', async () => {
    configureWithComboboxEditor();
    await waitUpgrade(grid);

    const cityCell = await startEdit();
    expect(cityCell.querySelector('input[role="combobox"]')).toBeTruthy();

    const stranger = document.createElement('div');
    stranger.id = 'unrelated';
    document.body.appendChild(stranger);
    stranger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await nextFrame();
    await nextFrame();

    expect(cityCell.querySelector('input[role="combobox"]')).toBeFalsy();
  });
});

describe('ColumnEditorContext.grid (#251)', () => {
  let grid: any;

  beforeEach(async () => {
    await import('../../core/grid');
    document.body.innerHTML = '';
    grid = document.createElement('tbw-grid');
    document.body.appendChild(grid);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('exposes the grid host element to factory editors', async () => {
    let capturedGrid: unknown = null;
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID' },
        {
          field: 'city',
          header: 'City',
          editable: true,
          editor: (ctx: any) => {
            capturedGrid = ctx.grid;
            const input = document.createElement('input');
            input.value = String(ctx.value ?? '');
            return input;
          },
        },
      ],
      plugins: [new EditingPlugin({ editOn: 'click' })],
    };
    grid.rows = [{ id: 1, city: 'Paris' }] satisfies Row[];
    await waitUpgrade(grid);

    const row = grid.querySelector('.data-grid-row') as HTMLElement;
    const cityCell = row.querySelector('.cell[data-col="1"]') as HTMLElement;
    cityCell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextFrame();
    await nextFrame();

    expect(capturedGrid).toBe(grid);
    expect(typeof (capturedGrid as { registerExternalFocusContainer?: unknown }).registerExternalFocusContainer).toBe(
      'function',
    );
  });
});
