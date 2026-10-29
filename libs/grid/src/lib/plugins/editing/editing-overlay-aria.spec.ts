/**
 * Tests for the ARIA-expanded overlay fallback in EditingPlugin (#251, #558).
 *
 * Covers the heuristic that lets portal-based combobox / autocomplete /
 * datepicker editors keep the row in edit mode without explicitly calling
 * `registerExternalFocusContainer`. The grid recognises an open overlay
 * when an ancestor of the editor declares `aria-expanded="true"` and
 * `aria-controls=<id>` pointing at a visible panel.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditingPlugin } from './editing-plugin';
import { nextFrame, waitUpgrade } from '../../../../test/helpers';

interface Row {
  id: number;
  city: string;
}

const PANEL_ID = 'aria-test-listbox';
type BeforeEditClose = (e: MouseEvent | KeyboardEvent) => boolean;

/** Creates a fresh grid plus a listbox a popover library "teleported" to <body>. */
async function mountFixture(): Promise<{ grid: any; portalPanel: HTMLDivElement }> {
  await import('../../core/grid');
  document.body.innerHTML = '';
  const grid = document.createElement('tbw-grid');
  document.body.appendChild(grid);

  const portalPanel = document.createElement('div');
  portalPanel.id = PANEL_ID;
  portalPanel.setAttribute('role', 'listbox');
  const option = document.createElement('div');
  option.setAttribute('role', 'option');
  option.textContent = 'option 1';
  portalPanel.appendChild(option);
  document.body.appendChild(portalPanel);
  return { grid, portalPanel };
}

/**
 * Combobox pattern advertised by Downshift / Headless UI / MUI Autocomplete /
 * EDS: `aria-expanded` + `aria-controls` on the input, and the list closes on
 * Escape by flipping `aria-expanded` — without preventDefault/stopPropagation.
 */
function comboboxEditor(ctx: any): HTMLElement {
  const wrapper = document.createElement('div');
  const input = document.createElement('input');
  input.value = String(ctx.value ?? '');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', PANEL_ID);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') input.setAttribute('aria-expanded', 'false');
  });
  wrapper.appendChild(input);
  return wrapper;
}

async function startEdit(grid: any): Promise<HTMLElement> {
  const row = grid.querySelector('.data-grid-row') as HTMLElement;
  const cityCell = row.querySelector('.cell[data-col="1"]') as HTMLElement;
  cityCell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextFrame(2);
  return cityCell;
}

/** Configures a City column with `editor`, upgrades the grid and opens the row editor. */
async function editCity(
  grid: any,
  editor: (ctx: any) => HTMLElement,
  onBeforeEditClose?: BeforeEditClose,
): Promise<HTMLElement> {
  grid.gridConfig = {
    columns: [
      { field: 'id', header: 'ID' },
      { field: 'city', header: 'City', editable: true, editor },
    ],
    plugins: [new EditingPlugin({ editOn: 'click', onBeforeEditClose })],
  };
  grid.rows = [{ id: 1, city: 'Paris' }] satisfies Row[];
  await waitUpgrade(grid);
  return startEdit(grid);
}

async function openCombobox(
  grid: any,
  onBeforeEditClose?: BeforeEditClose,
): Promise<{ cityCell: HTMLElement; combobox: HTMLInputElement }> {
  const cityCell = await editCity(grid, comboboxEditor, onBeforeEditClose);
  const combobox = cityCell.querySelector('input[role="combobox"]') as HTMLInputElement;
  expect(combobox).toBeTruthy();
  return { cityCell, combobox };
}

async function dispatchAndSettle(target: Element, event: Event): Promise<void> {
  target.dispatchEvent(event);
  await nextFrame(2);
}

describe('EditingPlugin ARIA overlay fallback (#251)', () => {
  let grid: any;
  let portalPanel: HTMLDivElement;

  beforeEach(async () => {
    ({ grid, portalPanel } = await mountFixture());
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not commit-and-exit when Enter is pressed on aria-expanded=true control', async () => {
    const { cityCell, combobox } = await openCombobox(grid);

    // Simulate the combobox's "confirm option" Enter (does NOT preventDefault,
    // because the library handles it asynchronously).
    await dispatchAndSettle(combobox, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    // The editor host must still be present — the grid deferred Enter to the overlay.
    expect(cityCell.querySelector('input[role="combobox"]')).toBeTruthy();
  });

  it('does not commit-and-exit when clicking inside an aria-controls panel outside the grid', async () => {
    const { cityCell } = await openCombobox(grid);

    // Click a child of the portal panel — i.e. an option in the listbox.
    await dispatchAndSettle(portalPanel, new MouseEvent('mousedown', { bubbles: true }));

    expect(cityCell.querySelector('input[role="combobox"]')).toBeTruthy();
  });

  it('still commits-and-exits when clicking elsewhere outside the grid', async () => {
    const { cityCell } = await openCombobox(grid);

    const stranger = document.createElement('div');
    stranger.id = 'unrelated';
    document.body.appendChild(stranger);
    await dispatchAndSettle(stranger, new MouseEvent('mousedown', { bubbles: true }));

    expect(cityCell.querySelector('input[role="combobox"]')).toBeFalsy();
  });
});

describe('EditingPlugin Escape with an open ARIA overlay (#558)', () => {
  let grid: any;
  let portalPanel: HTMLDivElement;

  beforeEach(async () => {
    ({ grid, portalPanel } = await mountFixture());
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const pressEscape = (target: Element) =>
    dispatchAndSettle(target, new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

  /** Opens the combobox editor and types a value that a cancel must discard. */
  async function typeIntoCombobox(value: string) {
    const opened = await openCombobox(grid);
    opened.combobox.value = value;
    return opened;
  }

  it('first Escape closes the popup and keeps the row in edit mode', async () => {
    const { cityCell, combobox } = await typeIntoCombobox('Lyon');

    await pressEscape(combobox);

    expect(combobox.getAttribute('aria-expanded')).toBe('false');
    expect(cityCell.querySelector('input[role="combobox"]')).toBe(combobox);
    expect(combobox.value).toBe('Lyon');
  });

  it('second Escape (popup closed) cancels the row edit', async () => {
    const { cityCell, combobox } = await typeIntoCombobox('Lyon');

    await pressEscape(combobox);
    await pressEscape(combobox);

    expect(cityCell.querySelector('input[role="combobox"]')).toBeFalsy();
    expect(grid.rows[0].city).toBe('Paris');
  });

  it('Escape pressed inside the portal panel keeps the row in edit mode', async () => {
    const { cityCell } = await openCombobox(grid);

    await pressEscape(portalPanel.querySelector('[role="option"]') as HTMLElement);

    expect(cityCell.querySelector('input[role="combobox"]')).toBeTruthy();
  });

  it('Escape pressed inside an inline panel beside its trigger keeps the row in edit mode', async () => {
    const cityCell = await editCity(grid, (ctx) => {
      const wrapper = comboboxEditor(ctx);
      wrapper.querySelector('input')?.setAttribute('aria-controls', 'inline-listbox');
      const inlinePanel = document.createElement('div');
      inlinePanel.id = 'inline-listbox';
      inlinePanel.setAttribute('role', 'listbox');
      const option = document.createElement('div');
      option.setAttribute('role', 'option');
      inlinePanel.appendChild(option);
      wrapper.appendChild(inlinePanel);
      return wrapper;
    });

    await pressEscape(cityCell.querySelector('#inline-listbox [role="option"]') as HTMLElement);

    expect(cityCell.querySelector('input[role="combobox"]')).toBeTruthy();
  });

  it('consults onBeforeEditClose at most once per Escape event', async () => {
    let calls = 0;
    // Veto the first consultation only — a stateful callback that would let a
    // repeated consultation of the same keystroke through.
    const { cityCell, combobox } = await openCombobox(grid, () => ++calls > 1);
    combobox.setAttribute('aria-expanded', 'false');

    await pressEscape(combobox);

    expect(calls).toBe(1);
    expect(cityCell.querySelector('input[role="combobox"]')).toBeTruthy();
  });
});

describe('ColumnEditorContext.grid (#251)', () => {
  let grid: any;

  beforeEach(async () => {
    ({ grid } = await mountFixture());
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('exposes the grid host element to factory editors', async () => {
    let capturedGrid: unknown = null;
    await editCity(grid, (ctx: any) => {
      capturedGrid = ctx.grid;
      const input = document.createElement('input');
      input.value = String(ctx.value ?? '');
      return input;
    });

    expect(capturedGrid).toBe(grid);
    expect(typeof (capturedGrid as { registerExternalFocusContainer?: unknown }).registerExternalFocusContainer).toBe(
      'function',
    );
  });
});

describe('EditingPlugin grid mode: Enter while an overlay is open (#251 mirror)', () => {
  let grid: any;

  beforeEach(async () => {
    ({ grid } = await mountFixture());
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  /** Grid-mode City column with `editor`; returns the focused editor input. */
  async function focusGridModeEditor(editor: (ctx: any) => HTMLElement): Promise<HTMLInputElement> {
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'city', header: 'City', editable: true, editor },
      ],
      plugins: [new EditingPlugin({ mode: 'grid' })],
    };
    grid.rows = [{ id: 1, city: 'Paris' }] satisfies Row[];
    await waitUpgrade(grid);
    grid._focusRow = 0;
    grid._focusCol = 1;
    const cityCell = grid.querySelector('.cell[data-col="1"][data-row="0"]') as HTMLElement;
    const input = cityCell.querySelector('input') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);
    return input;
  }

  const pressEnter = (target: Element) =>
    dispatchAndSettle(target, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

  it('keeps focus in an aria-expanded combobox (the overlay owns Enter)', async () => {
    const combobox = await focusGridModeEditor(comboboxEditor);

    await pressEnter(combobox);

    expect(document.activeElement).toBe(combobox);
  });

  it('keeps focus in an editor that preventDefault()s Enter (#250)', async () => {
    const input = await focusGridModeEditor((ctx: any) => {
      const el = document.createElement('input');
      el.value = String(ctx.value ?? '');
      el.addEventListener('keydown', (e) => e.key === 'Enter' && e.preventDefault());
      return el;
    });

    await pressEnter(input);

    expect(document.activeElement).toBe(input);
  });

  it('still blurs the editor and returns to navigation on an ordinary Enter', async () => {
    const combobox = await focusGridModeEditor(comboboxEditor);
    combobox.setAttribute('aria-expanded', 'false'); // overlay closed

    await pressEnter(combobox);

    expect(document.activeElement).not.toBe(combobox);
    expect(document.activeElement).toBe(grid);
  });
});
