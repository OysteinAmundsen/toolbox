/**
 * Generate Storybook MDX files directly from TypeDoc JSON output.
 *
 * This script reads the structured JSON from TypeDoc and generates clean MDX files,
 * avoiding the inefficient JSON → Markdown → MDX pipeline.
 *
 * Special handling for DataGridElement:
 * - Splits into two documents: public API and plugin development API
 * - Plugin API members identified by @internal Plugin API tag or _ prefix
 *
 * Run: `bun nx typedoc grid`
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

// Plugin name mapping for Storybook titles (only non-obvious mappings)
const PLUGIN_TITLE_MAP: Record<string, string> = {
  'Column Virtualization': 'Column-Virtualization',
  'Master Detail': 'Master-Detail',
  'Multi Sort': 'Multi-Sort',
  'Server Side': 'Server-Side',
  'Undo Redo': 'Undo-Redo',
};

/** Get plugin title - uses map for special cases, otherwise returns as-is */
const getPluginTitle = (rawName: string): string => PLUGIN_TITLE_MAP[rawName] ?? rawName;

// ============================================================================
// Helpers
// ============================================================================

const mdxHeader = (title: string) => `{/* Auto-generated from JSDoc - do not edit manually */}
{/* Regenerate with: bun nx typedoc grid */}
import { Meta } from '@storybook/addon-docs/blocks';

<Meta title="${title}" />

`;

/**
 * Escape special MDX characters, but preserve content inside fenced code blocks.
 * MDX requires escaping < > { } in regular text, but NOT inside code fences.
 */
const escape = (text: string): string => {
  // Split on fenced code blocks (``` ... ```) while keeping the delimiters
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part, i) => {
      // Odd indices are the code blocks (captured groups)
      if (i % 2 === 1) return part; // Leave code blocks unchanged
      // Escape special characters in non-code-block parts
      return part.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
    })
    .join('');
};

/** Escape only curly braces for MDX - for inline code in tables where we don't have code fences */
const escapeCode = (text: string): string => text.replace(/\{/g, '\\{').replace(/\}/g, '\\}');

const getText = (comment?: TypeDocComment): string => comment?.summary?.map((s) => s.text).join('') ?? '';

const getTag = (comment: TypeDocComment | undefined, tag: string): string =>
  comment?.blockTags
    ?.find((b) => b.tag === tag)
    ?.content.map((c) => c.text)
    .join('') ?? '';

/**
 * Get all @example tags from a comment.
 * Returns an array of example code blocks with optional titles.
 * TypeDoc 0.28+ puts the example title in a `name` property.
 */
const getAllExamples = (comment?: TypeDocComment): { title?: string; code: string }[] => {
  if (!comment?.blockTags) return [];
  return comment.blockTags
    .filter((b) => b.tag === '@example')
    .map((b) => {
      // TypeDoc 0.28+ puts the title after @example in the `name` property
      const title = (b as { name?: string }).name?.trim();
      const text = b.content
        .map((c) => c.text)
        .join('')
        .trim();
      return { title, code: text };
    });
};

/**
 * Format all @example blocks for MDX output.
 * Uses a single "## Examples" header when there are multiple examples.
 */
function formatAllExamples(comment?: TypeDocComment): string {
  const examples = getAllExamples(comment);
  if (examples.length === 0) return '';

  // Single "Examples" section header
  const header = examples.length === 1 ? '## Example\n\n' : '## Examples\n\n';

  const body = examples
    .map((ex) => {
      // Use the title if available, otherwise just show the code
      const titleLine = ex.title ? `### ${ex.title}\n\n` : '';
      const code = ex.code.startsWith('```') ? ex.code : `\`\`\`ts\n${ex.code}\n\`\`\``;
      return `${titleLine}${code}\n\n`;
    })
    .join('');

  return header + body;
}

/**
 * Get all @see tags from a comment, handling both plain text and {@link} references.
 * Returns an array of formatted markdown links.
 *
 * TypeDoc sometimes merges multiple @see tags into a single block tag when they're
 * on consecutive lines. We detect this by looking for newline patterns and split
 * them into separate list items.
 */
const getSeeLinks = (comment?: TypeDocComment): string[] => {
  if (!comment?.blockTags) return [];

  const allLinks: string[] = [];

  comment.blockTags
    .filter((b) => b.tag === '@see')
    .forEach((b) => {
      // Reconstruct the @see content, handling inline-tag for {@link}
      const result = b.content
        .map((c) => {
          if (c.kind === 'inline-tag' && c.tag === '@link') {
            // {@link TypeName} - try to resolve to a documentation link
            const typeName = c.text?.trim() ?? '';
            const url = resolveTypeLink(typeName);
            if (url) {
              // Create a clickable markdown link
              return `[\`${typeName}\`](${url})`;
            }
            // Fallback to inline code if type not found in registry
            return `\`${typeName}\``;
          }
          return c.text ?? '';
        })
        .join('');

      // Split on newlines to handle merged @see tags
      // Each line typically starts with " - " after a newline
      const lines = result.split('\n');
      for (const line of lines) {
        let cleaned = line.trim().replace(/^-\s*/, ''); // Remove leading "- " if present
        // Remove "Extends BaseGridPlugin" or similar that TypeDoc appends from @internal tag
        cleaned = cleaned.replace(/\s*Extends\s+\w+Plugin\s*$/g, '').trim();
        if (cleaned.length > 0) {
          allLinks.push(cleaned);
        }
      }
    });

  return allLinks;
};

/**
 * Format @see links as a "See Also" section for MDX output.
 * Ensures clean list formatting without double spaces or leading whitespace issues.
 */
const formatSeeLinks = (comment?: TypeDocComment): string => {
  const links = getSeeLinks(comment);
  if (links.length === 0) return '';
  // Trim each link to avoid leading/trailing whitespace issues
  const cleanLinks = links.map((l) => l.trim());
  return `## See Also\n\n${cleanLinks.map((l) => `- ${l}`).join('\n')}\n\n`;
};

const isDeprecated = (c?: TypeDocComment): boolean => c?.blockTags?.some((b) => b.tag === '@deprecated') ?? false;

/**
 * Format an @example block for MDX output.
 * Handles both raw code (wraps in fence) and code that already has markdown fences.
 */
function formatExample(example: string): string {
  const trimmed = example.trim();
  // Check if the example already contains a code fence
  if (trimmed.startsWith('```')) {
    // Already has code fence, just use as-is
    return `#### Example\n\n${trimmed}\n\n`;
  }
  // Wrap raw code in a fence
  return `#### Example\n\n\`\`\`ts\n${trimmed}\n\`\`\`\n\n`;
}

/** Check if comment has @internal (any kind) - checks both direct comment and signature comments */
const isInternal = (c?: TypeDocComment): boolean => c?.modifierTags?.includes('@internal') ?? false;

/** Check if node or its signatures are marked @internal (works for methods and accessors) */
const isNodeInternal = (node: TypeDocNode): boolean =>
  isInternal(node.comment) ||
  node.signatures?.some((s) => isInternal(s.comment)) ||
  isInternal(node.getSignature?.comment) ||
  isInternal(node.setSignature?.comment) ||
  false;

/** Check if comment has @internal Plugin API specifically */
const isPluginApi = (c?: TypeDocComment): boolean =>
  c?.modifierTags?.includes('@internal') && getText(c).includes('Plugin API');

/** Get @category tag value */
const getCategoryTag = (c?: TypeDocComment): string | undefined => getTag(c, '@category') || undefined;

function formatType(type?: TypeDocType): string {
  if (!type) return 'unknown';
  switch (type.type) {
    case 'intrinsic':
    case 'literal':
      return String(type.value ?? type.name ?? 'unknown');
    case 'reference':
      return type.typeArguments?.length
        ? `${type.name}<${type.typeArguments.map(formatType).join(', ')}>`
        : (type.name ?? 'unknown');
    case 'array':
      return `${formatType(type.elementType)}[]`;
    case 'union':
      return type.types?.map(formatType).join(' | ') ?? 'unknown';
    case 'intersection':
      return type.types?.map(formatType).join(' & ') ?? 'unknown';
    case 'reflection':
      return 'object';
    default:
      return type.name ?? 'unknown';
  }
}

// ============================================================================
// MDX Generators
// ============================================================================

function genPropertiesTable(props: TypeDocNode[]): string {
  if (!props.length) return '';
  let out = `## Properties\n\n| Property | Type | Description |\n| -------- | ---- | ----------- |\n`;
  for (const p of props) {
    const type = formatType(p.type);
    const desc = getText(p.comment).split('\n')[0];
    const opt = p.flags?.isOptional ? '?' : '';
    const dep = isDeprecated(p.comment) ? '⚠️ ' : '';
    out += `| \`${p.name}${opt}\` | \`${escape(type)}\` | ${dep}${escape(desc)} |\n`;
  }
  return out + '\n';
}

function genAccessor(node: TypeDocNode): string {
  const comment = node.getSignature?.comment ?? node.setSignature?.comment;
  const type = formatType(node.getSignature?.type ?? node.setSignature?.parameters?.[0]?.type);
  const readonly = !node.setSignature ? 'readonly ' : '';
  const isStatic = node.flags?.isStatic ? 'static ' : '';

  let out = `### ${node.name}\n\n`;
  if (isDeprecated(comment)) out += `> ⚠️ **Deprecated**: ${getTag(comment, '@deprecated')}\n\n`;

  const desc = getText(comment);
  if (desc) out += `${escape(desc)}\n\n`;

  out += `\`\`\`ts\n${isStatic}${readonly}${node.name}: ${type}\n\`\`\`\n\n`;

  const example = getTag(comment, '@example');
  if (example) out += formatExample(example);

  return out + `***\n\n`;
}

function genMethod(node: TypeDocNode, showOverride = false): string {
  const sig = node.signatures?.[0];
  if (!sig) return '';

  const params = sig.parameters?.map((p) => `${p.name}: ${formatType(p.type)}`).join(', ') ?? '';
  const returnType = formatType(sig.type);
  const isStatic = node.flags?.isStatic ? 'static ' : '';
  const isOverride = showOverride && node.overwrites;

  let out = `### ${node.name}()\n\n`;
  if (isDeprecated(sig.comment)) out += `> ⚠️ **Deprecated**: ${getTag(sig.comment, '@deprecated')}\n\n`;

  const desc = getText(sig.comment);
  if (desc) {
    const prefix = isOverride ? '`override` — ' : '';
    out += `${prefix}${escape(desc)}\n\n`;
  } else if (isOverride) {
    out += `\`override\`\n\n`;
  }

  out += `\`\`\`ts\n${isStatic}${node.name}(${params}): ${returnType}\n\`\`\`\n\n`;

  if (sig.parameters?.length) {
    out += `#### Parameters\n\n| Name | Type | Description |\n| ---- | ---- | ----------- |\n`;
    for (const p of sig.parameters) {
      out += `| \`${p.name}\` | \`${escape(formatType(p.type))}\` | ${escape(getText(p.comment))} |\n`;
    }
    out += '\n';
  }

  const returns = getTag(sig.comment, '@returns');
  if (returns) out += `#### Returns\n\n\`${escapeCode(returnType)}\` - ${escape(returns)}\n\n`;

  const example = getTag(sig.comment, '@example');
  if (example) out += formatExample(example);

  return out + `***\n\n`;
}

function genClass(node: TypeDocNode, title: string, filter?: (m: TypeDocNode) => boolean): string {
  let out = mdxHeader(title) + `# Class: ${node.name}\n\n`;
  const desc = getText(node.comment);
  if (desc) out += `${escape(desc)}\n\n`;

  const members = (node.children ?? []).filter(filter ?? (() => true));
  return genClassBody(node.name, out, members);
}

/**
 * Generate MDX for a plugin class, excluding inherited members from BaseGridPlugin
 * and members marked @internal. Adds a note at the top linking to the base class documentation.
 */
function genPluginClass(node: TypeDocNode, title: string): string {
  let out = mdxHeader(title) + `# Class: ${node.name}\n\n`;
  let desc = getText(node.comment);
  // Remove "Extends BaseGridPlugin" text that comes from @internal marker
  desc = desc.replace(/\s*Extends BaseGridPlugin\s*/g, '').trim();
  if (desc) out += `${escape(desc)}\n\n`;

  // Add @example blocks after the description tables
  out += formatAllExamples(node.comment);

  // Add @see links right after examples
  out += formatSeeLinks(node.comment);

  // Add inheritance note
  out += `> **Extends** [BaseGridPlugin](/docs/grid-api-plugin-development-classes-basegridplugin--docs)\n`;
  out += `>\n`;
  out += `> Inherited methods like \`attach()\`, \`detach()\`, \`afterRender()\`, etc. are documented in the base class.\n\n`;

  // Filter out inherited members AND @internal members
  const members = (node.children ?? []).filter((m) => !m.inheritedFrom && !m.flags?.isInherited && !isNodeInternal(m));
  return genClassBody(node.name, out, members, { showOverride: true });
}

/** Options for class body generation */
interface ClassBodyOptions {
  /** Show override indicator for methods that override base class */
  showOverride?: boolean;
}

/** Shared class body generator for both regular and plugin classes */
function genClassBody(className: string, out: string, members: TypeDocNode[], options: ClassBodyOptions = {}): string {
  const { showOverride = false } = options;
  const props = members.filter((m) => m.kind === KIND.Property);
  const accessors = members.filter((m) => m.kind === KIND.Accessor);
  const methods = members.filter((m) => m.kind === KIND.Method);
  const ctors = members.filter((m) => m.kind === KIND.Constructor);

  if (ctors.length) {
    out += `## Constructors\n\n`;
    for (const c of ctors) {
      const sig = c.signatures?.[0];
      if (sig) {
        const params = sig.parameters?.map((p) => `${p.name}: ${formatType(p.type)}`).join(', ') ?? '';
        out += `### constructor\n\n\`\`\`ts\nnew ${className}(${params})\n\`\`\`\n\n`;
      }
    }
  }

  out += genPropertiesTable(props);
  if (accessors.length) {
    out += `## Accessors\n\n`;
    for (const a of accessors) out += genAccessor(a);
  }
  if (methods.length) {
    out += `## Methods\n\n`;
    for (const m of methods) out += genMethod(m, showOverride);
  }
  return out;
}

function genInterface(node: TypeDocNode, title: string): string {
  let out = mdxHeader(title) + `# Interface: ${node.name}\n\n`;
  const desc = getText(node.comment);
  if (desc) out += `${escape(desc)}\n\n`;

  // Add @example if present
  const example = getTag(node.comment, '@example');
  if (example) out += formatExample(example);

  out += genPropertiesTable(node.children?.filter((m) => m.kind === KIND.Property) ?? []);

  // Add @see links at the end
  out += formatSeeLinks(node.comment);

  return out;
}

function genTypeAlias(node: TypeDocNode, title: string): string {
  let out = mdxHeader(title) + `# Type: ${node.name}\n\n`;
  const desc = getText(node.comment);
  if (desc) out += `${escape(desc)}\n\n`;
  out += `\`\`\`ts\ntype ${node.name} = ${formatType(node.type)}\n\`\`\`\n\n`;

  // Add @example if present
  const example = getTag(node.comment, '@example');
  if (example) out += formatExample(example);

  // Add @see links if present
  out += formatSeeLinks(node.comment);

  return out;
}

function genFunction(node: TypeDocNode, title: string): string {
  const sig = node.signatures?.[0];
  if (!sig) return '';

  let out = mdxHeader(title) + `# Function: ${node.name}\n\n`;
  const desc = getText(sig.comment);
  if (desc) out += `${escape(desc)}\n\n`;

  const params = sig.parameters?.map((p) => `${p.name}: ${formatType(p.type)}`).join(', ') ?? '';
  out += `\`\`\`ts\nfunction ${node.name}(${params}): ${formatType(sig.type)}\n\`\`\`\n\n`;

  if (sig.parameters?.length) {
    out += `## Parameters\n\n| Name | Type | Description |\n| ---- | ---- | ----------- |\n`;
    for (const p of sig.parameters) {
      out += `| \`${p.name}\` | \`${escape(formatType(p.type))}\` | ${escape(getText(p.comment))} |\n`;
    }
    out += '\n';
  }
  return out;
}

function genEnum(node: TypeDocNode, title: string): string {
  let out = mdxHeader(title) + `# Enum: ${node.name}\n\n`;
  const desc = getText(node.comment);
  if (desc) out += `${escape(desc)}\n\n`;

  const members = node.children ?? [];
  if (members.length) {
    out += `## Members\n\n| Member | Value | Description |\n| ------ | ----- | ----------- |\n`;
    for (const m of members) {
      out += `| \`${m.name}\` | \`${m.type?.value ?? ''}\` | ${escape(getText(m.comment))} |\n`;
    }
    out += '\n';
  }
  return out;
}

// ============================================================================
// DataGridElement Split
// ============================================================================

/** Get comment for a class member (handles accessors, methods, properties) */
const getMemberComment = (m: TypeDocNode): TypeDocComment | undefined =>
  m.getSignature?.comment ?? m.signatures?.[0]?.comment ?? m.comment;

/** Check if member is public API (not internal, not underscore-prefixed, not Framework Adapters) */
const isPublicMember = (m: TypeDocNode): boolean => {
  if (m.name.startsWith('_')) return false;
  const c = getMemberComment(m);
  if (isInternal(c)) return false; // Exclude all @internal members
  if (getCategoryTag(c)?.includes('Framework Adapters')) return false; // Separate category
  return true;
};

/** Check if member is Plugin API (_underscore prefix or @internal Plugin API) */
const isPluginMember = (m: TypeDocNode): boolean => {
  if (m.name.startsWith('__')) return false; // Deeply internal
  if (m.name.startsWith('_')) return true;
  const c = getMemberComment(m);
  return isPluginApi(c);
};

/** Check if member is Framework Adapter API */
const isFrameworkAdapterMember = (m: TypeDocNode): boolean => {
  const c = getMemberComment(m);
  return getCategoryTag(c)?.includes('Framework Adapters') ?? false;
};

/** Generate members section (properties, accessors, methods) */
function genMembersSection(members: TypeDocNode[]): string {
  let out = '';
  const props = members.filter((m) => m.kind === KIND.Property);
  const accessors = members.filter((m) => m.kind === KIND.Accessor);
  const methods = members.filter((m) => m.kind === KIND.Method);

  out += genPropertiesTable(props);
  if (accessors.length) {
    out += `## Accessors\n\n`;
    for (const a of accessors) out += genAccessor(a);
  }
  if (methods.length) {
    out += `## Methods\n\n`;
    for (const m of methods) out += genMethod(m);
  }
  return out;
}

/** Write MDX file with directory creation */
function writeMdx(outDir: string, relativePath: string, content: string, label: string): void {
  const fullPath = join(outDir, ...relativePath.split('/'));
  mkdirSync(join(outDir, ...relativePath.split('/').slice(0, -1)), { recursive: true });
  writeFileSync(fullPath, content);
  console.log(`    ✓ ${relativePath} (${label})`);
}

function genDataGridSplit(node: TypeDocNode, outDir: string): void {
  // Public API
  let publicMdx = mdxHeader('Grid/API/Core/Classes/DataGridElement');
  publicMdx += `# Class: DataGridElement

High-performance data grid web component (\`<tbw-grid>\`).

## Instantiation

**Do not call the constructor directly.** Use one of these approaches:

\`\`\`typescript
// Recommended: Use createGrid() for TypeScript type safety
import { createGrid, SelectionPlugin } from '@toolbox-web/grid/all';

const grid = createGrid<Employee>({
  columns: [
    { field: 'name', header: 'Name' },
    { field: 'email', header: 'Email' }
  ],
  plugins: [new SelectionPlugin()]
});
grid.rows = employees;
document.body.appendChild(grid);

// Alternative: Query existing element from DOM
import { queryGrid } from '@toolbox-web/grid';
const grid = queryGrid<Employee>('#my-grid');

// Alternative: Use document.createElement (loses type inference)
const grid = document.createElement('tbw-grid');
\`\`\`

`;
  publicMdx += genMembersSection((node.children ?? []).filter(isPublicMember));
  writeMdx(outDir, 'API/Core/Classes/DataGridElement.mdx', publicMdx, 'public');

  // Plugin API
  let pluginMdx = mdxHeader('Grid/API/Plugin Development/Classes/DataGridElement');
  pluginMdx += `# Class: DataGridElement (Plugin API)

Internal API for plugin developers. Members marked with \`@internal Plugin API\`
or using the \`_underscore\` prefix convention.

See the [public API documentation](?path=/docs/grid-api-core-classes-datagridelement--docs) for consumer-facing members.

| Prefix | Meaning |
| ------ | ------- |
| _(none)_ | Public API |
| \`_\` | Protected/plugin-accessible |
| \`__\` | Deeply internal (not documented) |

`;
  pluginMdx += genMembersSection((node.children ?? []).filter(isPluginMember));
  writeMdx(outDir, 'API/Plugin Development/Classes/DataGridElement-PluginAPI.mdx', pluginMdx, 'plugin');

  // Framework Adapters
  const adapterMembers = (node.children ?? []).filter(isFrameworkAdapterMember);
  if (adapterMembers.length) {
    let adapterMdx = mdxHeader('Grid/API/Framework Adapters/Classes/DataGridElement');
    adapterMdx += `# Class: DataGridElement (Framework Adapters)

API for framework adapter developers (React, Angular, Vue, etc.).
These methods are used by framework integration libraries to register adapters
and manage column/renderer lifecycles.

See the [public API documentation](?path=/docs/grid-api-core-classes-datagridelement--docs) for consumer-facing members.

`;
    adapterMdx += genMembersSection(adapterMembers);
    writeMdx(outDir, 'API/Framework Adapters/Classes/DataGridElement-Adapters.mdx', adapterMdx, 'adapters');
  }
}

// ============================================================================
// Processing
// ============================================================================

const KIND_FOLDER_MAP: Record<number, string> = {
  [KIND.Class]: 'Classes',
  [KIND.Interface]: 'Interfaces',
  [KIND.TypeAlias]: 'Types',
  [KIND.Function]: 'Functions',
  [KIND.Enum]: 'Enums',
};

const GENERATORS: Record<number, (n: TypeDocNode, t: string) => string> = {
  [KIND.Class]: genClass,
  [KIND.Interface]: genInterface,
  [KIND.TypeAlias]: genTypeAlias,
  [KIND.Function]: genFunction,
  [KIND.Enum]: genEnum,
};

/** Get @category tag value from a node */
function getCategory(node: TypeDocNode): string | undefined {
  const comment = node.signatures?.[0]?.comment ?? node.comment;
  return getTag(comment, '@category') ?? undefined;
}

/** Check if node is categorized as Plugin Development */
function isPluginDevelopment(node: TypeDocNode): boolean {
  return getCategory(node)?.includes('Plugin Development') ?? false;
}

/** Check if node is categorized as Framework Adapters */
function isFrameworkAdapters(node: TypeDocNode): boolean {
  return getCategory(node)?.includes('Framework Adapters') ?? false;
}

// ============================================================================
// Type Registry - maps type names to their Storybook URLs
// ============================================================================

/**
 * Registry mapping type names to their Storybook documentation URLs.
 * Built during the first pass through TypeDoc JSON, used when resolving {@link} references.
 */
const typeRegistry = new Map<string, string>();

/**
 * Build the type registry by scanning all modules in the TypeDoc output.
 * Must be called before processing any MDX that uses @see/@link references.
 */
function buildTypeRegistry(json: TypeDocNode): void {
  const coreModule = json.children?.find((c) => c.name === 'Core' || c.name === 'core');
  const pluginModules = json.children?.filter((c) => c.name.startsWith('Plugins/')) ?? [];

  // Register Core types
  if (coreModule) {
    for (const node of coreModule.children ?? []) {
      const kindFolder = KIND_FOLDER_MAP[node.kind];
      if (!kindFolder) continue;

      // Determine the section (Core, Plugin Development, or Framework Adapters)
      let section = 'Core';
      if (isPluginDevelopment(node)) section = 'Plugin Development';
      else if (isFrameworkAdapters(node)) section = 'Framework Adapters';

      // Build the Storybook URL path
      const urlPath = `grid-api-${section.toLowerCase().replace(/\s+/g, '-')}-${kindFolder.toLowerCase()}-${node.name.toLowerCase()}--docs`;
      typeRegistry.set(node.name, `/docs/${urlPath}`);
    }
  }

  // Register Plugin types
  for (const plugin of pluginModules) {
    if (plugin.kind !== KIND.Module) continue;

    const rawName = plugin.name.replace(/^Plugins\//, '');
    const title = getPluginTitle(rawName);

    for (const node of plugin.children ?? []) {
      const kindFolder = KIND_FOLDER_MAP[node.kind];
      if (!kindFolder) continue;

      // Build the Storybook URL path for plugin types
      const urlPath = `grid-plugins-${title.toLowerCase()}-${kindFolder.toLowerCase()}-${node.name.toLowerCase()}--docs`;
      typeRegistry.set(node.name, `/docs/${urlPath}`);
    }
  }
}

/**
 * Resolve a type name to its Storybook documentation URL.
 * Returns the URL if found, or null if the type is not in the registry.
 */
function resolveTypeLink(typeName: string): string | null {
  return typeRegistry.get(typeName) ?? null;
}

// ============================================================================
// Module Processing
// ============================================================================

interface ProcessedNode {
  node: TypeDocNode;
  kindFolder: string;
  gen: (n: TypeDocNode, t: string) => string;
}

function processCoreModule(module: TypeDocNode, outDir: string): void {
  const coreNodes: ProcessedNode[] = [];
  const pluginDevNodes: ProcessedNode[] = [];
  const adapterNodes: ProcessedNode[] = [];

  for (const node of module.children ?? []) {
    // DataGridElement special handling
    if (node.name === 'DataGridElement' && node.kind === KIND.Class) {
      genDataGridSplit(node, outDir);
      continue;
    }

    const kindFolder = KIND_FOLDER_MAP[node.kind];
    const gen = GENERATORS[node.kind];
    if (!kindFolder || !gen) continue;

    const item: ProcessedNode = { node, kindFolder, gen };

    if (isPluginDevelopment(node)) {
      pluginDevNodes.push(item);
    } else if (isFrameworkAdapters(node)) {
      adapterNodes.push(item);
    } else {
      coreNodes.push(item);
    }
  }

  // Write Core items to Grid/API/Core/{kindFolder}
  console.log('  Core API:');
  for (const { node, kindFolder, gen } of coreNodes) {
    const title = `Grid/API/Core/${kindFolder}/${node.name}`;
    const mdx = gen(node, title);
    const outPath = join(outDir, 'API', 'Core', kindFolder, `${node.name}.mdx`);
    mkdirSync(join(outDir, 'API', 'Core', kindFolder), { recursive: true });
    writeFileSync(outPath, mdx);
    console.log(`    ✓ API/Core/${kindFolder}/${node.name}.mdx`);
  }

  // Write Plugin Development items to Grid/API/Plugin Development/{kindFolder}
  if (pluginDevNodes.length) {
    console.log('  Plugin Development:');
    for (const { node, kindFolder, gen } of pluginDevNodes) {
      const title = `Grid/API/Plugin Development/${kindFolder}/${node.name}`;
      const mdx = gen(node, title);
      const outPath = join(outDir, 'API', 'Plugin Development', kindFolder, `${node.name}.mdx`);
      mkdirSync(join(outDir, 'API', 'Plugin Development', kindFolder), { recursive: true });
      writeFileSync(outPath, mdx);
      console.log(`    ✓ API/Plugin Development/${kindFolder}/${node.name}.mdx`);
    }
  }

  // Write Framework Adapters items to Grid/API/Framework Adapters/{kindFolder}
  if (adapterNodes.length) {
    console.log('  Framework Adapters:');
    for (const { node, kindFolder, gen } of adapterNodes) {
      const title = `Grid/API/Framework Adapters/${kindFolder}/${node.name}`;
      const mdx = gen(node, title);
      const outPath = join(outDir, 'API', 'Framework Adapters', kindFolder, `${node.name}.mdx`);
      mkdirSync(join(outDir, 'API', 'Framework Adapters', kindFolder), { recursive: true });
      writeFileSync(outPath, mdx);
      console.log(`    ✓ API/Framework Adapters/${kindFolder}/${node.name}.mdx`);
    }
  }
}

function processPluginModules(pluginModules: TypeDocNode[], outDir: string): void {
  for (const plugin of pluginModules) {
    if (plugin.kind !== KIND.Module) continue;

    // Extract plugin name from "Plugins/Clipboard" -> "Clipboard"
    const rawName = plugin.name.replace(/^Plugins\//, '');
    const title = getPluginTitle(rawName);
    const subDir = `Plugins-${rawName.replace(/\s+/g, '-')}`;

    console.log(`  ${title}:`);
    for (const node of plugin.children ?? []) {
      const kindFolder = KIND_FOLDER_MAP[node.kind];
      // Use specialized generator for plugin classes to filter inherited members
      const gen = node.kind === KIND.Class ? genPluginClass : GENERATORS[node.kind];
      if (!kindFolder || !gen) continue;

      const mdx = gen(node, `Grid/Plugins/${title}/${kindFolder}/${node.name}`);
      const outPath = join(outDir, subDir, kindFolder, `${node.name}.mdx`);
      mkdirSync(join(outDir, subDir, kindFolder), { recursive: true });
      writeFileSync(outPath, mdx);
      console.log(`    ✓ ${subDir}/${kindFolder}/${node.name}.mdx`);
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log('Generating Storybook MDX from TypeDoc JSON...\n');

  if (!existsSync(JSON_PATH)) {
    console.error(`Error: TypeDoc JSON not found at ${JSON_PATH}`);
    console.error('Run `bun nx typedoc grid` first to generate the JSON.');
    process.exit(1);
  }

  const json: TypeDocNode = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));

  // Build type registry first so @see/@link references can be resolved
  buildTypeRegistry(json);

  // Clean output
  if (existsSync(OUTPUT_DIR)) rmSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const coreModule = json.children?.find((c) => c.name === 'Core' || c.name === 'core');
  // Plugin modules are now named "Plugins/Clipboard", "Plugins/Editing", etc.
  const pluginModules = json.children?.filter((c) => c.name.startsWith('Plugins/')) ?? [];

  if (coreModule) {
    console.log('Processing Core module...');
    processCoreModule(coreModule, OUTPUT_DIR);
  }

  if (pluginModules.length) {
    console.log('\nProcessing Plugins...');
    processPluginModules(pluginModules, OUTPUT_DIR);
  }

  console.log('\n✅ Done! MDX files written to libs/grid/docs/api/');
}

main().catch(console.error);
