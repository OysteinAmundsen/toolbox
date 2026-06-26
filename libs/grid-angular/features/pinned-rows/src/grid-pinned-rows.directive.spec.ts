/**
 * Type-only regression tests for `GridPinnedRowsDirective` typing surface.
 *
 * Before this commit, the directive's `pinnedRows` input was typed as the
 * vanilla `PinnedRowsConfig` from `@toolbox-web/grid`, so users could not
 * pass an Angular component class as a panel-slot `render` even though the
 * side-effect preprocessor in `./index.ts` bridges component classes to
 * renderer functions. The adapter-widened `PinnedRowsConfig` re-exported
 * from `./grid-pinned-rows.directive` closes that gap.
 *
 * @vitest-environment jsdom
 */
import { Component, type Type } from '@angular/core';
import { describe, expect, it } from 'vitest';
import type { GridPinnedRowsDirective, PinnedRowsConfig } from './grid-pinned-rows.directive';

@Component({ standalone: true, template: '<span>panel</span>' })
class PanelComponent {}

describe('GridPinnedRowsDirective types', () => {
  it('PinnedRowsConfig accepts a component class as slot.render', () => {
    const cfg: PinnedRowsConfig = {
      slots: [{ id: 'p', position: 'top', render: PanelComponent }],
    };
    expect(cfg.slots).toHaveLength(1);
  });

  it('PinnedRowsConfig accepts a vanilla renderer function as slot.render', () => {
    const cfg: PinnedRowsConfig = {
      slots: [
        {
          id: 'p',
          position: 'bottom',
          render: () => {
            const el = document.createElement('div');
            el.textContent = 'panel';
            return el;
          },
        },
      ],
    };
    expect(cfg.slots).toHaveLength(1);
  });

  it('PinnedRowsConfig accepts a component class in zoned render entries', () => {
    const cfg: PinnedRowsConfig = {
      slots: [
        {
          id: 'zoned',
          position: 'bottom',
          render: [{ zone: 'left', render: PanelComponent }],
        },
      ],
    };
    expect(cfg.slots).toHaveLength(1);
  });

  it('directive input type accepts boolean shorthand', () => {
    // Type assertion only — the directive's input() signal type accepts
    // both `boolean` and `PinnedRowsConfig`.
    const value: boolean | PinnedRowsConfig = true;
    expect(value).toBe(true);
    // Compile-time check that the new type is exported for downstream tooling.
    const _component: Type<unknown> = PanelComponent;
    const _directive = undefined as unknown as GridPinnedRowsDirective | undefined;
    expect(_directive).toBeUndefined();
    expect(_component).toBe(PanelComponent);
  });
});
