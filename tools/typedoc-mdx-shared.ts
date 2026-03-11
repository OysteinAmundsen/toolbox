/**
 * Shared utilities for TypeDoc to MDX generation.
 *
 * Used by all library-specific typedoc-to-mdx.ts scripts.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// #region Types

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
  summary?: Array<{ kind: string; text: string; tag?: string }>;
  blockTags?: Array<{ tag: string; name?: string; content: Array<{ kind: string; text: string; tag?: string }> }>;
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
  declaration?: {
    signatures?: TypeDocSignature[];
    children?: TypeDocNode[];
  };
}

// #endregion

// #region Constants

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

// #endregion

// #region Helpers

/**
 * Generate MDX header with Starlight frontmatter.
 * @param title - Page title (e.g., "DataGrid")
 * @param regenerateCommand - Command to regenerate (e.g., "bun nx typedoc grid-react")
 */
export const mdxHeader = (title: string, regenerateCommand = 'bun nx typedoc') =>
  `---
title: "${title}"
---
{/* Auto-generated from JSDoc - do not edit manually */}
{/* Regenerate with: ${regenerateCommand} */}

`;

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
 * Only pipes `|` need escaping — they break table cell boundaries.
 * Angle brackets are safe inside backtick code spans (MDX treats them as literal text).
 */
export const escapeCode = (text: string): string => text.replace(/\|/g, '\\|');

/** Get summary text from a comment */
export const getText = (comment?: TypeDocComment): string => comment?.summary?.map((s) => s.text).join('') ?? '';

/**
 * Get the first paragraph of a summary, collapsing newlines to spaces.
 * A "paragraph" is text up to a blank line (double newline). Falls back
 * to the entire summary if there's no blank-line break.
 */
export const getFirstParagraph = (comment?: TypeDocComment): string => {
  const full = getText(comment);
  const paraBreak = full.search(/\r?\n\s*\r?\n/);
  const first = paraBreak > 0 ? full.slice(0, paraBreak) : full;
  return first.replace(/\r?\n/g, ' ').trim();
};

/** Check whether a property comment has rich details (remarks, examples, default, see) worth rendering below the table */
export const hasPropertyDetails = (comment?: TypeDocComment): boolean =>
  !!comment?.blockTags?.some((b) => ['@remarks', '@example', '@default', '@see'].includes(b.tag));

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

/** Get @category tag value from a node (checks signatures for functions) */
export const getCategory = (node: TypeDocNode): string | undefined => {
  const comment = node.signatures?.[0]?.comment ?? node.comment;
  return getTag(comment, '@category') || undefined;
};

// #endregion

// #region Type Formatting

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
    case 'reflection': {
      const sig = t.declaration?.signatures?.[0];
      if (sig) {
        const params = sig.parameters?.map((p) => `${p.name}: ${formatType(p.type)}`).join(', ') ?? '';
        const ret = formatType(sig.type);
        return `(${params}) => ${ret}`;
      }
      return 'object';
    }
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
    case 'reflection': {
      const sig = type.declaration?.signatures?.[0];
      if (sig) {
        const params = sig.parameters?.map((p) => `${p.name}: ${formatTypeWithLinks(p.type, typeRegistry)}`).join(', ') ?? '';
        const ret = formatTypeWithLinks(sig.type, typeRegistry);
        return `(${params}) => ${ret}`;
      }
      return '`object`';
    }
    default:
      return type.name ? linkify(type.name) : '`unknown`';
  }
}

/** Format a type for MDX — uses links when a registry is available, otherwise inline code */
const fmtType = (type: TypeDocType | undefined, reg?: Map<string, string>): string =>
  reg ? formatTypeWithLinks(type, reg) : `\`${escapeCode(formatType(type))}\``;

// #endregion

// #region MDX Fragments

/**
 * Get all @example tags from a comment.
 * Returns an array of example code blocks with optional titles.
 * TypeDoc 0.28+ puts the example title in a `name` property.
 */
function getAllExamples(comment?: TypeDocComment): { title?: string; code: string }[] {
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

/** Write MDX file with directory creation */
export function writeMdx(outDir: string, relativePath: string, content: string, label?: string): void {
  const outPath = join(outDir, relativePath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content);
  if (label) {
    console.log(`    ✓ ${label}`);
  }
}

// #endregion

// #region Property Details

/**
 * Generate expanded detail sections for properties that have rich JSDoc
 * (remarks, examples, default values, or see-also links).
 *
 * Renders a "### propertyName" subsection for each qualifying property
 * below the summary table, giving readers the full documentation.
 *
 * @param props - Property nodes to check for rich documentation
 * @param resolveSeeLink - Optional function to resolve `{@link TypeName}` references
 *   to markdown links. When omitted, inline-tag references render as inline code.
 */
export function genPropertyDetailsSections(
  props: TypeDocNode[],
  resolveSeeLink?: (text: string) => string,
): string {
  const richProps = props.filter((p) => hasPropertyDetails(p.comment));
  if (richProps.length === 0) return '';

  let out = `### Property Details\n\n`;

  for (const p of richProps) {
    const comment = p.comment;
    out += `#### ${p.name}\n\n`;

    // Full summary (beyond the first paragraph already shown in the table)
    const fullText = getText(comment);
    const paraBreak = fullText.search(/\r?\n\s*\r?\n/);
    if (paraBreak > 0) {
      // There's content beyond the first paragraph — render it all
      out += `${escape(fullText)}\n\n`;
    }

    // @default
    const defaultVal = getTag(comment, '@default');
    if (defaultVal) {
      const trimmed = defaultVal.trim();
      // Default values from TypeDoc come wrapped in code fences
      if (trimmed.startsWith('```')) {
        out += `**Default:** ${trimmed.replace(/```\w*\n?/, '`').replace(/\n?```/, '`')}\n\n`;
      } else {
        out += `**Default:** \`${trimmed}\`\n\n`;
      }
    }

    // @remarks
    const remarks = getTag(comment, '@remarks');
    if (remarks) {
      out += `${escape(remarks.trim())}\n\n`;
    }

    // @example blocks
    const examples = comment?.blockTags?.filter((b) => b.tag === '@example') ?? [];
    for (const ex of examples) {
      const code = ex.content
        .map((c) => c.text)
        .join('')
        .trim();
      if (code) {
        if (code.startsWith('```')) {
          out += `${code}\n\n`;
        } else {
          out += `\`\`\`ts\n${code}\n\`\`\`\n\n`;
        }
      }
    }

    // @see links — handle inline-tag ({@link}) items properly
    const seeBlocks = comment?.blockTags?.filter((b) => b.tag === '@see') ?? [];
    if (seeBlocks.length) {
      const rendered = seeBlocks
        .map((b) => {
          return b.content
            .map((c) => {
              if (c.kind === 'inline-tag' && c.tag === '@link') {
                const name = c.text?.trim() ?? '';
                if (resolveSeeLink) return resolveSeeLink(name);
                return `\`${name}\``;
              }
              return c.text ?? '';
            })
            .join('');
        })
        .flatMap((line) =>
          line
            .split('\n')
            .map((l) => l.trim().replace(/^-\s*/, ''))
            .filter((l) => l.length > 0),
        );
      if (rendered.length) {
        out += `**See also:** ${rendered.map((l) => `${l}`).join(' · ')}\n\n`;
      }
    }

    out += `---\n\n`;
  }

  return out;
}

// #endregion

// #region MDX Generators

export interface GeneratorOptions {
  /** Command shown in regenerate comment */
  regenerateCommand?: string;
  /** Type registry for cross-linking type names to their documentation URLs */
  typeRegistry?: Map<string, string>;
}

/** Generate MDX for an interface */
export function genInterface(node: TypeDocNode, title: string, options: GeneratorOptions = {}): string {
  const { regenerateCommand, typeRegistry } = options;
  let out = mdxHeader(title, regenerateCommand);
  const desc = getText(node.comment);
  if (desc) out += `${escape(desc)}\n\n`;

  const example = getTag(node.comment, '@example');
  if (example) out += formatExample(example);

  const props = (node.children ?? []).filter((m) => m.kind === KIND.Property && !isInternal(m.comment));
  if (props.length) {
    out += `## Properties\n\n| Property | Type | Description |\n| -------- | ---- | ----------- |\n`;
    for (const p of props) {
      const propDesc = getFirstParagraph(p.comment);
      const opt = p.flags?.isOptional ? '?' : '';
      const dep = isDeprecated(p.comment) ? '⚠️ ' : '';
      out += `| \`${p.name}${opt}\` | ${fmtType(p.type, typeRegistry)} | ${dep}${escape(propDesc)} |\n`;
    }
    out += '\n';
    out += genPropertyDetailsSections(props);
  }

  return out;
}

/** Generate MDX for a class */
export function genClass(node: TypeDocNode, title: string, options: GeneratorOptions = {}): string {
  const { regenerateCommand, typeRegistry } = options;
  let out = mdxHeader(title, regenerateCommand);
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
      const propDesc = getFirstParagraph(p.comment);
      const opt = p.flags?.isOptional ? '?' : '';
      out += `| \`${p.name}${opt}\` | ${fmtType(p.type, typeRegistry)} | ${escape(propDesc)} |\n`;
    }
    out += '\n';
    out += genPropertyDetailsSections(props);
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
          out += `| \`${p.name}\` | ${fmtType(p.type, typeRegistry)} | ${escape(getText(p.comment))} |\n`;
        }
        out += '\n';
      }
      const returns = getTag(sig.comment, '@returns');
      if (returns) out += `#### Returns\n\n\`${returnType}\` - ${escape(returns)}\n\n`;
      out += `***\n\n`;
    }
  }

  return out;
}

/** Generate MDX for a function */
export function genFunction(node: TypeDocNode, title: string, options: GeneratorOptions = {}): string {
  const { regenerateCommand, typeRegistry } = options;
  const sig = node.signatures?.[0];
  if (!sig) return '';

  let out = mdxHeader(title, regenerateCommand);
  const desc = getText(sig.comment);
  if (desc) out += `${escape(desc)}\n\n`;

  const params = sig.parameters?.map((p) => `${p.name}: ${formatType(p.type)}`).join(', ') ?? '';
  const returnType = formatType(sig.type);
  out += `\`\`\`ts\n${node.name}(${params}): ${returnType}\n\`\`\`\n\n`;

  if (sig.parameters?.length) {
    out += `## Parameters\n\n| Name | Type | Description |\n| ---- | ---- | ----------- |\n`;
    for (const p of sig.parameters) {
      out += `| \`${p.name}\` | ${fmtType(p.type, typeRegistry)} | ${escape(getText(p.comment))} |\n`;
    }
    out += '\n';
  }

  const returns = getTag(sig.comment, '@returns');
  if (returns) out += `## Returns\n\n\`${returnType}\` - ${escape(returns)}\n\n`;

  const example = getTag(sig.comment, '@example');
  if (example) out += formatExample(example);

  return out;
}

/** Generate MDX for a type alias */
export function genTypeAlias(node: TypeDocNode, title: string, options: GeneratorOptions = {}): string {
  const { regenerateCommand } = options;
  const deprecated = isDeprecated(node.comment);
  const deprecationNote = getTag(node.comment, '@deprecated');

  let out = mdxHeader(title, regenerateCommand);

  if (deprecated) {
    out += `> ⚠️ **Deprecated**${deprecationNote ? `: ${deprecationNote.trim()}` : ''}\n\n`;
  }

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
  let out = mdxHeader(title, regenerateCommand);
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

// #endregion

// #region Type Registry

/**
 * Build a type registry from a TypeDoc JSON module by scanning all exported nodes.
 * Maps type names to Starlight documentation URLs.
 *
 * @param nodes - TypeDoc nodes to register
 * @param urlBuilder - Function that maps a node to its documentation URL path
 * @param registry - Optional existing registry to merge into (for cross-lib references)
 * @returns The populated type registry
 */
export function buildTypeRegistryFromNodes(
  nodes: TypeDocNode[],
  urlBuilder: (node: TypeDocNode, kindFolder: string) => string | undefined,
  registry = new Map<string, string>(),
): Map<string, string> {
  for (const node of nodes) {
    const kindFolder = KIND_FOLDER_MAP[node.kind];
    if (!kindFolder) continue;
    const url = urlBuilder(node, kindFolder);
    if (url) registry.set(node.name, url);
  }
  return registry;
}

// #endregion

// #region Adapter Docs Generator

/** A category bin for classifying adapter nodes */
export interface AdapterCategory {
  /** Display name for console output (e.g., "Components") */
  name: string;
  /** Output subfolder (e.g., "components") */
  folder: string;
  /** Classify a node into this category. Checked in array order; first match wins. */
  match: (node: TypeDocNode) => boolean;
}

/** Configuration for generating adapter documentation */
export interface AdapterConfig {
  /** Framework identifier for logging (e.g., "grid-angular") */
  name: string;
  /** Base URL for this adapter's docs (e.g., "/grid/angular/api") */
  urlBase: string;
  /** Path to TypeDoc JSON file */
  jsonPath: string;
  /** Output directory for MDX files */
  outputDir: string;
  /** Regenerate command (e.g., "bun nx typedoc grid-angular") */
  regenerateCommand: string;
  /** Node categories, checked in order. Uncategorized GENERATORS-compatible nodes go to "utilities". */
  categories: AdapterCategory[];
}

/** Base URL prefix for the core grid docs (for cross-linking re-exported types) */
const GRID_CORE_BASE = '/grid/api/core';

/**
 * Generate adapter documentation from TypeDoc JSON.
 *
 * Reads the JSON, builds a type registry, categorizes nodes, and writes MDX files.
 * This is the single entry point for adapter scripts (Angular, React, Vue).
 */
export function generateAdapterDocs(config: AdapterConfig): void {
  const { name, urlBase, jsonPath, outputDir, regenerateCommand, categories } = config;

  console.log(`Generating MDX from TypeDoc JSON for ${name}...\n`);

  if (!existsSync(jsonPath)) {
    console.error(`Error: TypeDoc JSON not found at ${jsonPath}`);
    console.error('Run `bunx typedoc --options typedoc.json` first to generate the JSON.');
    process.exit(1);
  }

  const json: TypeDocNode = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const nodes = (json.children ?? []).filter((n) => !isInternal(n.comment));

  // Build type registry for cross-linking
  const typeRegistry = buildTypeRegistryFromNodes(nodes, (node, kindFolder) => {
    for (const cat of categories) {
      if (cat.match(node)) return `${urlBase}/${cat.folder}/${node.name.toLowerCase()}/`;
    }
    // Fallback: utilities for known generators, core grid for re-exported types
    if (GENERATORS[node.kind]) return `${urlBase}/utilities/${node.name.toLowerCase()}/`;
    if (KIND_FOLDER_MAP[node.kind]) return `${GRID_CORE_BASE}/${kindFolder.toLowerCase()}/${node.name.toLowerCase()}/`;
    return undefined;
  });

  const genOpts: GeneratorOptions = { regenerateCommand, typeRegistry };

  // Clean output
  if (existsSync(outputDir)) rmSync(outputDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  // Categorize nodes into bins
  const bins = new Map<AdapterCategory, TypeDocNode[]>();
  for (const cat of categories) bins.set(cat, []);
  const utilities: TypeDocNode[] = [];

  for (const node of nodes) {
    let matched = false;
    for (const cat of categories) {
      if (cat.match(node)) {
        bins.get(cat)!.push(node);
        matched = true;
        break;
      }
    }
    if (!matched && GENERATORS[node.kind]) {
      utilities.push(node);
    }
  }

  // Write categorized nodes
  console.log(`Processing ${name} module...`);
  for (const [cat, catNodes] of bins) {
    if (!catNodes.length) continue;
    console.log(`  ${cat.name}:`);
    for (const node of catNodes) {
      const gen = GENERATORS[node.kind];
      if (!gen) continue;
      const mdx = gen(node, node.name, genOpts);
      writeMdx(outputDir, `${cat.folder}/${node.name}.mdx`, mdx, `${cat.folder}/${node.name}.mdx`);
    }
  }

  // Write uncategorized items as utilities
  if (utilities.length) {
    console.log('  Utilities:');
    for (const node of utilities) {
      const gen = GENERATORS[node.kind];
      if (!gen) continue;
      const mdx = gen(node, node.name, genOpts);
      writeMdx(outputDir, `utilities/${node.name}.mdx`, mdx, `utilities/${node.name}.mdx`);
    }
  }

  console.log(`\n✅ Done! MDX files written to ${outputDir.replace(/.*apps/, 'apps')}`);
}

// #endregion
