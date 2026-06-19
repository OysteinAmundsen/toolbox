import { describe, expect, it } from 'vitest';

import {
  dropMarkdownSections,
  filterFrameworkTabs,
  keepMarkdownSections,
  mdxToAgentMarkdown,
  resolveAudienceRegions,
} from './_llm-markdown.js';

/** Minimal options: no demos, no link rewriting, no CSS-var table. */
const noop = { resolveDemo: () => undefined };

describe('resolveAudienceRegions', () => {
  it('removes human-only regions entirely', () => {
    const body = ['before', '', '<Audience only="human">', '', 'marketing copy', '', '</Audience>', '', 'after'].join(
      '\n',
    );
    const out = resolveAudienceRegions(body);
    expect(out).not.toContain('marketing copy');
    expect(out).toContain('before');
    expect(out).toContain('after');
  });

  it('unwraps agent-only regions, keeping the inner content', () => {
    const body = ['before', '', '<Audience only="agent">', '', 'agent steering', '', '</Audience>', '', 'after'].join(
      '\n',
    );
    const out = resolveAudienceRegions(body);
    expect(out).toContain('agent steering');
    expect(out).not.toContain('<Audience');
    expect(out).not.toContain('</Audience>');
  });

  it('handles an agent region whose children contain a code fence', () => {
    const body = ['<Audience only="agent">', '', '```ts', 'const x = 1;', '```', '', '</Audience>'].join('\n');
    const out = resolveAudienceRegions(body);
    expect(out).toContain('const x = 1;');
    expect(out).not.toContain('<Audience');
  });

  it('removes a human region whose children contain a code fence', () => {
    const body = ['<Audience only="human">', '', '```ts', 'secret();', '```', '', '</Audience>'].join('\n');
    expect(resolveAudienceRegions(body)).not.toContain('secret()');
  });

  it('tolerates single quotes and extra attribute whitespace', () => {
    expect(resolveAudienceRegions("<Audience  only='human' >x</Audience>")).toBe('');
    expect(resolveAudienceRegions("<Audience  only='agent' >x</Audience>")).toBe('x');
  });

  it('handles multiple regions in one body independently', () => {
    const body = ['<Audience only="agent">A</Audience>', '<Audience only="human">B</Audience>'].join('\n');
    const out = resolveAudienceRegions(body);
    expect(out).toContain('A');
    expect(out).not.toContain('B');
  });
});

describe('mdxToAgentMarkdown — Audience integration', () => {
  it('strips human-only blocks and keeps agent-only content in the rendered markdown', () => {
    const raw = [
      '---',
      'title: Intro',
      '---',
      'import Audience from "@components/Audience.astro";',
      '',
      '<Audience only="agent">',
      '',
      '## Agent rule',
      '',
      'Always do X.',
      '',
      '</Audience>',
      '',
      'Visible prose.',
      '',
      '<Audience only="human">',
      '',
      'Buy now! Marketing.',
      '',
      '</Audience>',
      '',
    ].join('\n');

    const md = mdxToAgentMarkdown(raw, noop);
    expect(md).toContain('## Agent rule');
    expect(md).toContain('Always do X.');
    expect(md).toContain('Visible prose.');
    expect(md).not.toContain('Marketing');
    expect(md).not.toContain('<Audience');
    // The component import line is stripped like any other import.
    expect(md).not.toContain('import Audience');
  });

  it('restores `_##` sentinel headings to real headings in the agent markdown', () => {
    const raw = [
      '---',
      'title: Intro',
      '---',
      '<Audience only="agent">',
      '',
      '_## RULE 0',
      '',
      'Do the thing.',
      '',
      '_### Sub rule',
      '',
      'Detail.',
      '',
      '</Audience>',
      '',
    ].join('\n');

    const md = mdxToAgentMarkdown(raw, noop);
    expect(md).toContain('## RULE 0');
    expect(md).toContain('### Sub rule');
    // The underscore sentinel must not survive into the agent corpus.
    expect(md).not.toContain('_## RULE 0');
    expect(md).not.toContain('_### Sub rule');
  });

  it('keeps a `_##`-like line untouched inside a code fence', () => {
    const raw = ['---', 'title: Intro', '---', '```md', '_## not a heading here', '```', ''].join('\n');

    const md = mdxToAgentMarkdown(raw, noop);
    // Inside a fence the sentinel is literal content and must be preserved.
    expect(md).toContain('_## not a heading here');
  });
});

describe('mdxToAgentMarkdown — AgentSource directive', () => {
  const sources: Record<string, string> = {
    'demos/app/config.ts': 'export const gridConfig = { columns: [] };\n',
    'demos/app/styles.css': '.grid { height: 400px; }\n',
  };
  const opts = {
    resolveDemo: () => undefined,
    resolveSource: (p: string) => sources[p],
  };

  it('inlines each referenced source as a fenced block with a path provenance comment', () => {
    const raw = ['---', 'title: Demos', '---', '<AgentSource paths="demos/app/config.ts" />', ''].join('\n');
    const md = mdxToAgentMarkdown(raw, opts);
    expect(md).toContain('```ts');
    expect(md).toContain('// demos/app/config.ts');
    expect(md).toContain('export const gridConfig');
    expect(md).not.toContain('<AgentSource');
  });

  it('expands a comma-separated list and infers css vs ts from the extension', () => {
    const raw = [
      '---',
      'title: Demos',
      '---',
      '<AgentSource paths="demos/app/config.ts, demos/app/styles.css" />',
      '',
    ].join('\n');
    const md = mdxToAgentMarkdown(raw, opts);
    expect(md).toContain('// demos/app/config.ts');
    expect(md).toContain('// demos/app/styles.css');
    expect(md).toContain('```css');
    expect(md).toContain('.grid { height: 400px; }');
  });

  it('emits a not-found comment for an unresolved path instead of failing', () => {
    const raw = ['---', 'title: Demos', '---', '<AgentSource paths="demos/app/missing.ts" />', ''].join('\n');
    const md = mdxToAgentMarkdown(raw, opts);
    expect(md).toContain('agent source not found: demos/app/missing.ts');
  });

  it('drops the tag entirely when no resolveSource is supplied', () => {
    const raw = ['---', 'title: Demos', '---', '<AgentSource paths="demos/app/config.ts" />', ''].join('\n');
    const md = mdxToAgentMarkdown(raw, noop);
    expect(md).not.toContain('<AgentSource');
    expect(md).not.toContain('demos/app/config.ts');
  });
});

describe('mdxToAgentMarkdown — AgentSource per-framework override', () => {
  const sources: Record<string, string> = {
    'demos/vanilla/app/grid-config.ts': 'export const vanillaConfig = {};\n',
    'demos/vue/app/EmployeeManagement.vue': '<template><tbw-grid /></template>\n',
    'demos/react/app/EmployeeManagement.tsx': 'export const App = () => <Grid />;\n',
  };
  const resolveSource = (p: string) => sources[p];
  const tag = [
    '<AgentSource',
    '  paths="demos/vanilla/app/grid-config.ts"',
    '  vue="demos/vue/app/EmployeeManagement.vue"',
    '  react="demos/react/app/EmployeeManagement.tsx"',
    '/>',
  ].join('\n');
  const raw = ['---', 'title: Demos', '---', tag, ''].join('\n');

  it('uses the default `paths` (vanilla) set when no framework filter is set', () => {
    const md = mdxToAgentMarkdown(raw, { resolveDemo: () => undefined, resolveSource });
    expect(md).toContain('export const vanillaConfig');
    expect(md).not.toContain('EmployeeManagement.vue');
    expect(md).not.toContain('EmployeeManagement.tsx');
  });

  it('uses the default `paths` (vanilla) set for the vanilla framework filter', () => {
    const md = mdxToAgentMarkdown(raw, { resolveDemo: () => undefined, resolveSource, frameworkFilter: 'vanilla' });
    expect(md).toContain('export const vanillaConfig');
    expect(md).not.toContain('EmployeeManagement.vue');
  });

  it('swaps in the framework-native set for a matching framework filter', () => {
    const md = mdxToAgentMarkdown(raw, { resolveDemo: () => undefined, resolveSource, frameworkFilter: 'vue' });
    expect(md).toContain('// demos/vue/app/EmployeeManagement.vue');
    expect(md).toContain('```vue');
    expect(md).not.toContain('vanillaConfig');
    expect(md).not.toContain('EmployeeManagement.tsx');
  });

  it('falls back to `paths` when the filtered framework has no override attribute', () => {
    const md = mdxToAgentMarkdown(raw, { resolveDemo: () => undefined, resolveSource, frameworkFilter: 'angular' });
    expect(md).toContain('export const vanillaConfig');
    expect(md).not.toContain('EmployeeManagement.vue');
  });

  it('infers the tsx fence language for a React override', () => {
    const md = mdxToAgentMarkdown(raw, { resolveDemo: () => undefined, resolveSource, frameworkFilter: 'react' });
    expect(md).toContain('```tsx');
    expect(md).toContain('// demos/react/app/EmployeeManagement.tsx');
  });
});

describe('filterFrameworkTabs', () => {
  /** A framework tab group offering TypeScript + the three adapter variants. */
  const frameworkTabs = [
    '<Tabs syncKey="framework">',
    '<TabItem label="TypeScript">',
    '```ts',
    'const ts = 1;',
    '```',
    '</TabItem>',
    '<TabItem label="React">',
    '```tsx',
    'const react = 1;',
    '```',
    '</TabItem>',
    '<TabItem label="Vue">',
    '```vue',
    'const vue = 1;',
    '```',
    '</TabItem>',
    '<TabItem label="Angular">',
    '```ts',
    'const angular = 1;',
    '```',
    '</TabItem>',
    '</Tabs>',
  ].join('\n');

  /** A framework-neutral tab group (package managers) that must survive intact. */
  const neutralTabs = [
    '<Tabs syncKey="pkg">',
    '<TabItem label="npm">',
    '```sh',
    'npm i @toolbox-web/grid',
    '```',
    '</TabItem>',
    '<TabItem label="pnpm">',
    '```sh',
    'pnpm add @toolbox-web/grid',
    '```',
    '</TabItem>',
    '</Tabs>',
  ].join('\n');

  it('keeps only the React variant in a framework group', () => {
    const out = filterFrameworkTabs(frameworkTabs, 'react');
    expect(out).toContain('const react = 1;');
    expect(out).toContain('label="React"');
    expect(out).not.toContain('const vue = 1;');
    expect(out).not.toContain('const angular = 1;');
    expect(out).not.toContain('const ts = 1;');
  });

  it('keeps the TypeScript variant for the vanilla target', () => {
    const out = filterFrameworkTabs(frameworkTabs, 'vanilla');
    expect(out).toContain('const ts = 1;');
    expect(out).not.toContain('const react = 1;');
    expect(out).not.toContain('const vue = 1;');
    expect(out).not.toContain('const angular = 1;');
  });

  it('leaves framework-neutral tab groups untouched', () => {
    const out = filterFrameworkTabs(neutralTabs, 'react');
    expect(out).toContain('npm i @toolbox-web/grid');
    expect(out).toContain('pnpm add @toolbox-web/grid');
  });

  it('falls back to the vanilla/TypeScript tab when the target framework is absent', () => {
    const noReact = [
      '<Tabs>',
      '<TabItem label="TypeScript">',
      '```ts',
      'const ts = 1;',
      '```',
      '</TabItem>',
      '<TabItem label="Vue">',
      '```vue',
      'const vue = 1;',
      '```',
      '</TabItem>',
      '</Tabs>',
    ].join('\n');
    const out = filterFrameworkTabs(noReact, 'react');
    expect(out).toContain('const ts = 1;');
    expect(out).not.toContain('const vue = 1;');
  });

  it('flattens to a single framework heading through mdxToAgentMarkdown', () => {
    const raw = ['---', 'title: Tabs', '---', '', frameworkTabs, ''].join('\n');
    const md = mdxToAgentMarkdown(raw, { resolveDemo: () => undefined, frameworkFilter: 'react' });
    expect(md).toContain('#### React');
    expect(md).toContain('const react = 1;');
    expect(md).not.toContain('#### Angular');
    expect(md).not.toContain('#### Vue');
    expect(md).not.toContain('#### TypeScript');
  });

  it('keeps every variant when no frameworkFilter is supplied', () => {
    const raw = ['---', 'title: Tabs', '---', '', frameworkTabs, ''].join('\n');
    const md = mdxToAgentMarkdown(raw, { resolveDemo: () => undefined });
    expect(md).toContain('#### TypeScript');
    expect(md).toContain('#### React');
    expect(md).toContain('#### Vue');
    expect(md).toContain('#### Angular');
  });
});

describe('dropMarkdownSections', () => {
  const page = [
    '# Plugin',
    '',
    '## Installation',
    '',
    "import '@toolbox-web/grid/x';",
    '',
    '## Demos',
    '',
    'Big demo dump.',
    '',
    '### Sub demo',
    '',
    'More demo.',
    '',
    '## Configuration Options',
    '',
    'config truth',
    '',
    '## See Also',
    '',
    '- [x](y)',
  ].join('\n');

  it('removes a named H2 section and its nested subsections', () => {
    const out = dropMarkdownSections(page, ['Demos', 'See Also']);
    expect(out).not.toContain('Big demo dump.');
    expect(out).not.toContain('### Sub demo');
    expect(out).not.toContain('More demo.');
    expect(out).not.toContain('## See Also');
  });

  it('keeps API-bearing sections intact', () => {
    const out = dropMarkdownSections(page, ['Demos', 'See Also']);
    expect(out).toContain('## Installation');
    expect(out).toContain('## Configuration Options');
    expect(out).toContain('config truth');
  });

  it('matches case-insensitively and unwraps linked headings', () => {
    const md = ['## [See Also](/x)', 'links', '## Keep', 'body'].join('\n');
    const out = dropMarkdownSections(md, ['see also']);
    expect(out).not.toContain('links');
    expect(out).toContain('## Keep');
    expect(out).toContain('body');
  });

  it('is a no-op when no names are supplied', () => {
    expect(dropMarkdownSections(page, [])).toBe(page);
  });

  it('matches headings even with CRLF line endings', () => {
    // Source MDX is frequently CRLF-authored (Windows / git autocrlf); a naive
    // `split("\n")` would leave a trailing `\r` and defeat the heading match.
    const crlf = ['## Demos', 'demo body', '## Keep', 'kept body'].join('\r\n');
    const out = dropMarkdownSections(crlf, ['Demos']);
    expect(out).not.toContain('demo body');
    expect(out).toContain('## Keep');
    expect(out).toContain('kept body');
  });

  it('only matches level-2 headings, never deeper or shallower', () => {
    const md = ['# Demos', 'a', '### Demos', 'b', '## Demos', 'c', '## Keep', 'd'].join('\n');
    const out = dropMarkdownSections(md, ['Demos']);
    expect(out).toContain('# Demos');
    expect(out).toContain('### Demos');
    expect(out).toContain('a');
    expect(out).toContain('b');
    expect(out).not.toContain('c');
    expect(out).toContain('## Keep');
  });

  it('drops sections through mdxToAgentMarkdown when dropSections is set', () => {
    const raw = [
      '---',
      'title: Plugin',
      '---',
      '## Installation',
      '',
      'install body',
      '',
      '## See Also',
      '',
      '- link',
    ].join('\n');
    const md = mdxToAgentMarkdown(raw, { resolveDemo: () => undefined, dropSections: ['See Also'] });
    expect(md).toContain('## Installation');
    expect(md).toContain('install body');
    expect(md).not.toContain('## See Also');
    expect(md).not.toContain('- link');
  });
});

describe('keepMarkdownSections', () => {
  const page = [
    'Lead paragraph describing the plugin capability.',
    '',
    '## Installation',
    '',
    "import '@toolbox-web/grid/x';",
    '',
    '## Basic Usage',
    '',
    'minimal usage',
    '',
    '### Try It',
    '',
    'demo body',
    '',
    '## Configuration Options',
    '',
    'big config table',
    '',
    '## Events',
    '',
    'event list',
  ].join('\n');

  it('keeps the preamble plus the listed sections, dropping the rest', () => {
    const out = keepMarkdownSections(page, ['Installation', 'Basic Usage']);
    expect(out).toContain('Lead paragraph describing the plugin capability.');
    expect(out).toContain('## Installation');
    expect(out).toContain('## Basic Usage');
    expect(out).toContain('minimal usage');
    expect(out).not.toContain('## Configuration Options');
    expect(out).not.toContain('big config table');
    expect(out).not.toContain('## Events');
    expect(out).not.toContain('event list');
  });

  it('keeps nested ### subsections of a kept H2', () => {
    const out = keepMarkdownSections(page, ['Basic Usage']);
    expect(out).toContain('### Try It');
    expect(out).toContain('demo body');
  });

  it('matches case-insensitively and unwraps linked headings', () => {
    const md = ['intro', '## [Installation](/x)', 'install body', '## Events', 'events'].join('\n');
    const out = keepMarkdownSections(md, ['installation']);
    expect(out).toContain('install body');
    expect(out).not.toContain('events');
  });

  it('is a no-op when no names are supplied', () => {
    expect(keepMarkdownSections(page, [])).toBe(page);
  });

  it('matches headings even with CRLF line endings', () => {
    const crlf = ['intro', '## Installation', 'install body', '## Events', 'events'].join('\r\n');
    const out = keepMarkdownSections(crlf, ['Installation']);
    expect(out).toContain('install body');
    expect(out).not.toContain('events');
  });

  it('keeps only the listed sections through mdxToAgentMarkdown when keepSections is set', () => {
    const raw = [
      '---',
      'title: Plugin',
      'description: A plugin.',
      '---',
      'Lead capability sentence.',
      '',
      '## Installation',
      '',
      'install body',
      '',
      '## Events',
      '',
      'event detail',
    ].join('\n');
    const md = mdxToAgentMarkdown(raw, { resolveDemo: () => undefined, keepSections: ['Installation'] });
    expect(md).toContain('# Plugin');
    expect(md).toContain('Lead capability sentence.');
    expect(md).toContain('## Installation');
    expect(md).toContain('install body');
    expect(md).not.toContain('## Events');
    expect(md).not.toContain('event detail');
  });
});
