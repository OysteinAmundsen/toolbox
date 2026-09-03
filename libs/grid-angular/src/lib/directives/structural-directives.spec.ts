/**
 * Tests for the `*tbwRenderer` structural directive.
 *
 * This project deliberately avoids TestBed, so `inject` and `effect` are
 * mocked (the same approach as `inject-grid.spec.ts`) to construct the
 * directive directly and exercise registration, lookup fallback, and teardown.
 *
 * @vitest-environment happy-dom
 */
import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';

let injectResolver: (token: unknown) => unknown = () => undefined;

vi.mock('@angular/core', async () => {
  const actual = await vi.importActual<typeof import('@angular/core')>('@angular/core');
  return {
    ...actual,
    inject: (token: unknown) => injectResolver(token),
    effect: (cb: () => void) => {
      cb();
      return { destroy: () => undefined };
    },
  };
});

import { ElementRef, TemplateRef } from '@angular/core';
import { getStructuralViewTemplate, TbwRenderer } from './structural-directives';

function makeTemplate(tag: string): TemplateRef<unknown> {
  return { __tag: tag } as unknown as TemplateRef<unknown>;
}

/** Build the DOM Angular produces: an anchor nested `depth` levels inside the column. */
function makeAnchor(columnTag: string, depth = 1) {
  const column = document.createElement(columnTag);
  document.body.appendChild(column);

  let host: HTMLElement = column;
  for (let i = 0; i < depth; i++) {
    const wrapper = document.createElement('div');
    host.appendChild(wrapper);
    host = wrapper;
  }

  const anchor = document.createElement('span');
  host.appendChild(anchor);
  return { column, anchor };
}

function makeRenderer(template: TemplateRef<unknown>, anchor: HTMLElement): TbwRenderer {
  injectResolver = (token: unknown) => {
    if (token === TemplateRef) return template;
    if (token === ElementRef) return new ElementRef(anchor);
    return undefined;
  };
  return new TbwRenderer();
}

afterEach(() => {
  document.body.innerHTML = '';
  injectResolver = () => undefined;
});

describe('TbwRenderer', () => {
  it('exposes a static ngTemplateContextGuard that returns true', () => {
    expect(typeof TbwRenderer.ngTemplateContextGuard).toBe('function');
    expect(TbwRenderer.ngTemplateContextGuard({} as TbwRenderer, {})).toBe(true);
  });

  it('registers its template against the owning <tbw-grid-column>', () => {
    const template = makeTemplate('renderer');
    const { column, anchor } = makeAnchor('tbw-grid-column');

    const directive = makeRenderer(template, anchor);

    expect(getStructuralViewTemplate(column)).toBe(template);
    directive.ngOnDestroy();
  });

  it('walks up through intermediate wrappers to find the column', () => {
    const template = makeTemplate('renderer-deep');
    const { column, anchor } = makeAnchor('tbw-grid-column', 3);

    const directive = makeRenderer(template, anchor);

    expect(getStructuralViewTemplate(column)).toBe(template);
    directive.ngOnDestroy();
  });

  it('also resolves a <tbw-grid-type> owner', () => {
    const template = makeTemplate('renderer-type');
    const { column, anchor } = makeAnchor('tbw-grid-type');

    const directive = makeRenderer(template, anchor);

    expect(getStructuralViewTemplate(column)).toBe(template);
    directive.ngOnDestroy();
  });

  it('unregisters the template on destroy', () => {
    const template = makeTemplate('renderer-destroy');
    const { column, anchor } = makeAnchor('tbw-grid-column');

    const directive = makeRenderer(template, anchor);
    expect(getStructuralViewTemplate(column)).toBe(template);

    directive.ngOnDestroy();
    expect(getStructuralViewTemplate(column)).toBeUndefined();
  });

  it('registers nothing when there is no column ancestor', () => {
    const template = makeTemplate('renderer-orphan');
    const orphan = document.createElement('span');
    document.body.appendChild(orphan);

    const directive = makeRenderer(template, orphan);

    // No owner was found, so destroy must be a safe no-op.
    expect(() => directive.ngOnDestroy()).not.toThrow();
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

  it('prefers the structural registration over the nested view child', () => {
    const template = makeTemplate('renderer-precedence');
    const { column, anchor } = makeAnchor('tbw-grid-column');
    column.appendChild(document.createElement('tbw-grid-column-view'));

    const directive = makeRenderer(template, anchor);

    expect(getStructuralViewTemplate(column)).toBe(template);

    // Once the structural directive is gone the nested-child fallback takes over.
    directive.ngOnDestroy();
    expect(getStructuralViewTemplate(column)).toBeUndefined();
  });
});
