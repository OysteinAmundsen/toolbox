/**
 * Smoke tests for GridHeaderContent and GridToolbarContent directives.
 *
 * Follows the package convention of avoiding Angular TestBed and instead
 * verifying class structure + the public guards/hooks that don't require a
 * full DI bootstrap. Full integration behavior is exercised by the calendar
 * demo and adapter conformance tests.
 *
 * @vitest-environment happy-dom
 */
import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { GridHeaderContent } from './grid-header-content.directive';
import { GridToolbarContent } from './grid-toolbar-content.directive';

describe('GridHeaderContent', () => {
  it('is importable and defined', () => {
    expect(GridHeaderContent).toBeDefined();
    expect(typeof GridHeaderContent).toBe('function');
  });

  it('has a static ngTemplateContextGuard that always returns true', () => {
    expect(typeof GridHeaderContent.ngTemplateContextGuard).toBe('function');
    expect(GridHeaderContent.ngTemplateContextGuard({} as GridHeaderContent, {})).toBe(true);
  });

  it('exposes register / unregister / findGrid as instance prototype methods', () => {
    // These are private TS-wise but exist on the prototype at runtime.
    const proto = GridHeaderContent.prototype as Record<string, unknown>;
    expect(typeof proto['register']).toBe('function');
    expect(typeof proto['unregister']).toBe('function');
    expect(typeof proto['findGrid']).toBe('function');
  });
});

describe('GridToolbarContent', () => {
  it('is importable and defined', () => {
    expect(GridToolbarContent).toBeDefined();
    expect(typeof GridToolbarContent).toBe('function');
  });

  it('has a static ngTemplateContextGuard that always returns true', () => {
    expect(typeof GridToolbarContent.ngTemplateContextGuard).toBe('function');
    expect(GridToolbarContent.ngTemplateContextGuard({} as GridToolbarContent, {})).toBe(true);
  });

  it('exposes register / unregister / findGrid as instance prototype methods', () => {
    const proto = GridToolbarContent.prototype as Record<string, unknown>;
    expect(typeof proto['register']).toBe('function');
    expect(typeof proto['unregister']).toBe('function');
    expect(typeof proto['findGrid']).toBe('function');
  });
});
