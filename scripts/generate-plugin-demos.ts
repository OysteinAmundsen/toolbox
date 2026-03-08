#!/usr/bin/env bun
/**
 * generate-plugin-demos.ts — One-shot script that:
 *  1. Migrates curated MDX pages from Storybook format to Starlight
 *  2. Generates .astro demo components from story render functions
 *  3. Inserts demo imports and components into the migrated MDX pages
 *
 * Usage: bun run scripts/generate-plugin-demos.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';

// ─── Paths ───────────────────────────────────────────────────────────────
const PLUGINS_SRC = join(import.meta.dirname, '../libs/grid/src/lib/plugins');
const DEMOS_DIR = join(import.meta.dirname, '../apps/docs/src/components/demos');
const DOCS_DIR = join(import.meta.dirname, '../apps/docs/src/content/docs/grid/plugins');

// Plugins to skip (already done manually)
const SKIP_PLUGINS = new Set(['selection']);

// ─── Storybook → Starlight link mapping ──────────────────────────────────
const LINK_MAP: Record<string, string> = {
  '/docs/grid-plugins-selection--docs': '/grid/plugins/selection/',
  '/docs/grid-plugins-editing--docs': '/grid/plugins/editing/',
  '/docs/grid-plugins-filtering--docs': '/grid/plugins/filtering/',
  '/docs/grid-plugins-clipboard--docs': '/grid/plugins/clipboard/',
  '/docs/grid-plugins-export--docs': '/grid/plugins/export/',
  '/docs/grid-plugins-multi-sort--docs': '/grid/plugins/multi-sort/',
  '/docs/grid-plugins-visibility--docs': '/grid/plugins/visibility/',
  '/docs/grid-plugins-pinned-columns--docs': '/grid/plugins/pinned-columns/',
  '/docs/grid-plugins-pinned-rows--docs': '/grid/plugins/pinned-rows/',
  '/docs/grid-plugins-reorder--docs': '/grid/plugins/reorder/',
  '/docs/grid-plugins-row-reorder--docs': '/grid/plugins/row-reorder/',
  '/docs/grid-plugins-grouping-rows--docs': '/grid/plugins/grouping-rows/',
  '/docs/grid-plugins-grouping-columns--docs': '/grid/plugins/grouping-columns/',
  '/docs/grid-plugins-tree--docs': '/grid/plugins/tree/',
  '/docs/grid-plugins-master-detail--docs': '/grid/plugins/master-detail/',
  '/docs/grid-plugins-responsive--docs': '/grid/plugins/responsive/',
  '/docs/grid-plugins-context-menu--docs': '/grid/plugins/context-menu/',
  '/docs/grid-plugins-undo-redo--docs': '/grid/plugins/undo-redo/',
  '/docs/grid-plugins-column-virtualization--docs': '/grid/plugins/column-virtualization/',
  '/docs/grid-plugins-server-side--docs': '/grid/plugins/server-side/',
  '/docs/grid-plugins-pivot--docs': '/grid/plugins/pivot/',
  '/docs/grid-plugins-print--docs': '/grid/plugins/print/',
  '/docs/grid-getting-started--docs': '/grid/getting-started/',
  '/docs/grid-introduction--docs': '/grid/introduction/',
  '/docs/grid-guides-theming--docs': '/grid/guides/theming/',
  '/docs/grid-guides-custom-plugins--docs': '/grid/guides/custom-plugins/',
  '/docs/grid-guides-architecture--docs': '/grid/guides/architecture/',
  '/docs/grid-guides-performance--docs': '/grid/guides/performance/',
  '/docs/grid-guides-accessibility--docs': '/grid/guides/accessibility/',
  '/docs/grid-guides-troubleshooting--docs': '/grid/guides/troubleshooting/',
};

// ─── Plugin description map ──────────────────────────────────────────────
const DESCRIPTIONS: Record<string, string> = {
  clipboard: 'Copy and paste grid data with Excel-compatible clipboard support.',
  'column-virtualization': 'Improve performance for grids with many columns by only rendering visible columns.',
  'context-menu': 'Add right-click context menus to the grid with customizable items.',
  editing: 'Enable inline cell editing with built-in and custom editors.',
  export: 'Export grid data to CSV or other formats.',
  filtering: 'Add column-level filtering with built-in filter panel and custom filters.',
  'grouping-columns': 'Group columns visually under shared parent headers.',
  'grouping-rows': 'Group rows by column values with expandable groups.',
  'master-detail': 'Show expandable detail rows beneath data rows.',
  'multi-sort': 'Sort by multiple columns with shift-click support.',
  'pinned-columns': 'Pin columns to the left or right side of the grid.',
  'pinned-rows': 'Pin summary or custom rows to the top or bottom of the grid.',
  pivot: 'Transform row data into a cross-tabulation (pivot table) layout.',
  print: 'Print the grid contents with configurable page settings.',
  reorder: 'Allow users to reorder columns by drag and drop.',
  responsive: 'Automatically adapt the grid layout for different screen sizes.',
  'row-reorder': 'Allow users to reorder rows by drag and drop.',
  'server-side': 'Connect the grid to server-side data sources with virtual scrolling.',
  tree: 'Display hierarchical data as an expandable tree.',
  'undo-redo': 'Add undo/redo support for cell edits.',
  visibility: 'Allow users to toggle column visibility via a panel.',
};

/** Migrate a Storybook MDX file to Starlight-compatible MDX */
function migratePluginMdx(pluginName: string): void {
  const srcPath = join(PLUGINS_SRC, pluginName, `${pluginName}.mdx`);
  const destPath = join(DOCS_DIR, pluginName, 'index.mdx');

  if (!existsSync(srcPath)) return;
  if (existsSync(destPath)) return; // Already migrated

  let content = readFileSync(srcPath, 'utf-8');

  // Strip AI-CONTEXT comments
  content = content.replace(/\{\/\*\s*AI-CONTEXT[\s\S]*?\*\/\}\n?/g, '');

  // Strip standalone MDX comment lines like {/* filename.mdx */}
  content = content.replace(/^\{\/\*.*?\*\/\}\n?/gm, '');

  // Strip Storybook imports
  content = content.replace(/import\s+\{[^}]*\}\s+from\s+['"]@storybook[^'"]*['"];\n?/g, '');
  content = content.replace(/import\s+\{[^}]*\}\s+from\s+['"][^'"]*storybook[^'"]*['"];\n?/g, '');
  content = content.replace(/import\s+\*\s+as\s+\w+\s+from\s+['"]\.\/[^'"]*\.stories['"];\n?/g, '');

  // Strip <Meta /> tag
  content = content.replace(/<Meta\s+of=\{[^}]*\}\s*\/>\n?/g, '');
  content = content.replace(/<Meta\s+title=[^/]*\/>\n?/g, '');

  // Strip <Canvas /> and <Controls /> tags (demos will be re-added)
  content = content.replace(/<Canvas\s+[^/]*\/>\n?/g, '');
  content = content.replace(/<Controls\s+[^/]*\/>\n?/g, '');

  // Convert <Tab label="X"> to <TabItem label="X">
  content = content.replace(/<Tab\s+label="([^"]*)">/g, '<TabItem label="$1">');
  content = content.replace(/<\/Tab>/g, '</TabItem>');

  // Replace Storybook links with Starlight paths
  for (const [sbPath, slPath] of Object.entries(LINK_MAP)) {
    content = content.replaceAll(sbPath, slPath);
  }
  // Catch remaining Storybook-style links
  content = content.replace(/\(\/docs\/grid-plugins-([\w-]+)--docs\)/g, '(/grid/plugins/$1/)');
  content = content.replace(/\(\/docs\/grid-([\w-]+)--docs\)/g, '(/grid/$1/)');
  content = content.replace(/\?path=\/docs\/grid-plugins-([\w-]+)--docs/g, '/grid/plugins/$1/');
  content = content.replace(/\?path=\/docs\/grid-([\w-]+)--docs/g, '/grid/$1/');

  // Add Starlight frontmatter
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : kebabToPascal(pluginName) + ' Plugin';
  const desc = DESCRIPTIONS[pluginName] || `Configuration and usage guide for the ${title}.`;

  const hasTabs = content.includes('<TabItem') || content.includes('<Tabs>');
  const tabsImport = hasTabs ? "\nimport { Tabs, TabItem } from '@astrojs/starlight/components';\n\n" : '\n';

  const frontmatter = `---\ntitle: "${title}"\ndescription: "${desc}"\n---\n${tabsImport}`;

  // Remove leading blank lines
  content = content.replace(/^\s*\n+/, '');

  content = frontmatter + content;

  // Clean up multiple blank lines
  content = content.replace(/\n{4,}/g, '\n\n\n');

  mkdirSync(join(DOCS_DIR, pluginName), { recursive: true });
  writeFileSync(destPath, content);
  console.log(`  📄 Migrated ${pluginName}.mdx → ${pluginName}/index.mdx`);
}

// ─── Types ───────────────────────────────────────────────────────────────
interface CanvasRef {
  storyName: string;
  hasControls: boolean;
}

interface StoryData {
  name: string;
  args: Record<string, unknown>;
  renderBody: string;
  renderArgName: string | null;
}

interface ModuleData {
  preamble: string; // Module-level code (data, helpers, imports)
  stories: Map<string, StoryData>;
  imports: string[]; // Original import lines
  pluginImports: string[]; // Plugin imports (from '.' or '..')
  externalImports: string[]; // Package-level imports
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function kebabToPascal(kebab: string): string {
  return kebab.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
}

function camelToKebab(camel: string): string {
  return camel.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** Extract Canvas references from original Storybook MDX */
function extractCanvasRefs(pluginName: string): CanvasRef[] {
  const mdxPath = join(PLUGINS_SRC, pluginName, `${pluginName}.mdx`);
  if (!existsSync(mdxPath)) return [];
  const content = readFileSync(mdxPath, 'utf-8');
  const lines = content.split('\n');

  const refs: CanvasRef[] = [];
  for (let i = 0; i < lines.length; i++) {
    const canvasMatch = lines[i].match(/<Canvas\s+of=\{\w+Stories\.(\w+)\}/);
    if (canvasMatch) {
      // Check if next non-empty line has Controls for the same story
      let hasControls = false;
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        if (lines[j].match(/<Controls\s+of=\{\w+Stories\.\w+\}/)) {
          hasControls = true;
          break;
        }
      }
      refs.push({ storyName: canvasMatch[1], hasControls });
    }
  }
  return refs;
}

/** Parse a story file and extract module-level code + individual story render functions */
function parseStoryFile(pluginName: string): ModuleData | null {
  const storyPath = join(PLUGINS_SRC, pluginName, `${pluginName}.stories.ts`);
  if (!existsSync(storyPath)) return null;

  const content = readFileSync(storyPath, 'utf-8');
  const lines = content.split('\n');
  const stories = new Map<string, StoryData>();

  // Find all story export positions
  const storyPositions: { name: string; startLine: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^export\s+const\s+(\w+)\s*:\s*Story(?:Obj)?\b/);
    if (m) {
      storyPositions.push({ name: m[1], startLine: i });
    }
  }

  // Extract meta-level default args (inherited by all stories)
  const metaStartLine = lines.findIndex((l) => l.match(/^const\s+meta\s*:/));
  const metaEndLine = lines.findIndex((l) => l.match(/^export\s+default\s+meta/));
  let metaArgs: Record<string, unknown> = {};
  if (metaStartLine >= 0 && metaEndLine >= 0) {
    const metaBlock = lines.slice(metaStartLine, metaEndLine + 1).join('\n');
    metaArgs = extractArgs(metaBlock);
  }

  // Extract each story's render function
  for (const pos of storyPositions) {
    const storyBlock = extractStoryBlock(lines, pos.startLine);
    const renderInfo = extractRenderFunction(storyBlock);
    const storyArgs = extractArgs(storyBlock);

    // Merge meta-level defaults with story-level overrides
    const mergedArgs = { ...metaArgs, ...storyArgs };

    stories.set(pos.name, {
      name: pos.name,
      args: mergedArgs,
      renderBody: renderInfo.body,
      renderArgName: renderInfo.argName,
    });
  }

  // Extract module-level code (everything before `export default meta;` except imports and meta)
  const preambleLines: string[] = [];
  const imports: string[] = [];
  const pluginImports: string[] = [];
  const externalImports: string[] = [];

  for (let i = 0; i < (metaEndLine >= 0 ? metaEndLine : lines.length); i++) {
    const line = lines[i];
    if (line.match(/^import\s+/)) {
      imports.push(line);
      if (line.includes("from '.") || line.includes('from ".')) {
        pluginImports.push(line);
      } else if (!line.includes('@storybook') && !line.includes("from 'lit")) {
        externalImports.push(line);
      }
    }
  }

  // Find module-level data/helpers (after meta, before first story export)
  // Only include `const` data declarations (arrays, objects, primitives) — skip
  // interfaces, types, functions, export statements, and let/var since those are
  // almost always Storybook-specific helpers.
  const firstStoryLine = storyPositions.length > 0 ? storyPositions[0].startLine : lines.length;
  let skipUntilBracesClose = false;
  let skipBraces = 0;

  for (let i = 0; i < firstStoryLine; i++) {
    const line = lines[i];

    // If we're skipping a multi-line block (interface, function, meta, etc.)
    if (skipUntilBracesClose) {
      skipBraces += (line.match(/{/g) || []).length;
      skipBraces -= (line.match(/}/g) || []).length;
      if (skipBraces <= 0) skipUntilBracesClose = false;
      continue;
    }

    // Skip imports, blank lines, type aliases, export lines
    if (line.match(/^import\s+/) || line.trim() === '') continue;
    if (line.match(/^export\s+default\s+/) || line.match(/^export\s+type\s+/)) continue;
    if (line.match(/^type\s+\w+/)) continue;

    // Skip multi-line blocks: interfaces, functions, meta, let declarations
    if (line.match(/^(interface|function|class|const\s+meta|let\s+|var\s+)/)) {
      if (line.includes('{')) {
        skipBraces = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
        if (skipBraces > 0) {
          skipUntilBracesClose = true;
        }
      }
      continue;
    }

    // Only include `const` declarations (shared data)
    if (line.match(/^const\s+/)) {
      preambleLines.push(line);
      // If it's a multi-line const (array/object), include until balanced
      if (line.includes('{') || line.includes('[')) {
        let braces = (line.match(/[{[]/g) || []).length - (line.match(/[}\]]/g) || []).length;
        while (braces > 0 && i + 1 < firstStoryLine) {
          i++;
          preambleLines.push(lines[i]);
          braces += (lines[i].match(/[{[]/g) || []).length;
          braces -= (lines[i].match(/[}\]]/g) || []).length;
        }
      }
      continue;
    }

    // Include JSDoc comments before const declarations
    if (line.trim().startsWith('/**') || line.trim().startsWith('*') || line.trim().startsWith('//')) {
      // Only include if followed by a const on the next non-comment line
      let j = i + 1;
      while (j < firstStoryLine && (lines[j].trim().startsWith('*') || lines[j].trim().startsWith('//'))) j++;
      if (j < firstStoryLine && lines[j].match(/^const\s+/)) {
        preambleLines.push(line);
      }
      continue;
    }
  }

  return {
    preamble: preambleLines.join('\n'),
    stories,
    imports,
    pluginImports,
    externalImports,
  };
}

/** Extract the full block of a story export (from `export const X` to the closing `};`) */
function extractStoryBlock(lines: string[], startLine: number): string {
  let braces = 0;
  let started = false;
  const blockLines: string[] = [];

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    blockLines.push(line);

    for (const ch of line) {
      if (ch === '{') {
        braces++;
        started = true;
      }
      if (ch === '}') braces--;
    }
    if (started && braces === 0) break;
  }

  return blockLines.join('\n');
}

/** Extract the render function body from a story block */
function extractRenderFunction(storyBlock: string): { body: string; argName: string | null } {
  // Find `render: (args) => {` or `render: () => {`
  const renderMatch = storyBlock.match(/render:\s*\((\w*)\s*(?::\s*\w+)?\)\s*=>\s*\{/);
  if (!renderMatch) {
    return { body: '', argName: null };
  }

  const argName = renderMatch[1] || null;
  const renderStart = storyBlock.indexOf(renderMatch[0]);
  const bodyStart = storyBlock.indexOf('{', renderStart + renderMatch[0].indexOf('=>'));

  // Track braces to find the end of the render function
  let braces = 0;
  let bodyEnd = bodyStart;
  for (let i = bodyStart; i < storyBlock.length; i++) {
    if (storyBlock[i] === '{') braces++;
    if (storyBlock[i] === '}') braces--;
    if (braces === 0) {
      bodyEnd = i;
      break;
    }
  }

  // Extract body between outer braces
  let body = storyBlock.slice(bodyStart + 1, bodyEnd).trim();

  return { body, argName };
}

/** Extract args from a story block */
function extractArgs(storyBlock: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  // Match `args: { key: value, ... }`
  const argsMatch = storyBlock.match(/args:\s*\{([^}]+)\}/);
  if (argsMatch) {
    const argsStr = argsMatch[1];
    const pairs = argsStr.matchAll(/(\w+)\s*:\s*([^,\n]+)/g);
    for (const pair of pairs) {
      const key = pair[1];
      let val: unknown = pair[2].trim();
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (!isNaN(Number(val))) val = Number(val);
      else if (typeof val === 'string') val = val.replace(/^['"]|['"]$/g, '');
      args[key] = val;
    }
  }
  return args;
}

/** Resolve relative plugin imports to package-level imports */
function resolveImport(importLine: string, pluginName: string): string {
  // Convert `../selection/SelectionPlugin` → `@toolbox-web/grid/plugins/selection`
  // Convert `./ClipboardPlugin` → `@toolbox-web/grid/plugins/clipboard`
  // Convert `../../../public` → `@toolbox-web/grid`
  // Convert `../../../index` → `@toolbox-web/grid`

  return importLine
    .replace(/from\s+['"]\.\/\w+Plugin['"]/, `from '@toolbox-web/grid/plugins/${pluginName}'`)
    .replace(/from\s+['"]\.\/types['"]/, `from '@toolbox-web/grid/plugins/${pluginName}'`)
    .replace(
      /from\s+['"]\.\.\/([\w-]+)\/\w+Plugin['"]/,
      (_, p) => `from '@toolbox-web/grid/plugins/${camelToKebab(p)}'`,
    )
    .replace(/from\s+['"]\.\.\/([\w-]+)['"]/, (_, p) => `from '@toolbox-web/grid/plugins/${p}'`)
    .replace(/from\s+['"]\.\.\/\.\.\/\.\.\/public['"]/, `from '@toolbox-web/grid'`)
    .replace(/from\s+['"]\.\.\/\.\.\/\.\.\/index['"]/, `from '@toolbox-web/grid'`);
}

/** Transform a render function body for use in an Astro <script> block */
function transformRenderBody(
  body: string,
  storyArgs: Record<string, unknown>,
  argName: string | null,
  demoId: string,
): { html: string; script: string; height: string; needsWrapper: boolean } {
  let height = '350px';
  let needsWrapper = false;
  let script = body;

  // Extract height from `grid.style.height = 'Xpx'`
  const heightMatch = script.match(/grid\.style\.height\s*=\s*['"](\d+px)['"]/);
  if (heightMatch) {
    height = heightMatch[1];
    script = script.replace(/grid\.style\.height\s*=\s*['"][^'"]*['"]\s*;?\n?/, '');
  }

  // Check if render creates a wrapper/container (returns something other than grid)
  const returnsWrapper = script.match(/return\s+(wrapper|container|fragment)\s*;/);
  if (returnsWrapper) {
    needsWrapper = true;
  }

  // Replace `const grid = document.createElement('tbw-grid') as GridElement;`
  script = script.replace(
    /const\s+grid\s*=\s*document\.createElement\(['"]tbw-grid['"]\)\s*(as\s+\w+\s*)?;/,
    `const grid = container.querySelector('tbw-grid');`,
  );

  // Remove return statements
  script = script.replace(/return\s+(grid|wrapper|container|fragment)\s*;?\s*$/m, '');

  // Remove wrapper/container creation and appendChild
  script = script.replace(/const\s+(wrapper|container|fragment)\s*=\s*document\.createElement\([^)]+\)\s*;/g, '');
  script = script.replace(/(wrapper|container|fragment)\.(appendChild|append)\([^)]*\)\s*;/g, '');
  script = script.replace(/(wrapper|container|fragment)\.style\.\w+\s*=\s*['"][^'"]*['"]\s*;/g, '');
  script = script.replace(/(wrapper|container|fragment)\.className\s*=\s*['"][^'"]*['"]\s*;/g, '');
  script = script.replace(/(wrapper|container|fragment)\.id\s*=\s*['"][^'"]*['"]\s*;/g, '');

  // Replace args references with actual values
  if (argName && Object.keys(storyArgs).length > 0) {
    for (const [key, val] of Object.entries(storyArgs)) {
      const pattern = new RegExp(`${argName}\\.${key}\\b`, 'g');
      script = script.replace(pattern, JSON.stringify(val));
    }
    // Also replace `args` as a spread or direct usage
    script = script.replace(new RegExp(`\\.\\.\\.${argName}\\b`, 'g'), JSON.stringify(storyArgs).slice(1, -1));
  }

  // Replace mutable module-level args references (remove the entire statement)
  script = script.replace(/\s*current\w+Args\s*=[^;]*;\n?/g, '');

  // Strip remaining TypeScript annotations for plain JS
  script = script.replace(/\s+as\s+\w+(\[\])?\s*[;,)]/g, (m) => m.slice(m.search(/[;,)]/))); // as Foo; → ;
  script = script.replace(/^(\s*(?:const|let|var)\s+\w+)\s*:[^=]+=/gm, '$1 ='); // local TS type annotations
  script = script.replace(/\((\w+)\s*:\s*\w+[^)]*\)\s*=>/g, '($1) =>'); // (arg: Type) => → (arg) =>

  // Check for Lit HTML usage (not convertible to plain script)
  if (script.includes('html`') || script.includes("from 'lit'")) {
    throw new Error('Lit HTML story — requires manual conversion');
  }

  // Clean up empty lines
  script = script.replace(/\n{3,}/g, '\n\n');
  script = script.trim();

  // Build extra HTML for complex demos
  let html = '';

  // Check for output/event log panels
  const hasOutput = script.includes('output') && (script.includes('event') || script.includes('log'));
  if (hasOutput) {
    html += `\n  <div class="grid-demo-output" data-output-id="${demoId}"><span style="color: var(--sl-color-gray-3);">Interact to see events...</span></div>`;
    // Replace output element creation with query
    script = script.replace(
      /const\s+output\s*=\s*document\.createElement\([^)]+\)\s*;/,
      `const output = container.querySelector('[data-output-id="${demoId}"]');`,
    );
    script = script.replace(/output\.(className|id|style\.\w+)\s*=\s*['"][^'"]*['"]\s*;/g, '');
  }

  // Check for button/toolbar elements in the render body
  const hasButtons = script.includes("createElement('button')") || script.includes('createElement("button")');

  if (hasButtons) {
    html = `\n  <div class="grid-playground-controls" data-controls-id="${demoId}"></div>` + html;
    // Replace button container creation
    script = script.replace(
      /const\s+(toolbar|buttonContainer|controls|btnContainer)\s*=\s*document\.createElement\([^)]+\)\s*;/g,
      `const $1 = container.querySelector('[data-controls-id="${demoId}"]');`,
    );
  }

  return { html, script, height, needsWrapper };
}

/** Generate the .astro content for a demo */
function generateAstroFile(
  pluginName: string,
  storyName: string,
  moduleData: ModuleData,
  storyData: StoryData,
): string {
  const demoId = `${pluginName}-${camelToKebab(storyName)}-demo`;
  const {
    html: extraHtml,
    script,
    height,
  } = transformRenderBody(storyData.renderBody, storyData.args, storyData.renderArgName, demoId);

  // Build import lines
  const importLines: string[] = ["import '@toolbox-web/grid';"];

  // Add plugin imports (resolved to package level)
  for (const imp of moduleData.pluginImports) {
    const resolved = resolveImport(imp, pluginName);
    // Skip type-only imports and Storybook imports
    if (resolved.includes('type ') && !resolved.includes('GridElement')) continue;
    if (resolved.includes('@storybook')) continue;
    importLines.push(resolved);
  }

  // Add external imports (skip Storybook and lit)
  for (const imp of moduleData.externalImports) {
    if (
      imp.includes('@toolbox-web/grid') &&
      !importLines.some((l) => l.includes(imp.match(/from\s+['"]([^'"]+)/)?.[1] || ''))
    ) {
      importLines.push(imp);
    }
  }

  // Deduplicate imports
  const uniqueImports = [...new Set(importLines)];

  // Build the preamble (module-level data/helpers)
  let preamble = moduleData.preamble;
  // Remove TypeScript type annotations from preamble for plain-JS <script> blocks
  // `const x: SomeType[] = [...]` → `const x = [...]`
  preamble = preamble.replace(/^(const\s+\w+)\s*:[^=]+=/gm, '$1 =');
  preamble = preamble.replace(/\s+as\s+const\b/g, ''); // as const  → (remove)

  const astroContent = `---
// ${kebabToPascal(pluginName)}${storyName}Demo.astro
---
<div class="grid-demo not-content" id="${demoId}">
  <tbw-grid style="display: block; height: ${height};"></tbw-grid>${extraHtml}
</div>

<script>
${uniqueImports.join('\n')}

const container = document.getElementById('${demoId}');
if (container) {
${
  preamble
    ? preamble
        .split('\n')
        .map((l) => '  ' + l)
        .join('\n') + '\n\n'
    : ''
}  ${script.split('\n').join('\n  ')}
}
</script>
`;

  return astroContent;
}

/** Insert demo imports and components into the docs MDX file */
function updateMdxFile(pluginName: string, canvasRefs: CanvasRef[]): void {
  const mdxPath = join(DOCS_DIR, pluginName, 'index.mdx');
  if (!existsSync(mdxPath)) {
    console.warn(`  ⚠️  No MDX at ${mdxPath}`);
    return;
  }

  let content = readFileSync(mdxPath, 'utf-8');

  // Build import lines and component map
  const componentMap = new Map<string, string>();
  const newImportLines: string[] = [];

  for (const ref of canvasRefs) {
    const componentName = `${kebabToPascal(pluginName)}${ref.storyName}Demo`;
    const importPath = `@components/demos/${pluginName}/${componentName}.astro`;
    const importLine = `import ${componentName} from '${importPath}';`;
    componentMap.set(ref.storyName, componentName);
    newImportLines.push(importLine);
  }

  // ─── Step 1: Remove any existing demo imports (idempotency) ────────────
  for (const line of newImportLines) {
    content = content.replace(line + '\n', '');
    content = content.replace('\n' + line, '');
    content = content.replace(line, '');
  }

  // ─── Step 2: Find the right import insertion point ─────────────────────
  // Imports must be placed right after frontmatter (---) and before the first
  // non-import line. We look for the TOP-LEVEL imports only (lines starting
  // with `import` that are NOT inside a code block).
  const lines = content.split('\n');
  let inFrontmatter = false;
  let frontmatterCount = 0;
  let inCodeBlock = false;
  let lastTopLevelImportLine = -1;
  let firstLineAfterFrontmatter = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track frontmatter (---...---)
    if (line.trim() === '---') {
      frontmatterCount++;
      if (frontmatterCount === 1) inFrontmatter = true;
      else if (frontmatterCount === 2) {
        inFrontmatter = false;
        firstLineAfterFrontmatter = i + 1;
      }
      continue;
    }
    if (inFrontmatter) continue;

    // Track code blocks (```)
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Track top-level imports (not inside code blocks or frontmatter)
    if (line.match(/^import\s+/)) {
      lastTopLevelImportLine = i;
    }
  }

  // Insert after last top-level import, or right after frontmatter
  const insertAfterLine =
    lastTopLevelImportLine >= 0
      ? lastTopLevelImportLine
      : firstLineAfterFrontmatter >= 0
        ? firstLineAfterFrontmatter - 1
        : 0;

  // Build the import block (with trailing blank line to separate from markdown)
  const importBlock = newImportLines.join('\n') + '\n';
  lines.splice(insertAfterLine + 1, 0, importBlock);

  content = lines.join('\n');

  // ─── Step 3: Insert <Component /> tags at the right positions ──────────
  const origPath = join(PLUGINS_SRC, pluginName, `${pluginName}.mdx`);
  const origContent = existsSync(origPath) ? readFileSync(origPath, 'utf-8') : '';
  const origLines = origContent.split('\n');

  for (const ref of canvasRefs) {
    const componentName = componentMap.get(ref.storyName)!;
    const tag = `<${componentName} />`;

    // Remove existing tag first (idempotency)
    content = content.replace(new RegExp(`\\n?${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`, 'g'), '\n');

    // Find the heading that precedes this Canvas in the ORIGINAL MDX
    let headingText = '';
    for (let i = 0; i < origLines.length; i++) {
      if (origLines[i].includes(`<Canvas of={`) && origLines[i].includes(ref.storyName)) {
        for (let j = i - 1; j >= 0; j--) {
          const hMatch = origLines[j].match(/^(#{2,4})\s+(.+)/);
          if (hMatch) {
            headingText = hMatch[2].trim();
            break;
          }
        }
        break;
      }
    }

    if (!headingText) {
      console.warn(`  ⚠️  Could not find heading for ${ref.storyName} in ${pluginName}`);
      continue;
    }

    // Find this heading in the converted MDX (not inside code blocks)
    const contentLines = content.split('\n');
    let targetLine = -1;
    let codeBlockActive = false;
    for (let i = 0; i < contentLines.length; i++) {
      if (contentLines[i].trim().startsWith('```')) codeBlockActive = !codeBlockActive;
      if (codeBlockActive) continue;
      const hMatch = contentLines[i].match(/^(#{2,4})\s+(.+)/);
      if (hMatch && hMatch[2].trim() === headingText) {
        targetLine = i;
        break;
      }
    }

    if (targetLine < 0) {
      console.warn(`  ⚠️  Heading "${headingText}" not found in converted MDX for ${pluginName}`);
      continue;
    }

    // Find where to insert: after the heading's description paragraph(s)
    // Skip non-empty lines (description), then insert at the first empty line
    let insertLine = targetLine + 1;
    let foundContent = false;
    for (let i = targetLine + 1; i < contentLines.length; i++) {
      const trimmed = contentLines[i].trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('<')) {
        foundContent = true;
        insertLine = i + 1;
      } else if (foundContent || trimmed === '') {
        insertLine = i;
        break;
      } else if (trimmed.startsWith('#')) {
        insertLine = i;
        break;
      }
    }

    contentLines.splice(insertLine, 0, '', tag);
    content = contentLines.join('\n');
  }

  // Clean up excessive blank lines
  content = content.replace(/\n{4,}/g, '\n\n\n');

  writeFileSync(mdxPath, content);
}

// ─── Main ────────────────────────────────────────────────────────────────
const plugins = readdirSync(PLUGINS_SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => !SKIP_PLUGINS.has(name));

// Step 1: Migrate all plugin MDX files (Storybook → Starlight)
console.log('Step 1: Migrating Storybook MDX → Starlight MDX\n');
for (const pluginName of plugins) {
  migratePluginMdx(pluginName);
}

// Step 2 & 3: Generate demos and insert into MDX
console.log('\nStep 2–3: Generating demos & updating MDX\n');

let totalGenerated = 0;
let totalSkipped = 0;
const issues: string[] = [];

for (const pluginName of plugins) {
  const canvasRefs = extractCanvasRefs(pluginName);
  if (canvasRefs.length === 0) {
    console.log(`⏭  ${pluginName}: no Canvas references`);
    continue;
  }

  const moduleData = parseStoryFile(pluginName);
  if (!moduleData) {
    console.warn(`⚠️  ${pluginName}: no story file found`);
    continue;
  }

  console.log(`📦 ${pluginName}: ${canvasRefs.length} demos`);

  const demoDir = join(DEMOS_DIR, pluginName);
  mkdirSync(demoDir, { recursive: true });

  const generatedRefs: CanvasRef[] = [];

  for (const ref of canvasRefs) {
    const storyData = moduleData.stories.get(ref.storyName);
    if (!storyData) {
      console.warn(`  ⚠️  Story "${ref.storyName}" not found in ${pluginName}.stories.ts`);
      issues.push(`${pluginName}/${ref.storyName}: story not found`);
      totalSkipped++;
      continue;
    }

    if (!storyData.renderBody) {
      console.warn(`  ⚠️  Story "${ref.storyName}" has no render function`);
      issues.push(`${pluginName}/${ref.storyName}: no render function`);
      totalSkipped++;
      continue;
    }

    const componentName = `${kebabToPascal(pluginName)}${ref.storyName}Demo`;
    const astroPath = join(demoDir, `${componentName}.astro`);

    try {
      const content = generateAstroFile(pluginName, ref.storyName, moduleData, storyData);
      writeFileSync(astroPath, content);
      console.log(`  ✅ ${componentName}.astro`);
      totalGenerated++;
      generatedRefs.push(ref);
    } catch (err) {
      console.error(`  ❌ ${componentName}: ${err}`);
      issues.push(`${pluginName}/${ref.storyName}: ${err}`);
      totalSkipped++;
    }
  }

  // Update MDX — only include successfully generated demos
  if (generatedRefs.length > 0) {
    try {
      updateMdxFile(pluginName, generatedRefs);
      console.log(`  📝 Updated ${pluginName}/index.mdx`);
    } catch (err) {
      console.error(`  ❌ MDX update failed: ${err}`);
      issues.push(`${pluginName}/index.mdx: ${err}`);
    }
  }
}

console.log('\n' + '═'.repeat(60));
console.log(`✅ Generated: ${totalGenerated} demo components`);
console.log(`⏭  Skipped: ${totalSkipped}`);
if (issues.length > 0) {
  console.log('\n⚠️  Issues:');
  issues.forEach((i) => console.log(`   - ${i}`));
}
console.log('\nDone!');
