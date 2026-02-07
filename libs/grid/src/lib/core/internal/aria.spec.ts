/**
 * ARIA Accessibility Helpers Tests
 *
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { GridConfig } from '../types';
import { createAriaState, getEffectiveAriaLabel, updateAriaCounts, updateAriaLabels, type AriaState } from './aria';
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
});
