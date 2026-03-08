/**
 * Generate Storybook MDX files from TypeDoc JSON output for grid-react.
 *
 * This script reads the structured JSON from TypeDoc and generates clean MDX files
 * for the React adapter library documentation.
 *
 * Run: `bun nx typedoc grid-react`
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
const OUTPUT_DIR = join(import.meta.dirname, '../../../apps/docs/src/content/docs/grid/react/api');
const JSON_PATH = join(API_GENERATED_DIR, 'api.json');

const REGENERATE_CMD = 'bun nx typedoc grid-react';
const genOpts = { regenerateCommand: REGENERATE_CMD };

// ============================================================================
// Categorization
// ============================================================================

/** Check if node is a React component */
function isComponent(node: TypeDocNode): boolean {
  const componentNames = [
    'DataGrid',
    'GridColumn',
    'GridDetailPanel',
    'GridToolPanel',
    'GridToolButtons',
    'GridResponsiveCard',
  ];
  return componentNames.includes(node.name);
}

/** Check if node is a hook */
function isHook(node: TypeDocNode): boolean {
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
  const hooks: TypeDocNode[] = [];
  const adapters: TypeDocNode[] = [];
  const types: TypeDocNode[] = [];
  const other: TypeDocNode[] = [];

  for (const node of nodes) {
    // Skip internal nodes
    if (isInternal(node.comment)) continue;

    if (isComponent(node)) {
      components.push(node);
    } else if (isHook(node)) {
      hooks.push(node);
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
      const title = node.name;
      const mdx = gen(node, title, genOpts);
      writeMdx(outDir, `components/${node.name}.mdx`, mdx, `components/${node.name}.mdx`);
    }
  }

  // Write Hooks
  if (hooks.length) {
    console.log('  Hooks:');
    for (const node of hooks) {
      const title = node.name;
      const mdx = genFunction(node, title, genOpts);
      writeMdx(outDir, `hooks/${node.name}.mdx`, mdx, `hooks/${node.name}.mdx`);
    }
  }

  // Write Adapters
  if (adapters.length) {
    console.log('  Adapters:');
    for (const node of adapters) {
      const title = node.name;
      const mdx = genClass(node, title, genOpts);
      writeMdx(outDir, `adapters/${node.name}.mdx`, mdx, `adapters/${node.name}.mdx`);
    }
  }

  // Write Types
  if (types.length) {
    console.log('  Types:');
    for (const node of types) {
      const gen = GENERATORS[node.kind];
      if (!gen) continue;
      const title = node.name;
      const mdx = gen(node, title, genOpts);
      writeMdx(outDir, `types/${node.name}.mdx`, mdx, `types/${node.name}.mdx`);
    }
  }

  // Write other items (functions, utilities)
  if (other.length) {
    console.log('  Utilities:');
    for (const node of other) {
      const gen = GENERATORS[node.kind];
      if (!gen) continue;
      const title = node.name;
      const mdx = gen(node, title, genOpts);
      writeMdx(outDir, `utilities/${node.name}.mdx`, mdx, `utilities/${node.name}.mdx`);
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log('Generating MDX from TypeDoc JSON for grid-react...\n');

  if (!existsSync(JSON_PATH)) {
    console.error(`Error: TypeDoc JSON not found at ${JSON_PATH}`);
    console.error('Run `bunx typedoc --options typedoc.json` first to generate the JSON.');
    process.exit(1);
  }

  const json: TypeDocNode = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));

  // Clean output
  if (existsSync(OUTPUT_DIR)) rmSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Process the root module (grid-react exports)
  console.log('Processing grid-react module...');
  processModule(json, OUTPUT_DIR);

  // Touch Storybook main.ts to trigger reindex
  touchStorybookMain();

  console.log('\n✅ Done! MDX files written to apps/docs/src/content/docs/grid/react/api/');
}

main().catch(console.error);
