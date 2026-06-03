/**
 * Tests for `@toolbox-web/grid-react/features/shell`.
 *
 * Covers the side-effect registration the module installs at import time:
 * importing it makes the core `shell` feature available so a `ShellPlugin`
 * can be created from feature config. The shell is config-driven (no boolean
 * prop is runtime-extracted), so these tests assert the registry wiring only.
 *
 * @vitest-environment happy-dom
 */
import { createPluginFromFeature } from '@toolbox-web/grid/features/registry';
import { describe, expect, it } from 'vitest';
import './shell';

describe('features/shell (react)', () => {
  it('registers the shell feature factory (from `true`)', () => {
    const plugin = createPluginFromFeature('shell', true);
    expect(plugin).toBeDefined();
    expect((plugin as { name?: string } | undefined)?.name).toBe('shell');
  });

  it('registers the shell feature factory (from a config object)', () => {
    const plugin = createPluginFromFeature('shell', { header: { title: 'Employees' } });
    expect(plugin).toBeDefined();
    expect((plugin as { name?: string } | undefined)?.name).toBe('shell');
  });
});
