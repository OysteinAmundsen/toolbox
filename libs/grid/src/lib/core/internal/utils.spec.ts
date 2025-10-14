import { describe, expect, it } from 'vitest';
import { rafDebounce } from './utils';

describe('utils', () => {
  it('rafDebounce executes last call and supports cancel', async () => {
    const calls: number[] = [];
    const fn = rafDebounce((v: number) => calls.push(v));
    fn(1);
    fn(2); // only 2 should survive
    await new Promise((r) => requestAnimationFrame(r));
    expect(calls).toEqual([2]);
    fn(3);
    (fn as any).cancel();
    await new Promise((r) => requestAnimationFrame(r));
    expect(calls).toEqual([2]);
  });
});
