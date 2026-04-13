/**
 * ARIA Accessibility Helpers Tests
 *
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { GridConfig } from '../types';
import {
  announce,
  createAriaState,
  getA11yMessage,
  getEffectiveAriaLabel,
  updateAriaCounts,
  updateAriaLabels,
  type AriaState,
} from './aria';
import type { ShellState } from './shell';

describe('ARIA Helpers', () => {
  // #region createAriaState

  describe('createAriaState', () => {
    it('should create initial state with -1 counts', () => {
      const state = createAriaState();
      expect(state.rowCount).toBe(-1);
      expect(state.colCount).toBe(-1);
    });

    it('should create initial state with undefined labels', () => {
      const state = createAriaState();
      expect(state.ariaLabel).toBeUndefined();
      expect(state.ariaDescribedBy).toBeUndefined();
    });
  });

  // #endregion

  // #region updateAriaCounts

  describe('updateAriaCounts', () => {
    let state: AriaState;
    let rowsBodyEl: HTMLElement;
    let bodyEl: HTMLElement;

    beforeEach(() => {
      state = createAriaState();
      rowsBodyEl = document.createElement('div');
      bodyEl = document.createElement('div');
    });

    it('should update aria-rowcount and aria-colcount', () => {
      const updated = updateAriaCounts(state, rowsBodyEl, bodyEl, 100, 5);

      expect(updated).toBe(true);
      expect(rowsBodyEl.getAttribute('aria-rowcount')).toBe('100');
      expect(rowsBodyEl.getAttribute('aria-colcount')).toBe('5');
    });

    it('should cache values and skip redundant updates', () => {
      updateAriaCounts(state, rowsBodyEl, bodyEl, 100, 5);
      const updated = updateAriaCounts(state, rowsBodyEl, bodyEl, 100, 5);

      expect(updated).toBe(false);
      expect(state.rowCount).toBe(100);
      expect(state.colCount).toBe(5);
    });

    it('should update when row count changes', () => {
      updateAriaCounts(state, rowsBodyEl, bodyEl, 100, 5);
      const updated = updateAriaCounts(state, rowsBodyEl, bodyEl, 150, 5);

      expect(updated).toBe(true);
      expect(rowsBodyEl.getAttribute('aria-rowcount')).toBe('150');
      expect(state.rowCount).toBe(150);
    });

    it('should update when column count changes', () => {
      updateAriaCounts(state, rowsBodyEl, bodyEl, 100, 5);
      const updated = updateAriaCounts(state, rowsBodyEl, bodyEl, 100, 10);

      expect(updated).toBe(true);
      expect(rowsBodyEl.getAttribute('aria-colcount')).toBe('10');
      expect(state.colCount).toBe(10);
    });

    it('should set role="rowgroup" when rows exist', () => {
      updateAriaCounts(state, rowsBodyEl, bodyEl, 10, 5);

      expect(bodyEl.getAttribute('role')).toBe('rowgroup');
    });

    it('should remove role when row count becomes 0', () => {
      updateAriaCounts(state, rowsBodyEl, bodyEl, 10, 5);
      updateAriaCounts(state, rowsBodyEl, bodyEl, 0, 5);

      expect(bodyEl.getAttribute('role')).toBeNull();
    });

    it('should handle null rowsBodyEl', () => {
      const updated = updateAriaCounts(state, null, bodyEl, 100, 5);

      expect(updated).toBe(true);
      expect(state.rowCount).toBe(100);
    });

    it('should handle null bodyEl', () => {
      const updated = updateAriaCounts(state, rowsBodyEl, null, 100, 5);

      expect(updated).toBe(true);
      expect(rowsBodyEl.getAttribute('aria-rowcount')).toBe('100');
    });
  });

  // #endregion

  // #region getEffectiveAriaLabel

  describe('getEffectiveAriaLabel', () => {
    it('should return explicit gridAriaLabel when set', () => {
      const config: GridConfig = { gridAriaLabel: 'Employees Table' };

      const label = getEffectiveAriaLabel(config, undefined);

      expect(label).toBe('Employees Table');
    });

    it('should return shell header title when no explicit label', () => {
      const config: GridConfig = { shell: { header: { title: 'Shell Title' } } };

      const label = getEffectiveAriaLabel(config, undefined);

      expect(label).toBe('Shell Title');
    });

    it('should return light DOM title from shellState when no config title', () => {
      const config: GridConfig = {};
      const shellState: ShellState = {
        lightDomTitle: 'Light DOM Title',
        lightDomHeaderContent: null,
        hasToolButtonsContainer: false,
        isPanelOpen: false,
        expandedSections: [],
        toolPanels: new Map(),
        headerContents: new Map(),
        toolbarContents: new Map(),
      };

      const label = getEffectiveAriaLabel(config, shellState);

      expect(label).toBe('Light DOM Title');
    });

    it('should prioritize explicit label over shell title', () => {
      const config: GridConfig = {
        gridAriaLabel: 'Explicit Label',
        shell: { header: { title: 'Shell Title' } },
      };
      const shellState: ShellState = {
        lightDomTitle: 'Light DOM Title',
        lightDomHeaderContent: null,
        hasToolButtonsContainer: false,
        isPanelOpen: false,
        expandedSections: [],
        toolPanels: new Map(),
        headerContents: new Map(),
        toolbarContents: new Map(),
      };

      const label = getEffectiveAriaLabel(config, shellState);

      expect(label).toBe('Explicit Label');
    });

    it('should return undefined when no label source exists', () => {
      const config: GridConfig = {};

      const label = getEffectiveAriaLabel(config, undefined);

      expect(label).toBeUndefined();
    });
  });

  // #endregion

  // #region updateAriaLabels

  describe('updateAriaLabels', () => {
    let state: AriaState;
    let rowsBodyEl: HTMLElement;

    beforeEach(() => {
      state = createAriaState();
      rowsBodyEl = document.createElement('div');
    });

    it('should set aria-label from config', () => {
      const config: GridConfig = { gridAriaLabel: 'Employees' };

      const updated = updateAriaLabels(state, rowsBodyEl, config, undefined);

      expect(updated).toBe(true);
      expect(rowsBodyEl.getAttribute('aria-label')).toBe('Employees');
    });

    it('should set aria-describedby from config', () => {
      const config: GridConfig = { gridAriaDescribedBy: 'grid-description' };

      const updated = updateAriaLabels(state, rowsBodyEl, config, undefined);

      expect(updated).toBe(true);
      expect(rowsBodyEl.getAttribute('aria-describedby')).toBe('grid-description');
    });

    it('should cache and skip redundant label updates', () => {
      const config: GridConfig = { gridAriaLabel: 'Employees' };

      updateAriaLabels(state, rowsBodyEl, config, undefined);
      const updated = updateAriaLabels(state, rowsBodyEl, config, undefined);

      expect(updated).toBe(false);
      expect(state.ariaLabel).toBe('Employees');
    });

    it('should remove aria-label when label becomes undefined', () => {
      const configWithLabel: GridConfig = { gridAriaLabel: 'Employees' };
      const configWithoutLabel: GridConfig = {};

      updateAriaLabels(state, rowsBodyEl, configWithLabel, undefined);
      expect(rowsBodyEl.getAttribute('aria-label')).toBe('Employees');

      updateAriaLabels(state, rowsBodyEl, configWithoutLabel, undefined);
      expect(rowsBodyEl.getAttribute('aria-label')).toBeNull();
    });

    it('should remove aria-describedby when describedby becomes undefined', () => {
      const configWith: GridConfig = { gridAriaDescribedBy: 'description' };
      const configWithout: GridConfig = {};

      updateAriaLabels(state, rowsBodyEl, configWith, undefined);
      expect(rowsBodyEl.getAttribute('aria-describedby')).toBe('description');

      updateAriaLabels(state, rowsBodyEl, configWithout, undefined);
      expect(rowsBodyEl.getAttribute('aria-describedby')).toBeNull();
    });

    it('should return false when rowsBodyEl is null', () => {
      const config: GridConfig = { gridAriaLabel: 'Employees' };

      const updated = updateAriaLabels(state, null, config, undefined);

      expect(updated).toBe(false);
    });

    it('should handle both label and describedby changing', () => {
      const config: GridConfig = {
        gridAriaLabel: 'Employees',
        gridAriaDescribedBy: 'description',
      };

      const updated = updateAriaLabels(state, rowsBodyEl, config, undefined);

      expect(updated).toBe(true);
      expect(rowsBodyEl.getAttribute('aria-label')).toBe('Employees');
      expect(rowsBodyEl.getAttribute('aria-describedby')).toBe('description');
    });
  });

  // #endregion

  // #region announce

  describe('announce', () => {
    let gridEl: HTMLElement;
    let srOnly: HTMLElement;

    beforeEach(() => {
      gridEl = document.createElement('div');
      srOnly = document.createElement('div');
      srOnly.className = 'tbw-sr-only';
      gridEl.appendChild(srOnly);
    });

    it('should set textContent on aria-live region after rAF', async () => {
      announce(gridEl, 'Sorted by name, ascending');

      // Before rAF, textContent is cleared
      expect(srOnly.textContent).toBe('');

      // After rAF, message is set
      await new Promise((r) => requestAnimationFrame(r));
      expect(srOnly.textContent).toBe('Sorted by name, ascending');
    });

    it('should do nothing when no .tbw-sr-only element exists', () => {
      const emptyGrid = document.createElement('div');
      // Should not throw
      announce(emptyGrid, 'Test message');
    });

    it('should skip announcement when a11y.announcements is false', async () => {
      // Simulate effectiveConfig on grid element
      Object.defineProperty(gridEl, 'effectiveConfig', {
        value: { a11y: { announcements: false } },
        configurable: true,
      });

      announce(gridEl, 'Should not appear');
      await new Promise((r) => requestAnimationFrame(r));
      // textContent should remain empty since announce() returns early
      expect(srOnly.textContent).toBe('');
    });

    it('should announce when a11y.announcements is true', async () => {
      Object.defineProperty(gridEl, 'effectiveConfig', {
        value: { a11y: { announcements: true } },
        configurable: true,
      });

      announce(gridEl, 'Should appear');
      await new Promise((r) => requestAnimationFrame(r));
      expect(srOnly.textContent).toBe('Should appear');
    });

    it('should announce when a11y config is not set', async () => {
      Object.defineProperty(gridEl, 'effectiveConfig', {
        value: {},
        configurable: true,
      });

      announce(gridEl, 'Default behavior');
      await new Promise((r) => requestAnimationFrame(r));
      expect(srOnly.textContent).toBe('Default behavior');
    });
  });

  // #endregion

  // #region getA11yMessage

  describe('getA11yMessage', () => {
    let gridEl: HTMLElement;

    beforeEach(() => {
      gridEl = document.createElement('div');
    });

    it('should return default message when no config overrides', () => {
      const msg = getA11yMessage(gridEl, 'sortApplied', 'Name', 'ascending');
      expect(msg).toBe('Sorted by Name, ascending');
    });

    it('should return custom message when override provided', () => {
      Object.defineProperty(gridEl, 'effectiveConfig', {
        value: {
          a11y: {
            messages: {
              sortApplied: (col: string, dir: string) => `Trié par ${col}, ${dir}`,
            },
          },
        },
        configurable: true,
      });

      const msg = getA11yMessage(gridEl, 'sortApplied', 'Nom', 'ascendant');
      expect(msg).toBe('Trié par Nom, ascendant');
    });

    it('should fall back to default for non-overridden messages', () => {
      Object.defineProperty(gridEl, 'effectiveConfig', {
        value: {
          a11y: {
            messages: {
              sortApplied: (col: string) => `Custom sort: ${col}`,
            },
          },
        },
        configurable: true,
      });

      // sortCleared is not overridden — should use default
      const msg = getA11yMessage(gridEl, 'sortCleared');
      expect(msg).toBe('Sort cleared');
    });

    it('should handle all default message types', () => {
      expect(getA11yMessage(gridEl, 'sortApplied', 'Name', 'ascending')).toBe('Sorted by Name, ascending');
      expect(getA11yMessage(gridEl, 'sortCleared')).toBe('Sort cleared');
      expect(getA11yMessage(gridEl, 'filterApplied', 'Status')).toBe('Filter applied on Status');
      expect(getA11yMessage(gridEl, 'filterCleared', 'Status')).toBe('Filter cleared from Status');
      expect(getA11yMessage(gridEl, 'allFiltersCleared')).toBe('All filters cleared');
      expect(getA11yMessage(gridEl, 'groupExpanded', 'Engineering', 5)).toBe('Group Engineering expanded, 5 rows');
      expect(getA11yMessage(gridEl, 'groupCollapsed', 'Engineering')).toBe('Group Engineering collapsed');
      expect(getA11yMessage(gridEl, 'selectionChanged', 3)).toBe('3 rows selected');
      expect(getA11yMessage(gridEl, 'editingStarted', 0)).toBe('Editing row 1');
      expect(getA11yMessage(gridEl, 'editingCommitted', 0)).toBe('Row 1 saved');
      expect(getA11yMessage(gridEl, 'dataLoaded', 100)).toBe('100 rows loaded');
    });
  });

  // #endregion
});
