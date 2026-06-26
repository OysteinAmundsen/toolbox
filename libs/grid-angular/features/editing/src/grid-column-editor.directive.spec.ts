/**
 * Tests for the `GridColumnEditor` directive's helper function and type guard.
 *
 * The directive uses `inject()` and cannot be constructed outside an Angular
 * injection context (the project deliberately avoids TestBed). These tests
 * cover the exported `getEditorTemplate` getter and the static type guard.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { getEditorTemplate, GridColumnEditor } from './grid-column-editor.directive';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('GridColumnEditor', () => {
  it('is a defined directive class', () => {
    expect(GridColumnEditor).toBeDefined();
    expect(typeof GridColumnEditor).toBe('function');
  });

  it('exposes a static ngTemplateContextGuard that returns true', () => {
    expect(typeof GridColumnEditor.ngTemplateContextGuard).toBe('function');
    expect(GridColumnEditor.ngTemplateContextGuard({} as GridColumnEditor, {})).toBe(true);
  });
});

describe('getEditorTemplate', () => {
  it('returns undefined for an unregistered element', () => {
    expect(getEditorTemplate(document.createElement('tbw-grid-column-editor'))).toBeUndefined();
  });

  it('returns undefined for different element types', () => {
    expect(getEditorTemplate(document.createElement('div'))).toBeUndefined();
    expect(getEditorTemplate(document.createElement('span'))).toBeUndefined();
  });
});
