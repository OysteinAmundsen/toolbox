/**
 * Generate Storybook MDX files from TypeDoc JSON output for grid-vue.
 *
 * This script reads the structured JSON from TypeDoc and generates clean MDX files
 * for the Vue adapter library documentation.
 *
 * Run: `bun nx typedoc grid-vue`
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import {
  genClass,
  GENERATORS,
  genFunction,
  isInternal,
  KIND,
  touchStorybookMain,
  writeMdx,
  type TypeDocNode,
} from '../../../tools/typedoc-mdx-shared';

const API_GENERATED_DIR = join(import.meta.dirname, '../docs/api-generated');
const OUTPUT_DIR = join(import.meta.dirname, '../docs/api');
const JSON_PATH = join(API_GENERATED_DIR, 'api.json');

const REGENERATE_CMD = 'bun nx typedoc grid-vue';
const genOpts = { regenerateCommand: REGENERATE_CMD };

// ============================================================================
// Categorization (Vue-specific)
// ============================================================================

/** Check if node is a Vue component (exported from .vue files) */
function isComponent(node: TypeDocNode): boolean {
  const componentNames = [
    'TbwGrid',
    'TbwGridColumn',
    'TbwGridDetailPanel',
    'TbwGridResponsiveCard',
    'TbwGridToolButtons',
    'TbwGridToolPanel',
    'GridTypeProvider',
    'GridIconProvider',
    'GridProvider',
  ];
  return componentNames.includes(node.name);
}

/** Check if node is a composable (useX function) */
function isComposable(node: TypeDocNode): boolean {
  return node.name.startsWith('use') && node.kind === KIND.Function;
}

/** Check if node is an adapter class */
function isAdapter(node: TypeDocNode): boolean {
  return node.kind === KIND.Class && node.name.includes('Adapter');
}

/** Check if node is a type (interface or type alias) */
function isType(node: TypeDocNode): boolean {
  return node.kind === KIND.TypeAlias || node.kind === KIND.Interface;
}

// ============================================================================
// Processing
// ============================================================================

function processModule(module: TypeDocNode, outDir: string): void {
  const nodes = module.children ?? [];

  // Categorize nodes
  const components: TypeDocNode[] = [];
  const composables: TypeDocNode[] = [];
  const adapters: TypeDocNode[] = [];
  const types: TypeDocNode[] = [];
  const other: TypeDocNode[] = [];

  for (const node of nodes) {
    // Skip internal nodes
    if (isInternal(node.comment)) continue;

    if (isComponent(node)) {
      components.push(node);
    } else if (isComposable(node)) {
      composables.push(node);
    } else if (isAdapter(node)) {
      adapters.push(node);
    } else if (isType(node)) {
      types.push(node);
    } else if (GENERATORS[node.kind]) {
      other.push(node);
    }
  }

  // Write Components
  if (components.length) {
    console.log('  Components:');
    for (const node of components) {
      const gen = GENERATORS[node.kind];
      if (!gen) continue;
      const title = `Grid/Vue/Components/${node.name}`;
      const mdx = gen(node, title, genOpts);
      writeMdx(outDir, `Components/${node.name}.mdx`, mdx, `Components/${node.name}.mdx`);
    }
  }

  // Write Composables
  if (composables.length) {
    console.log('  Composables:');
    for (const node of composables) {
      const title = `Grid/Vue/Composables/${node.name}`;
      const mdx = genFunction(node, title, genOpts);
      writeMdx(outDir, `Composables/${node.name}.mdx`, mdx, `Composables/${node.name}.mdx`);
    }
  }

  // Write Adapters
  if (adapters.length) {
    console.log('  Adapters:');
    for (const node of adapters) {
      const title = `Grid/Vue/Adapters/${node.name}`;
      const mdx = genClass(node, title, genOpts);
      writeMdx(outDir, `Adapters/${node.name}.mdx`, mdx, `Adapters/${node.name}.mdx`);
    }
  }

  // Write Types
  if (types.length) {
    console.log('  Types:');
    for (const node of types) {
      const gen = GENERATORS[node.kind];
      if (!gen) continue;
      const title = `Grid/Vue/Types/${node.name}`;
      const mdx = gen(node, title, genOpts);
      writeMdx(outDir, `Types/${node.name}.mdx`, mdx, `Types/${node.name}.mdx`);
    }
  }

  // Write other items (functions, utilities)
  if (other.length) {
    console.log('  Utilities:');
    for (const node of other) {
      const gen = GENERATORS[node.kind];
      if (!gen) continue;
      const title = `Grid/Vue/Utilities/${node.name}`;
      const mdx = gen(node, title, genOpts);
      writeMdx(outDir, `Utilities/${node.name}.mdx`, mdx, `Utilities/${node.name}.mdx`);
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log('Generating Storybook MDX from TypeDoc JSON for grid-vue...\n');

  if (!existsSync(JSON_PATH)) {
    console.error(`Error: TypeDoc JSON not found at ${JSON_PATH}`);
    console.error('Run `bunx typedoc --options typedoc.json` first to generate the JSON.');
    process.exit(1);
  }

  const json: TypeDocNode = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));

  // Clean output
  if (existsSync(OUTPUT_DIR)) rmSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Process the root module (grid-vue exports)
  console.log('Processing grid-vue module...');
  processModule(json, OUTPUT_DIR);

  // Touch Storybook main.ts to trigger reindex
  touchStorybookMain();

  console.log('\n✅ Done! MDX files written to libs/grid-vue/docs/api/');
}

main().catch(console.error);
