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
 * Escape special characters in inline code within MDX.
 * - Pipes `|` break table cell boundaries
 * - Angle brackets `<>` are interpreted as JSX when inline code starts a line
 */
export const escapeCode = (text: string): string =>
  text.replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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

/** Check if node or its signatures are marked @internal (works for methods and accessors) */
export const isNodeInternal = (node: TypeDocNode): boolean =>
  isInternal(node.comment) ||
  node.signatures?.some((s) => isInternal(s.comment)) ||
  isInternal(node.getSignature?.comment) ||
  isInternal(node.setSignature?.comment) ||
  false;

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

/**
 * Format a type with markdown links for types in a registry.
 * Returns markdown with links for known types, inline code for unknown.
 *
 * @param type - TypeDoc type to format
 * @param typeRegistry - Map of type names to documentation URLs
 */
export function formatTypeWithLinks(type: TypeDocType | undefined, typeRegistry: Map<string, string>): string {
  if (!type) return '`unknown`';

  const linkify = (name: string): string => {
    const url = typeRegistry.get(name);
    return url ? `[\`${name}\`](${url})` : `\`${name}\``;
  };

  switch (type.type) {
    case 'intrinsic':
    case 'literal':
      return `\`${String(type.value ?? type.name ?? 'unknown')}\``;
    case 'reference': {
      const name = type.name ?? 'unknown';
      if (type.typeArguments?.length) {
        const args = type.typeArguments.map((t) => formatTypeWithLinks(t, typeRegistry)).join(', ');
        const url = typeRegistry.get(name);
        // Use HTML entities for angle brackets to prevent MDX from interpreting them as JSX
        return url ? `[\`${name}\`](${url})&lt;${args}&gt;` : `\`${name}\`&lt;${args}&gt;`;
      }
      return linkify(name);
    }
    case 'array':
      return `${formatTypeWithLinks(type.elementType, typeRegistry)}[]`;
    case 'union':
      return type.types?.map((t) => formatTypeWithLinks(t, typeRegistry)).join(' \\| ') ?? '`unknown`';
    case 'intersection':
      return type.types?.map((t) => formatTypeWithLinks(t, typeRegistry)).join(' & ') ?? '`unknown`';
    case 'reflection':
      return '`object`';
    default:
      return type.name ? linkify(type.name) : '`unknown`';
  }
}

// ============================================================================
// Example Formatting
// ============================================================================

/**
 * Get all @example tags from a comment.
 * Returns an array of example code blocks with optional titles.
 * TypeDoc 0.28+ puts the example title in a `name` property.
 */
export function getAllExamples(comment?: TypeDocComment): { title?: string; code: string }[] {
  if (!comment?.blockTags) return [];
  return comment.blockTags
    .filter((b) => b.tag === '@example')
    .map((b) => {
      const title = (b as { name?: string }).name?.trim();
      const text = b.content
        .map((c) => c.text)
        .join('')
        .trim();
      return { title, code: text };
    });
}

/**
 * Format all @example blocks for MDX output.
 * Uses a single "## Examples" header when there are multiple examples.
 */
export function formatAllExamples(comment?: TypeDocComment, defaultLang = 'ts'): string {
  const examples = getAllExamples(comment);
  if (examples.length === 0) return '';

  const header = examples.length === 1 ? '## Example\n\n' : '## Examples\n\n';

  const body = examples
    .map((ex) => {
      const titleLine = ex.title ? `### ${ex.title}\n\n` : '';
      const code = ex.code.startsWith('```') ? ex.code : `\`\`\`${defaultLang}\n${ex.code}\n\`\`\``;
      return `${titleLine}${code}\n\n`;
    })
    .join('');

  return header + body;
}

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
// Event Formatting (@fires)
// ============================================================================

/**
 * Get all @fires tags from a comment.
 * Format: @fires eventName - Description
 */
export function getAllFires(comment?: TypeDocComment): { event: string; description: string }[] {
  if (!comment?.blockTags) return [];
  return comment.blockTags
    .filter((b) => b.tag === '@fires')
    .map((b) => {
      const text = b.content
        .map((c) => c.text)
        .join('')
        .trim();
      const match = text.match(/^(\S+)(?:\s*-\s*(.*))?$/);
      if (match) {
        return { event: match[1], description: match[2]?.trim() ?? '' };
      }
      return { event: text, description: '' };
    });
}

/**
 * Format all @fires tags as an "Events" section for MDX output.
 */
export function formatFires(comment?: TypeDocComment): string {
  const fires = getAllFires(comment);
  if (fires.length === 0) return '';

  let out = `#### Events\n\n`;
  out += `| Event | Description |\n`;
  out += `| ----- | ----------- |\n`;
  for (const f of fires) {
    out += `| \`${f.event}\` | ${escape(f.description)} |\n`;
  }
  return out + '\n';
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
  const deprecated = isDeprecated(node.comment);
  const deprecationNote = getTag(node.comment, '@deprecated');

  let out = mdxHeader(title, regenerateCommand) + `# Type: ${node.name}\n\n`;

  // Show deprecation warning if present
  if (deprecated) {
    // Convert inline code references to Storybook links
    const linkedNote = deprecationNote ? linkifyDeprecationNote(deprecationNote.trim(), title) : '';
    out += `> ⚠️ **Deprecated**${linkedNote ? `: ${linkedNote}` : ''}\n\n`;
  }

  const desc = getText(node.comment);
  if (desc) out += `${escape(desc)}\n\n`;

  out += `\`\`\`ts\ntype ${node.name} = ${formatType(node.type)}\n\`\`\`\n\n`;

  const example = getTag(node.comment, '@example');
  if (example) out += formatExample(example);

  return out;
}

/**
 * Convert inline code references in deprecation notes to Storybook links.
 * E.g., "Use `CellEditor` instead" becomes "Use [`CellEditor`](?path=/docs/grid-angular-types-celleditor--docs) instead"
 *
 * @param note - The deprecation note text
 * @param title - Current Storybook title (e.g., "Grid/Angular/Types/AngularCellEditor")
 */
function linkifyDeprecationNote(note: string, title: string): string {
  // Extract the base path from title (e.g., "Grid/Angular/Types" from "Grid/Angular/Types/AngularCellEditor")
  const parts = title.split('/');
  const basePath = parts.slice(0, -1).join('/');

  // Replace inline code references with links
  // Match `TypeName` patterns (PascalCase identifiers)
  return note.replace(/`([A-Z][a-zA-Z0-9]*)`/g, (match, typeName) => {
    // Build Storybook path: "Grid/Angular/Types/CellEditor" -> "grid-angular-types-celleditor--docs"
    const fullPath = `${basePath}/${typeName}`;
    const storybookPath = fullPath.toLowerCase().replace(/\//g, '-');
    return `[\`${typeName}\`](?path=/docs/${storybookPath}--docs)`;
  });
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
