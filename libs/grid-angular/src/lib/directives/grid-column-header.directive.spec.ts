/**
 * Tests for the `*tbwHeader` / `*tbwHeaderLabel` structural directives.
 *
 * These bring Angular to parity with React's `<GridColumn headerRenderer>`
 * render prop and Vue's `#header` / `#headerLabel` slots.
 *
 * This project deliberately avoids TestBed, so `inject` and `effect` are
 * mocked (the same approach as `inject-grid.spec.ts`) to construct the
 * directives directly and exercise registration and teardown.
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
import { getHeaderLabelTemplate, getHeaderTemplate, TbwHeader, TbwHeaderLabel } from './grid-column-header.directive';

/** Stand-in for the `TemplateRef` Angular would inject for the structural directive. */
function makeTemplate(tag: string): TemplateRef<unknown> {
  return { __tag: tag } as unknown as TemplateRef<unknown>;
}

/**
 * Build the DOM Angular produces for a structural directive: an anchor node
 * nested `depth` levels inside the owning column element.
 */
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

function withInjection<T>(template: TemplateRef<unknown>, anchor: HTMLElement, construct: () => T): T {
  injectResolver = (token: unknown) => {
    if (token === TemplateRef) return template;
    if (token === ElementRef) return new ElementRef(anchor);
    return undefined;
  };
  return construct();
}

afterEach(() => {
  document.body.innerHTML = '';
  injectResolver = () => undefined;
});

describe('TbwHeader', () => {
  it('exposes a static ngTemplateContextGuard that returns true', () => {
    expect(typeof TbwHeader.ngTemplateContextGuard).toBe('function');
    expect(TbwHeader.ngTemplateContextGuard({} as TbwHeader, {})).toBe(true);
  });

  it('registers its template against the owning <tbw-grid-column>', () => {
    const template = makeTemplate('header');
    const { column, anchor } = makeAnchor('tbw-grid-column');

    const directive = withInjection(template, anchor, () => new TbwHeader());

    expect(getHeaderTemplate(column)).toBe(template);
    directive.ngOnDestroy();
  });

  it('walks up through intermediate wrappers to find the column', () => {
    const template = makeTemplate('header-deep');
    const { column, anchor } = makeAnchor('tbw-grid-column', 3);

    const directive = withInjection(template, anchor, () => new TbwHeader());

    expect(getHeaderTemplate(column)).toBe(template);
    directive.ngOnDestroy();
  });

  it('also resolves a <tbw-grid-type> owner', () => {
    const template = makeTemplate('header-type');
    const { column, anchor } = makeAnchor('tbw-grid-type');

    const directive = withInjection(template, anchor, () => new TbwHeader());

    expect(getHeaderTemplate(column)).toBe(template);
    directive.ngOnDestroy();
  });

  it('unregisters the template on destroy', () => {
    const template = makeTemplate('header-destroy');
    const { column, anchor } = makeAnchor('tbw-grid-column');

    const directive = withInjection(template, anchor, () => new TbwHeader());
    expect(getHeaderTemplate(column)).toBe(template);

    directive.ngOnDestroy();
    expect(getHeaderTemplate(column)).toBeUndefined();
  });

  it('registers nothing when there is no column ancestor', () => {
    const template = makeTemplate('header-orphan');
    const orphan = document.createElement('span');
    document.body.appendChild(orphan);

    const directive = withInjection(template, orphan, () => new TbwHeader());

    // No owner was found, so destroy must be a safe no-op.
    expect(() => directive.ngOnDestroy()).not.toThrow();
  });
});

describe('TbwHeaderLabel', () => {
  it('exposes a static ngTemplateContextGuard that returns true', () => {
    expect(typeof TbwHeaderLabel.ngTemplateContextGuard).toBe('function');
    expect(TbwHeaderLabel.ngTemplateContextGuard({} as TbwHeaderLabel, {})).toBe(true);
  });

  it('registers and unregisters its template against the owning column', () => {
    const template = makeTemplate('label');
    const { column, anchor } = makeAnchor('tbw-grid-column', 2);

    const directive = withInjection(template, anchor, () => new TbwHeaderLabel());
    expect(getHeaderLabelTemplate(column)).toBe(template);

    directive.ngOnDestroy();
    expect(getHeaderLabelTemplate(column)).toBeUndefined();
  });

  it('registers nothing when there is no column ancestor', () => {
    const template = makeTemplate('label-orphan');
    const orphan = document.createElement('span');
    document.body.appendChild(orphan);

    const directive = withInjection(template, orphan, () => new TbwHeaderLabel());

    expect(() => directive.ngOnDestroy()).not.toThrow();
  });
});

describe('header template registries', () => {
  it('return undefined when no template is registered for a column', () => {
    const col = document.createElement('tbw-grid-column');
    expect(getHeaderTemplate(col)).toBeUndefined();
    expect(getHeaderLabelTemplate(col)).toBeUndefined();
  });

  it('keep the two registries independent', () => {
    const headerTemplate = makeTemplate('independent-header');
    const { column, anchor } = makeAnchor('tbw-grid-column');

    const directive = withInjection(headerTemplate, anchor, () => new TbwHeader());

    // A shared Map would let the `*tbwHeader` registration leak into the label lookup.
    expect(getHeaderTemplate(column)).toBe(headerTemplate);
    expect(getHeaderLabelTemplate(column)).toBeUndefined();

    directive.ngOnDestroy();
  });
});
