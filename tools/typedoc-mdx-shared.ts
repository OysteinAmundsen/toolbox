/**
 * Shared utilities for TypeDoc to MDX generation.
 *
 * Used by all library-specific typedoc-to-mdx.ts scripts.
 */

import { existsSync, mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// ============================================================================
// Types
// ============================================================================

export interface TypeDocNode {
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

export interface TypeDocComment {
  summary?: Array<{ kind: string; text: string }>;
  blockTags?: Array<{ tag: string; name?: string; content: Array<{ kind: string; text: string }> }>;
  modifierTags?: string[];
}

export interface TypeDocSignature {
  comment?: TypeDocComment;
  parameters?: TypeDocNode[];
  type?: TypeDocType;
}

export interface TypeDocType {
  type: string;
  name?: string;
  value?: string | number | boolean;
  types?: TypeDocType[];
  elementType?: TypeDocType;
  typeArguments?: TypeDocType[];
}

// ============================================================================
// Constants
// ============================================================================

/** TypeDoc kind values */
export const KIND = {
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

/** Map kind to subfolder name */
export const KIND_FOLDER_MAP: Record<number, string> = {
  [KIND.Class]: 'Classes',
  [KIND.Interface]: 'Interfaces',
  [KIND.Function]: 'Functions',
  [KIND.TypeAlias]: 'Types',
  [KIND.Enum]: 'Enums',
};

// ============================================================================
// Storybook Integration
// ============================================================================

/** Path to Storybook main.ts for cache invalidation */
const STORYBOOK_MAIN = join(import.meta.dirname, '../apps/docs/.storybook/main.ts');

/**
 * Touch Storybook main.ts to trigger reindex.
 * Works around Storybook's MDX cache not detecting new/changed files.
 */
export function touchStorybookMain(): void {
  if (existsSync(STORYBOOK_MAIN)) {
    const now = new Date();
    utimesSync(STORYBOOK_MAIN, now, now);
  }
}

// ============================================================================
// MDX Header
// ============================================================================

/**
 * Generate MDX header with Meta component.
 * @param title - Storybook hierarchy title (e.g., "Grid/React/Components/DataGrid")
 * @param regenerateCommand - Command to regenerate (e.g., "bun nx typedoc grid-react")
 */
export const mdxHeader = (title: string, regenerateCommand = 'bun nx typedoc') =>
  `{/* Auto-generated from JSDoc - do not edit manually */}
{/* Regenerate with: ${regenerateCommand} */}
import { Meta } from '@storybook/addon-docs/blocks';

<Meta title="${title}" />

`;

// ============================================================================
// Text Escaping
// ============================================================================

/**
 * Escape special MDX characters, but preserve content inside code blocks and inline code.
 * Also unescape backticks in code blocks (they come escaped from JSDoc in template literals).
 */
export const escape = (text: string): string => {
  // Split on fenced code blocks (```...```) and inline code (`...`)
  // Regex captures both so they appear as odd indices
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return parts
    .map((part, i) => {
      // Odd indices are code - unescape backticks but preserve otherwise
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
 * Only pipes need escaping since they break table cell boundaries.
 * Backticks protect angle brackets and curly braces.
 */
export const escapeCode = (text: string): string => text.replace(/\|/g, '\\|');

// ============================================================================
// Comment Extraction
// ============================================================================

/** Get summary text from a comment */
export const getText = (comment?: TypeDocComment): string => comment?.summary?.map((s) => s.text).join('') ?? '';

/** Get a specific block tag value */
export const getTag = (comment: TypeDocComment | undefined, tag: string): string =>
  comment?.blockTags
    ?.find((b) => b.tag === tag)
    ?.content.map((c) => c.text)
    .join('') ?? '';

/** Check if comment has @deprecated tag */
export const isDeprecated = (c?: TypeDocComment): boolean =>
  c?.blockTags?.some((b) => b.tag === '@deprecated') ?? false;

/** Check if comment has @internal modifier */
export const isInternal = (c?: TypeDocComment): boolean => c?.modifierTags?.includes('@internal') ?? false;

// ============================================================================
// Type Formatting
// ============================================================================

/** Format a TypeDoc type for display */
export function formatType(t?: TypeDocType): string {
  if (!t) return 'unknown';
  switch (t.type) {
    case 'intrinsic':
    case 'reference':
      if (t.typeArguments?.length) {
        return `${t.name}<${t.typeArguments.map(formatType).join(', ')}>`;
      }
      return t.name ?? 'unknown';
    case 'union':
      return t.types?.map(formatType).join(' | ') ?? 'unknown';
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

// ============================================================================
// Example Formatting
// ============================================================================

/**
 * Format an @example block for MDX output.
 * Handles both raw code (wraps in fence) and code that already has markdown fences.
 * @param example - The example code
 * @param defaultLang - Default language for code fence (default: 'tsx')
 */
export function formatExample(example: string, defaultLang = 'tsx'): string {
  const trimmed = example.trim();
  if (trimmed.startsWith('```')) {
    return `#### Example\n\n${trimmed}\n\n`;
  }
  return `#### Example\n\n\`\`\`${defaultLang}\n${trimmed}\n\`\`\`\n\n`;
}

// ============================================================================
// File Writing
// ============================================================================

/** Write MDX file with directory creation */
export function writeMdx(outDir: string, relativePath: string, content: string, label?: string): void {
  const outPath = join(outDir, relativePath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content);
  if (label) {
    console.log(`    ✓ ${label}`);
  }
}

// ============================================================================
// Basic Generators
// ============================================================================

export interface GeneratorOptions {
  /** Command shown in regenerate comment */
  regenerateCommand?: string;
}

/** Generate MDX for an interface */
export function genInterface(node: TypeDocNode, title: string, options: GeneratorOptions = {}): string {
  const { regenerateCommand } = options;
  let out = mdxHeader(title, regenerateCommand) + `# Interface: ${node.name}\n\n`;
  const desc = getText(node.comment);
  if (desc) out += `${escape(desc)}\n\n`;

  const example = getTag(node.comment, '@example');
  if (example) out += formatExample(example);

  const props = (node.children ?? []).filter((m) => m.kind === KIND.Property && !isInternal(m.comment));
  if (props.length) {
    out += `## Properties\n\n| Property | Type | Description |\n| -------- | ---- | ----------- |\n`;
    for (const p of props) {
      const type = formatType(p.type);
      const propDesc = getText(p.comment).split('\n')[0];
      const opt = p.flags?.isOptional ? '?' : '';
      const dep = isDeprecated(p.comment) ? '⚠️ ' : '';
      out += `| \`${p.name}${opt}\` | \`${escapeCode(type)}\` | ${dep}${escape(propDesc)} |\n`;
    }
    out += '\n';
  }

  return out;
}

/** Generate MDX for a class */
export function genClass(node: TypeDocNode, title: string, options: GeneratorOptions = {}): string {
  const { regenerateCommand } = options;
  let out = mdxHeader(title, regenerateCommand) + `# Class: ${node.name}\n\n`;
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
      const propDesc = getText(p.comment).split('\n')[0];
      const opt = p.flags?.isOptional ? '?' : '';
      out += `| \`${p.name}${opt}\` | \`${escapeCode(type)}\` | ${escape(propDesc)} |\n`;
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

/** Generate MDX for a function */
export function genFunction(node: TypeDocNode, title: string, options: GeneratorOptions = {}): string {
  const { regenerateCommand } = options;
  const sig = node.signatures?.[0];
  if (!sig) return '';

  let out = mdxHeader(title, regenerateCommand) + `# Function: ${node.name}\n\n`;
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

/** Generate MDX for a type alias */
export function genTypeAlias(node: TypeDocNode, title: string, options: GeneratorOptions = {}): string {
  const { regenerateCommand } = options;
  let out = mdxHeader(title, regenerateCommand) + `# Type: ${node.name}\n\n`;
  const desc = getText(node.comment);
  if (desc) out += `${escape(desc)}\n\n`;

  out += `\`\`\`ts\ntype ${node.name} = ${formatType(node.type)}\n\`\`\`\n\n`;

  const example = getTag(node.comment, '@example');
  if (example) out += formatExample(example);

  return out;
}

/** Generate MDX for an enum */
export function genEnum(node: TypeDocNode, title: string, options: GeneratorOptions = {}): string {
  const { regenerateCommand } = options;
  let out = mdxHeader(title, regenerateCommand) + `# Enum: ${node.name}\n\n`;
  const desc = getText(node.comment);
  if (desc) out += `${escape(desc)}\n\n`;

  const members = node.children ?? [];
  if (members.length) {
    out += `## Members\n\n| Member | Value | Description |\n| ------ | ----- | ----------- |\n`;
    for (const m of members) {
      const value = m.type?.value ?? '';
      const memberDesc = getText(m.comment);
      out += `| \`${m.name}\` | \`${value}\` | ${escape(memberDesc)} |\n`;
    }
    out += '\n';
  }

  return out;
}

/** Standard generator registry */
export const GENERATORS: Record<number, (n: TypeDocNode, t: string, o?: GeneratorOptions) => string> = {
  [KIND.Class]: genClass,
  [KIND.Interface]: genInterface,
  [KIND.TypeAlias]: genTypeAlias,
  [KIND.Function]: genFunction,
  [KIND.Enum]: genEnum,
};
