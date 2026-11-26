/**
 * @vitest-environment happy-dom
 */
import '@angular/compiler';
import { DataGridElement } from '@toolbox-web/grid';
import '@toolbox-web/grid/features/filtering';
import '@toolbox-web/grid/features/selection';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerFeatureClaim, unregisterFeatureClaim } from '../internal/feature-claims';

const state = vi.hoisted(() => ({
  grid: null as HTMLElement | null,
  effects: [] as Array<() => void>,
}));

vi.mock('@angular/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@angular/core')>();
  return {
    ...core,
    inject: (token: unknown) => {
      if (token === core.ElementRef) return { nativeElement: state.grid };
      if (token === core.EnvironmentInjector) return { get: () => null };
      return null;
    },
    input: (initial?: unknown) => () => initial,
    output: () => ({ emit: () => undefined }),
    effect: (callback: () => void) => {
      state.effects.push(callback);
      return { destroy: () => undefined };
    },
  };
});

const { Grid } = await import('./grid.directive');

describe('Grid feature directives', () => {
  afterEach(() => {
    state.effects.length = 0;
    document.body.innerHTML = '';
  });

  it.each([false, undefined])('removes the last feature when filtering becomes %s', async (disabled) => {
    const grid = document.createElement('tbw-grid') as DataGridElement;
    state.grid = grid;
    document.body.appendChild(grid);
    grid.rows = [{ name: 'Alice' }];
    let filtering: boolean | undefined = true;
    registerFeatureClaim(grid, 'filtering', () => filtering);

    const directive = new Grid();
    directive.ngOnInit();
    state.effects[0]();
    await vi.waitFor(() => expect(grid.getPluginByName('filtering')).toBeDefined());

    filtering = disabled;
    state.effects[0]();
    await vi.waitFor(() => expect(grid.getPluginByName('filtering')).toBeUndefined());

    unregisterFeatureClaim(grid, 'filtering');
    directive.ngOnDestroy();
  });

  it('preserves the base config and another feature when filtering is disabled and re-enabled', async () => {
    const grid = document.createElement('tbw-grid') as DataGridElement;
    state.grid = grid;
    document.body.appendChild(grid);
    grid.rows = [{ name: 'Alice' }];
    let filtering = true;
    registerFeatureClaim(grid, 'filtering', () => filtering);
    registerFeatureClaim(grid, 'selection', () => 'row');

    const directive = new Grid();
    Object.defineProperty(directive, 'gridConfig', { value: () => ({ rowHeight: 40 }) });
    directive.ngOnInit();
    state.effects[0]();
    await vi.waitFor(() => expect(grid.getPluginByName('filtering')).toBeDefined());
    filtering = false;
    state.effects[0]();
    await vi.waitFor(() => expect(grid.getPluginByName('filtering')).toBeUndefined());
    expect(grid.getPluginByName('selection')).toBeDefined();
    expect(grid.gridConfig?.rowHeight).toBe(40);
    filtering = true;
    state.effects[0]();
    await vi.waitFor(() => expect(grid.getPluginByName('filtering')).toBeDefined());
    expect(grid.getPluginByName('selection')).toBeDefined();

    unregisterFeatureClaim(grid, 'filtering');
    unregisterFeatureClaim(grid, 'selection');
    directive.ngOnDestroy();
  });

  it('clears the last standalone config override when it becomes undefined', async () => {
    const grid = document.createElement('tbw-grid') as DataGridElement;
    state.grid = grid;
    document.body.appendChild(grid);
    let sortable: boolean | undefined = false;
    const directive = new Grid();
    Object.defineProperty(directive, 'sortable', { value: () => sortable });
    directive.ngOnInit();

    state.effects[0]();
    await vi.waitFor(() => expect(grid.gridConfig.sortable).toBe(false));
    sortable = undefined;
    state.effects[0]();
    await vi.waitFor(() => expect(grid._sourceConfig?.sortable).toBeUndefined());
    directive.ngOnDestroy();
  });
});
