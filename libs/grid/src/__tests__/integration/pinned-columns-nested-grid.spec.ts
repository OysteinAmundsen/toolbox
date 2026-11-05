/**
 * PinnedColumnsPlugin never touches a nested grid's cells. A MasterDetail child grid renders in
 * the parent's light DOM and here uses the SAME field names with its own independent pin, so any
 * descendant query from the parent would restyle or clear the child's cells (grid-pitfalls #13).
 *
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import { waitUpgrade } from '../../../test/helpers';
import { mountNestedGrid, own, useParentGrid, type Order } from '../../../test/nested-grid';
import '../../lib/core/grid';
import type { ColumnConfig } from '../../lib/core/types';
import { PinnedColumnsPlugin } from '../../lib/plugins/pinned-columns/pinned-columns-plugin';
import type { PinnedPosition } from '../../lib/plugins/pinned-columns/types';

const columns = () => ['c0', 'c1', 'c2', 'c3'].map((field) => ({ field, header: field, width: 100 }));

/** Sticky side + inset of every own header and body cell of `field`, e.g. `R0px` or `-`. */
const ownSides = (grid: HTMLElement, field: string) =>
  own(grid, '.cell[data-field]')
    .filter((c) => c.getAttribute('data-field') === field)
    .map((c) => {
      const left = c.classList.contains('sticky-left') ? `L${c.style.left}` : '';
      const right = c.classList.contains('sticky-right') ? `R${c.style.right}` : '';
      return left + right || '-';
    });

describe('PinnedColumns with a nested grid using the same fields', () => {
  const ctx = useParentGrid();

  async function setup() {
    const parentPins = new PinnedColumnsPlugin();
    const childPins = new PinnedColumnsPlugin();
    const child = await mountNestedGrid(ctx.parent, {
      parentPlugins: [parentPins],
      childPlugins: [childPins],
      parentColumns: columns() as ColumnConfig<Order>[],
      childColumns: columns(),
    });
    childPins.setPinPosition('c1', 'right');
    await waitUpgrade(child);
    // Header + three child rows.
    expect(ownSides(child, 'c1')).toEqual(['R0px', 'R0px', 'R0px', 'R0px']);
    return { parent: ctx.parent, child, parentPins };
  }

  async function pin(grid: HTMLElement, plugin: PinnedColumnsPlugin, field: string, side: PinnedPosition | undefined) {
    plugin.setPinPosition(field, side);
    await waitUpgrade(grid);
    await new Promise((r) => setTimeout(r));
  }

  it('the parent unpinning a field while another pin remains keeps the child pin', async () => {
    const { parent, child, parentPins } = await setup();
    await pin(parent, parentPins, 'c1', 'right');
    await pin(parent, parentPins, 'c3', 'left');

    await pin(parent, parentPins, 'c1', undefined);

    expect(ownSides(child, 'c1')).toEqual(['R0px', 'R0px', 'R0px', 'R0px']);
    expect(new Set(ownSides(parent, 'c1'))).toEqual(new Set(['-']));
    expect(new Set(ownSides(parent, 'c3'))).toEqual(new Set(['L0px']));
  });

  it('the parent pinning a field to the other side keeps the child pin', async () => {
    const { parent, child, parentPins } = await setup();

    await pin(parent, parentPins, 'c1', 'left');

    expect(ownSides(child, 'c1')).toEqual(['R0px', 'R0px', 'R0px', 'R0px']);
    expect(new Set(ownSides(parent, 'c1'))).toEqual(new Set(['L0px']));
  });
});
