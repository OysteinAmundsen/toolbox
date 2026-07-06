/**
 * Tests for the structural editor directive's helper functions.
 *
 * The class itself requires an Angular injection context to construct
 * (the project deliberately avoids TestBed). This spec covers the exported
 * getter function and the static type guard.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { getStructuralEditorTemplate, TbwEditor } from './structural-editor.directive';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('TbwEditor', () => {
  it('exposes a static ngTemplateContextGuard that returns true', () => {
    expect(typeof TbwEditor.ngTemplateContextGuard).toBe('function');
    expect(TbwEditor.ngTemplateContextGuard({} as TbwEditor, {})).toBe(true);
  });
});

describe('getStructuralEditorTemplate', () => {
  it('returns undefined when no template is registered and no nested editor child exists', () => {
    const col = document.createElement('tbw-grid-column');
    expect(getStructuralEditorTemplate(col)).toBeUndefined();
  });

  it('falls back to the nested <tbw-grid-column-editor> when no structural template is registered', () => {
    const col = document.createElement('tbw-grid-column');
    const editor = document.createElement('tbw-grid-column-editor');
    col.appendChild(editor);
    expect(getStructuralEditorTemplate(col)).toBeUndefined();
  });
});
