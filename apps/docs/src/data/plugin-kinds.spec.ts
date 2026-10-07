import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getContrastRatio } from './contrast.js';
import { PLUGIN_KIND_INFO, PLUGIN_KIND_NAMES, type PluginKind } from './plugin-kinds.js';

const pluginsDir = join(import.meta.dirname, '../content/docs/grid/plugins');
const css = readFileSync(join(import.meta.dirname, '../styles/plugin-kinds.css'), 'utf8');

/** `pluginKinds` of every curated plugin page (`plugins/<slug>/index.mdx`), keyed by slug. */
const pageKinds = new Map<string, string[] | undefined>();
for (const dir of readdirSync(pluginsDir, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  let source: string;
  try {
    source = readFileSync(join(pluginsDir, dir.name, 'index.mdx'), 'utf8');
  } catch {
    continue;
  }
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? '';
  const list = /^pluginKinds:\s*\[([^\]]*)\]\s*$/m.exec(frontmatter)?.[1];
  pageKinds.set(
    dir.name,
    list?.split(',').map((k) => k.trim().replace(/^['"]|['"]$/g, '')),
  );
}

describe('pluginKinds frontmatter', () => {
  it('is declared, as an inline list, on every curated plugin page', () => {
    const missing = [...pageKinds].filter(([, kinds]) => !kinds?.length).map(([slug]) => slug);
    expect(missing).toEqual([]);
  });

  it('only uses known kinds, without duplicates', () => {
    for (const [slug, kinds = []] of pageKinds) {
      for (const kind of kinds) expect(PLUGIN_KIND_NAMES, slug).toContain(kind);
      expect(new Set(kinds).size, slug).toBe(kinds.length);
    }
  });

  it('matches the "Plugin types" table on the overview page', () => {
    const overview = readFileSync(join(pluginsDir, 'index.mdx'), 'utf8');
    // Display names come from the "Available Plugins" link table: `| [Label](/grid/plugins/<slug>/) |`.
    const names = new Map(
      [...overview.matchAll(/^\| \[([^\]]+)\]\(\/grid\/plugins\/([^/)]+)\/\) \|/gm)].map((m) => [m[2], m[1]]),
    );
    for (const kind of PLUGIN_KIND_NAMES) {
      const { label, description } = PLUGIN_KIND_INFO[kind];
      const row = overview.split('\n').find((line) => line.startsWith(`| <PluginKindChip kind="${kind}" /> |`));
      expect(row, label).toBeDefined();
      expect(row, label).toContain(description);
      const expected = [...pageKinds]
        .filter(([, kinds]) => kinds?.includes(kind))
        .map(([slug]) => `${names.get(slug) ?? `<no Available Plugins entry for ${slug}>`} → ${slug}`)
        .sort();
      const cell = row?.split('|')[3].trim() ?? '';
      const listed = [...cell.matchAll(/\[([^\]]+)\]\(\/grid\/plugins\/([^/)]+)\/\)/g)]
        .map((m) => `${m[1]} → ${m[2]}`)
        .sort();
      expect(listed, label).toEqual(expected);
      if (!expected.length) expect(cell, label).toBe('None yet');
    }
  });
});

describe('plugin-kinds.css', () => {
  const colors = (kind: PluginKind, prop: 'fg' | 'bg') => {
    const block = new RegExp(`\\.plugin-kind\\.${kind}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    const match = new RegExp(`--plugin-kind-${prop}:\\s*light-dark\\(([^,]+),\\s*([^)]+)\\)`).exec(block);
    return { light: match?.[1].trim() ?? '', dark: match?.[2].trim() ?? '' };
  };

  it.each(PLUGIN_KIND_NAMES)('%s chip text is AAA (≥ 7:1) in light and dark mode', (kind) => {
    const fg = colors(kind, 'fg');
    const bg = colors(kind, 'bg');
    expect(getContrastRatio(fg.light, bg.light), 'light').toBeGreaterThanOrEqual(7);
    expect(getContrastRatio(fg.dark, bg.dark), 'dark').toBeGreaterThanOrEqual(7);
  });

  it('gives every kind its own background', () => {
    const backgrounds = PLUGIN_KIND_NAMES.map((kind) => colors(kind, 'bg'));
    expect(new Set(backgrounds.map((bg) => bg.light)).size).toBe(PLUGIN_KIND_NAMES.length);
    expect(new Set(backgrounds.map((bg) => bg.dark)).size).toBe(PLUGIN_KIND_NAMES.length);
  });
});
