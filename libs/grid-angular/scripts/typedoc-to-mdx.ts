/**
 * Generate Storybook MDX files from TypeDoc JSON output for grid-angular.
 *
 * This script reads the structured JSON from TypeDoc and generates clean MDX files
 * for the Angular adapter library documentation.
 *
 * Run: `bun nx typedoc grid-angular`
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import {
  genClass,
  GENERATORS,
  isInternal,
  KIND,
  touchStorybookMain,
  writeMdx,
  type TypeDocNode,
} from '../../../tools/typedoc-mdx-shared';

const API_GENERATED_DIR = join(import.meta.dirname, '../docs/api-generated');
const OUTPUT_DIR = join(import.meta.dirname, '../../../apps/docs/src/content/docs/grid/angular/api');
const JSON_PATH = join(API_GENERATED_DIR, 'api.json');

const REGENERATE_CMD = 'bun nx typedoc grid-angular';
const genOpts = { regenerateCommand: REGENERATE_CMD };

// ============================================================================
// Categorization (Angular-specific)
// ============================================================================

/** Check if node is a directive (class name ends with Directive or is a known directive) */
function isDirective(node: TypeDocNode): boolean {
  if (node.kind !== KIND.Class) return false;
  const directiveNames = [
    'Grid',
    'GridFormArray',
    'TbwRenderer',
    'TbwEditor',
    'GridColumnView',
    'GridColumnEditor',
    'GridDetailView',
    'GridToolPanel',
    'GridResponsiveCard',
  ];
  return directiveNames.includes(node.name) || node.name.endsWith('Directive');
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
  const directives: TypeDocNode[] = [];
  const adapters: TypeDocNode[] = [];
  const types: TypeDocNode[] = []; // Context types + config types
  const other: TypeDocNode[] = [];

  for (const node of nodes) {
    // Skip internal nodes
    if (isInternal(node.comment)) continue;

    if (isDirective(node)) {
      directives.push(node);
    } else if (isAdapter(node)) {
      adapters.push(node);
    } else if (isType(node)) {
      types.push(node);
    } else if (GENERATORS[node.kind]) {
      other.push(node);
    }
  }

  // Write Directives
  if (directives.length) {
    console.log('  Directives:');
    for (const node of directives) {
      const title = node.name;
      const mdx = genClass(node, title, genOpts);
      writeMdx(outDir, `directives/${node.name}.mdx`, mdx, `directives/${node.name}.mdx`);
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

  // Write Types (contexts, configs, interfaces)
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
  console.log('Generating MDX from TypeDoc JSON for grid-angular...\n');

  if (!existsSync(JSON_PATH)) {
    console.error(`Error: TypeDoc JSON not found at ${JSON_PATH}`);
    console.error('Run `bunx typedoc --options typedoc.json` first to generate the JSON.');
    process.exit(1);
  }

  const json: TypeDocNode = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));

  // Clean output
  if (existsSync(OUTPUT_DIR)) rmSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Process the root module (grid-angular exports)
  console.log('Processing grid-angular module...');
  processModule(json, OUTPUT_DIR);

  // Touch Storybook main.ts to trigger reindex
  touchStorybookMain();

  console.log('\n✅ Done! MDX files written to apps/docs/src/content/docs/grid/angular/api/');
}

main().catch(console.error);
