/**
 * Type and runtime tests for the v1.8.0 widening of
 * `FilterConfig.filterPanelRenderer` in
 * `@toolbox-web/grid-angular/features/filtering`.
 *
 * Covers the new `registerFeatureConfigPreprocessor('filtering', ...)` bridge
 * for plugin-level component-class `filterPanelRenderer`. The existing
 * `registerFilterPanelTypeDefaultBridge` (per-type-default bridge) is exercised
 * separately by the consumers of `BaseFilterPanel`.
 *
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { Component, type ComponentRef, type Type } from '@angular/core';
import { getFeatureConfigPreprocessor, type GridAdapter } from '@toolbox-web/grid-angular';
import type { FilterPanelParams } from '@toolbox-web/grid/plugins/filtering';
import { describe, expect, it, vi } from 'vitest';
import './index';
import type { FilterConfig } from './index';

@Component({ standalone: true, template: '<div>panel</div>' })
class PanelComponent {}

function makeAdapter(): { adapter: GridAdapter; mount: ReturnType<typeof vi.fn>; hostElement: HTMLElement } {
  const hostElement = document.createElement('div');
  hostElement.className = 'panel-host';
  const componentRef = {
    setInput: vi.fn(),
    changeDetectorRef: { detectChanges: vi.fn() },
  } as unknown as ComponentRef<unknown>;
  const mount = vi.fn(() => ({ hostElement, componentRef }));
  const adapter = {
    mountComponentRenderer: <TCtx>(_cls: Type<unknown>, _map: (ctx: TCtx) => Record<string, unknown>) =>
      mount as (ctx: TCtx) => { hostElement: HTMLElement; componentRef: ComponentRef<unknown> },
  } as unknown as GridAdapter;
  return { adapter, mount, hostElement };
}

describe('filtering preprocessor bridge (plugin-level filterPanelRenderer)', () => {
  it('accepts a component class as filterPanelRenderer (type test)', () => {
    const cfg: FilterConfig = { filterPanelRenderer: PanelComponent };
    expect(cfg.filterPanelRenderer).toBe(PanelComponent);
  });

  it('accepts a (container, params) => void function (type test)', () => {
    const cfg: FilterConfig = {
      filterPanelRenderer: (container) => container.appendChild(document.createElement('div')),
    };
    expect(typeof cfg.filterPanelRenderer).toBe('function');
  });

  it('is registered and passes through non-component-class renderer', () => {
    const pre = getFeatureConfigPreprocessor('filtering');
    expect(pre).toBeDefined();
    const { adapter } = makeAdapter();
    const cfg: FilterConfig = {
      filterPanelRenderer: (container) => container.appendChild(document.createElement('div')),
    };
    expect(pre!(cfg, adapter)).toBe(cfg);
  });

  it('bridges a component class to a (container, params) => void function', () => {
    const pre = getFeatureConfigPreprocessor('filtering');
    const { adapter, mount, hostElement } = makeAdapter();
    const out = pre!({ filterPanelRenderer: PanelComponent } satisfies FilterConfig, adapter) as FilterConfig;
    expect(typeof out.filterPanelRenderer).toBe('function');
    const container = document.createElement('div');
    const params = { column: { field: 'x' } } as unknown as FilterPanelParams;
    (out.filterPanelRenderer as (c: HTMLElement, p: FilterPanelParams) => void)(container, params);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(container.firstChild).toBe(hostElement);
  });

  it('passes through when config is boolean or undefined', () => {
    const pre = getFeatureConfigPreprocessor('filtering');
    const { adapter } = makeAdapter();
    expect(pre!(undefined, adapter)).toBe(undefined);
    expect(pre!(true, adapter)).toBe(true);
    expect(pre!(false, adapter)).toBe(false);
  });
});
