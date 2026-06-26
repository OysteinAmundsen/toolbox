/**
 * Tests for the GridToolPanel directive and its registry functions.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getToolPanelElements, getToolPanelTemplate, GridToolPanel } from './grid-tool-panel.directive';

describe('GridToolPanel', () => {
  it('should be importable and defined', () => {
    expect(GridToolPanel).toBeDefined();
    expect(typeof GridToolPanel).toBe('function');
  });

  it('should have a static ngTemplateContextGuard', () => {
    expect(typeof GridToolPanel.ngTemplateContextGuard).toBe('function');
  });

  it('ngTemplateContextGuard should always return true', () => {
    const result = GridToolPanel.ngTemplateContextGuard({} as GridToolPanel, {});
    expect(result).toBe(true);
  });
});

describe('getToolPanelTemplate', () => {
  it('should return undefined for an unregistered element', () => {
    const element = document.createElement('tbw-grid-tool-panel');
    expect(getToolPanelTemplate(element)).toBeUndefined();
  });
});

describe('getToolPanelElements', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should return an empty array when grid has no tool panels', () => {
    const gridElement = document.createElement('tbw-grid');
    container.appendChild(gridElement);

    const elements = getToolPanelElements(gridElement);
    expect(elements).toEqual([]);
  });

  it('should return an empty array when tool panels are not registered', () => {
    const gridElement = document.createElement('tbw-grid');
    const panel = document.createElement('tbw-grid-tool-panel');
    gridElement.appendChild(panel);
    container.appendChild(gridElement);

    const elements = getToolPanelElements(gridElement);
    expect(elements).toEqual([]);
  });
});
