/**
 * Generate Storybook MDX files from TypeDoc JSON output for grid-angular.
 *
 * This script reads the structured JSON from TypeDoc and generates clean MDX files
 * for the Angular adapter library documentation.
 *
 * Run: `bun nx typedoc grid-angular`
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const API_GENERATED_DIR = join(import.meta.dirname, '../docs/api-generated');
const OUTPUT_DIR = join(import.meta.dirname, '../docs/api');
const JSON_PATH = join(API_GENERATED_DIR, 'api.json');

// ============================================================================
// Types
// ============================================================================

interface TypeDocNode {
  id: number;
  name: string;
  kind: number;
  comment?: TypeDocComment;
  children?: TypeDocNode[];
  signatures?: TypeDocSignature[];
  getSignature?: TypeDocSignature;
  setSignature?: TypeDocSignature;
  type?: TypeDocType;
  flags?: { isStatic?: boolean; isReadonly?: boolean; isOptional?: boolean; isInherited?: boolean };
  inheritedFrom?: { type: string; name: string };
  overwrites?: { type: string; name: string };
}

interface TypeDocComment {
  summary?: Array<{ kind: string; text: string }>;
  blockTags?: Array<{ tag: string; content: Array<{ kind: string; text: string }> }>;
  modifierTags?: string[];
}

interface TypeDocSignature {
  comment?: TypeDocComment;
  parameters?: TypeDocNode[];
  type?: TypeDocType;
}

interface TypeDocType {
  type: string;
  name?: string;
  value?: string | number | boolean;
  types?: TypeDocType[];
  elementType?: TypeDocType;
  typeArguments?: TypeDocType[];
}

// TypeDoc kind values
const KIND = {
  Module: 2,
  Class: 128,
  Interface: 256,
  Function: 64,
  TypeAlias: 2097152,
  Enum: 8,
  Property: 1024,
  Method: 2048,
  Accessor: 262144,
  Constructor: 512,
} as const;

// Map kind to subfolder name
const KIND_FOLDER_MAP: Record<number, string> = {
  [KIND.Class]: 'Classes',
  [KIND.Interface]: 'Interfaces',
  [KIND.Function]: 'Functions',
  [KIND.TypeAlias]: 'Types',
  [KIND.Enum]: 'Enums',
};

// ============================================================================
// Helpers
// ============================================================================

const mdxHeader = (title: string) => `{/* Auto-generated from JSDoc - do not edit manually */}
{/* Regenerate with: bun nx typedoc grid-angular */}
import { Meta } from '@storybook/addon-docs/blocks';

<Meta title="${title}" />

`;

/**
 * Escape special MDX characters, but preserve content inside fenced code blocks.
 * Also unescape backticks in code blocks (they come escaped from JSDoc in template literals).
 */
const escape = (text: string): string => {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part, i) => {
      // Odd indices are code blocks - unescape backticks but preserve otherwise
      if (i % 2 === 1) return part.replace(/\\`/g, '`');
      // Even indices are regular text - escape special characters
      return part
        .replace(/\\/g, '\\\\')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}');
    })
    .join('');
};

/**
 * Escape special characters in inline code within MDX tables.
 * MDX parses backtick code in tables as JSX, so we need to escape angle brackets.
 */
const escapeCode = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{/g, '\\{').replace(/\}/g, '\\}');

const getText = (comment?: TypeDocComment): string => comment?.summary?.map((s) => s.text).join('') ?? '';

const getTag = (comment: TypeDocComment | undefined, tag: string): string =>
  comment?.blockTags
    ?.find((b) => b.tag === tag)
    ?.content.map((c) => c.text)
    .join('') ?? '';

const isDeprecated = (c?: TypeDocComment): boolean => c?.blockTags?.some((b) => b.tag === '@deprecated') ?? false;
const isInternal = (c?: TypeDocComment): boolean => c?.modifierTags?.includes('@internal') ?? false;

function formatType(t?: TypeDocType): string {
  if (!t) return 'unknown';
  switch (t.type) {
    case 'intrinsic':
    case 'reference':
      if (t.typeArguments?.length) {
        return `${t.name}<${t.typeArguments.map(formatType).join(', ')}>`;
      }
      return t.name ?? 'unknown';
    case 'union':
      return t.types?.map(formatType).join(' \\| ') ?? 'unknown';
    case 'intersection':
      return t.types?.map(formatType).join(' & ') ?? 'unknown';
    case 'array':
      return `${formatType(t.elementType)}[]`;
    case 'literal':
      return typeof t.value === 'string' ? `"${t.value}"` : String(t.value);
    case 'tuple':
      return `[${t.types?.map(formatType).join(', ') ?? ''}]`;
    case 'reflection':
      return 'object';
    default:
      return t.name ?? 'unknown';
  }
}

function formatExample(example: string): string {
  const trimmed = example.trim();
  if (trimmed.startsWith('```')) {
    return `#### Example\n\n${trimmed}\n\n`;
  }
  return `#### Example\n\n\`\`\`ts\n${trimmed}\n\`\`\`\n\n`;
}

// ============================================================================
// Generators
// ============================================================================

function genInterface(node: TypeDocNode, title: string): string {
  let out = mdxHeader(title) + `# Interface: ${node.name}\n\n`;
  const desc = getText(node.comment);
  if (desc) out += `${escape(desc)}\n\n`;

  const example = getTag(node.comment, '@example');
  if (example) out += formatExample(example);

  const props = (node.children ?? []).filter((m) => m.kind === KIND.Property && !isInternal(m.comment));
  if (props.length) {
    out += `## Properties\n\n| Property | Type | Description |\n| -------- | ---- | ----------- |\n`;
    for (const p of props) {
      const type = formatType(p.type);
      const desc = getText(p.comment).split('\n')[0];
      const opt = p.flags?.isOptional ? '?' : '';
      const dep = isDeprecated(p.comment) ? '⚠️ ' : '';
      out += `| \`${p.name}${opt}\` | \`${escapeCode(type)}\` | ${dep}${escape(desc)} |\n`;
    }
    out += '\n';
  }

  return out;
}

function genClass(node: TypeDocNode, title: string): string {
  let out = mdxHeader(title) + `# Class: ${node.name}\n\n`;
  const desc = getText(node.comment);
  if (desc) out += `${escape(desc)}\n\n`;

  const example = getTag(node.comment, '@example');
  if (example) out += formatExample(example);

  // Filter out internal and inherited members
  const members = (node.children ?? []).filter((m) => !isInternal(m.comment) && !m.inheritedFrom);

  // Properties
  const props = members.filter((m) => m.kind === KIND.Property);
  if (props.length) {
    out += `## Properties\n\n| Property | Type | Description |\n| -------- | ---- | ----------- |\n`;
    for (const p of props) {
      const type = formatType(p.type);
      const desc = getText(p.comment).split('\n')[0];
      const opt = p.flags?.isOptional ? '?' : '';
      out += `| \`${p.name}${opt}\` | \`${escapeCode(type)}\` | ${escape(desc)} |\n`;
    }
    out += '\n';
  }

  // Methods
  const methods = members.filter((m) => m.kind === KIND.Method);
  if (methods.length) {
    out += `## Methods\n\n`;
    for (const m of methods) {
      const sig = m.signatures?.[0];
      if (!sig) continue;
      const params = sig.parameters?.map((p) => `${p.name}: ${formatType(p.type)}`).join(', ') ?? '';
      const returnType = formatType(sig.type);
      out += `### ${m.name}()\n\n`;
      const methodDesc = getText(sig.comment);
      if (methodDesc) out += `${escape(methodDesc)}\n\n`;
      out += `\`\`\`ts\n${m.name}(${params}): ${returnType}\n\`\`\`\n\n`;
      if (sig.parameters?.length) {
        out += `#### Parameters\n\n| Name | Type | Description |\n| ---- | ---- | ----------- |\n`;
        for (const p of sig.parameters) {
          out += `| \`${p.name}\` | \`${escapeCode(formatType(p.type))}\` | ${escape(getText(p.comment))} |\n`;
        }
        out += '\n';
      }
      const returns = getTag(sig.comment, '@returns');
      if (returns) out += `#### Returns\n\n\`${escapeCode(returnType)}\` - ${escape(returns)}\n\n`;
      out += `***\n\n`;
    }
  }

  return out;
}

function genFunction(node: TypeDocNode, title: string): string {
  const sig = node.signatures?.[0];
  if (!sig) return '';

  let out = mdxHeader(title) + `# Function: ${node.name}\n\n`;
  const desc = getText(sig.comment);
  if (desc) out += `${escape(desc)}\n\n`;

  const params = sig.parameters?.map((p) => `${p.name}: ${formatType(p.type)}`).join(', ') ?? '';
  const returnType = formatType(sig.type);
  out += `\`\`\`ts\n${node.name}(${params}): ${returnType}\n\`\`\`\n\n`;

  if (sig.parameters?.length) {
    out += `## Parameters\n\n| Name | Type | Description |\n| ---- | ---- | ----------- |\n`;
    for (const p of sig.parameters) {
      out += `| \`${p.name}\` | \`${escapeCode(formatType(p.type))}\` | ${escape(getText(p.comment))} |\n`;
    }
    out += '\n';
  }

  const returns = getTag(sig.comment, '@returns');
  if (returns) out += `## Returns\n\n\`${escapeCode(returnType)}\` - ${escape(returns)}\n\n`;

  const example = getTag(sig.comment, '@example');
  if (example) out += formatExample(example);

  return out;
}

function genTypeAlias(node: TypeDocNode, title: string): string {
  let out = mdxHeader(title) + `# Type: ${node.name}\n\n`;
  const desc = getText(node.comment);
  if (desc) out += `${escape(desc)}\n\n`;

  out += `\`\`\`ts\ntype ${node.name} = ${formatType(node.type)}\n\`\`\`\n\n`;

  const example = getTag(node.comment, '@example');
  if (example) out += formatExample(example);

  return out;
}

const GENERATORS: Record<number, (node: TypeDocNode, title: string) => string> = {
  [KIND.Class]: genClass,
  [KIND.Interface]: genInterface,
  [KIND.Function]: genFunction,
  [KIND.TypeAlias]: genTypeAlias,
};

// ============================================================================
// Categorization
// ============================================================================

/** Check if node is a directive (class name ends with Directive or is a known directive) */
function isDirective(node: TypeDocNode): boolean {
  if (node.kind !== KIND.Class) return false;
  const directiveNames = [
    'Grid',
    'GridFormControl',
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

/** Check if node is a context or event type */
function isContextType(node: TypeDocNode): boolean {
  const contextNames = [
    'GridCellContext',
    'GridEditorContext',
    'GridDetailContext',
    'GridToolPanelContext',
    'StructuralCellContext',
    'StructuralEditorContext',
    'CellCommitEvent',
    'RowCommitEvent',
    'FormArrayContext',
  ];
  return contextNames.includes(node.name) || node.name.endsWith('Context') || node.name.endsWith('Event');
}

// ============================================================================
// Processing
// ============================================================================

function processModule(module: TypeDocNode, outDir: string): void {
  const nodes = module.children ?? [];

  // Categorize nodes
  const directives: TypeDocNode[] = [];
  const adapters: TypeDocNode[] = [];
  const contexts: TypeDocNode[] = [];
  const other: TypeDocNode[] = [];

  for (const node of nodes) {
    // Skip internal nodes
    if (isInternal(node.comment)) continue;

    if (isDirective(node)) {
      directives.push(node);
    } else if (isAdapter(node)) {
      adapters.push(node);
    } else if (isContextType(node)) {
      contexts.push(node);
    } else if (GENERATORS[node.kind]) {
      other.push(node);
    }
  }

  // Write Directives
  if (directives.length) {
    console.log('  Directives:');
    for (const node of directives) {
      const title = `Grid/Angular/Directives/${node.name}`;
      const mdx = genClass(node, title);
      const outPath = join(outDir, 'Directives', `${node.name}.mdx`);
      mkdirSync(join(outDir, 'Directives'), { recursive: true });
      writeFileSync(outPath, mdx);
      console.log(`    ✓ Directives/${node.name}.mdx`);
    }
  }

  // Write Adapters
  if (adapters.length) {
    console.log('  Adapters:');
    for (const node of adapters) {
      const title = `Grid/Angular/Adapters/${node.name}`;
      const mdx = genClass(node, title);
      const outPath = join(outDir, 'Adapters', `${node.name}.mdx`);
      mkdirSync(join(outDir, 'Adapters'), { recursive: true });
      writeFileSync(outPath, mdx);
      console.log(`    ✓ Adapters/${node.name}.mdx`);
    }
  }

  // Write Context/Event Types
  if (contexts.length) {
    console.log('  Types:');
    for (const node of contexts) {
      const kindFolder = KIND_FOLDER_MAP[node.kind] ?? 'Types';
      const gen = GENERATORS[node.kind];
      if (!gen) continue;
      const title = `Grid/Angular/Types/${node.name}`;
      const mdx = gen(node, title);
      const outPath = join(outDir, 'Types', `${node.name}.mdx`);
      mkdirSync(join(outDir, 'Types'), { recursive: true });
      writeFileSync(outPath, mdx);
      console.log(`    ✓ Types/${node.name}.mdx`);
    }
  }

  // Write other items (functions, utilities)
  if (other.length) {
    console.log('  Utilities:');
    for (const node of other) {
      const kindFolder = KIND_FOLDER_MAP[node.kind] ?? 'Other';
      const gen = GENERATORS[node.kind];
      if (!gen) continue;
      const title = `Grid/Angular/Utilities/${node.name}`;
      const mdx = gen(node, title);
      const outPath = join(outDir, 'Utilities', `${node.name}.mdx`);
      mkdirSync(join(outDir, 'Utilities'), { recursive: true });
      writeFileSync(outPath, mdx);
      console.log(`    ✓ Utilities/${node.name}.mdx`);
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log('Generating Storybook MDX from TypeDoc JSON for grid-angular...\n');

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

  console.log('\n✅ Done! MDX files written to libs/grid-angular/docs/api/');
}

main().catch(console.error);
