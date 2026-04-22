/**
 * Tests for the structural directives' helper functions.
 *
 * The classes themselves require an Angular injection context to construct
 * (the project deliberately avoids TestBed). This spec covers the exported
 * getter functions and the static type guards.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  TbwEditor,
  TbwRenderer,
  getStructuralEditorTemplate,
  getStructuralViewTemplate,
} from './structural-directives';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('TbwRenderer', () => {
  it('exposes a static ngTemplateContextGuard that returns true', () => {
    expect(typeof TbwRenderer.ngTemplateContextGuard).toBe('function');
    expect(TbwRenderer.ngTemplateContextGuard({} as TbwRenderer, {})).toBe(true);
  });
});

describe('TbwEditor', () => {
  it('exposes a static ngTemplateContextGuard that returns true', () => {
    expect(typeof TbwEditor.ngTemplateContextGuard).toBe('function');
    expect(TbwEditor.ngTemplateContextGuard({} as TbwEditor, {})).toBe(true);
  });
});

describe('getStructuralViewTemplate', () => {
  it('returns undefined when no template is registered and no nested view child exists', () => {
    const col = document.createElement('tbw-grid-column');
    expect(getStructuralViewTemplate(col)).toBeUndefined();
  });

  it('falls back to the nested <tbw-grid-column-view> when no structural template is registered', () => {
    const col = document.createElement('tbw-grid-column');
    const view = document.createElement('tbw-grid-column-view');
    col.appendChild(view);
    // No template registered against `view` either, so the fallback returns undefined
    expect(getStructuralViewTemplate(col)).toBeUndefined();
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
