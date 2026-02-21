#!/usr/bin/env bun
/**
 * Generate a Pagefind search index from MDX documentation files.
 *
 * Since Storybook is a SPA (single iframe.html), Pagefind's HTML crawler can't
 * index the content. Instead, we parse MDX files directly and create custom
 * Pagefind records that link to the correct Storybook URLs.
 *
 * Run after build-storybook:
 *   bun apps/docs/scripts/generate-search-index.ts
 *
 * The generated index is written to dist/docs/pagefind/ and loaded by the
 * Pagefind UI embedded in the Storybook manager.
 */

import { existsSync, readFileSync } from 'fs';
import { close, createIndex } from 'pagefind';
import { join } from 'path';

// #region Configuration

const OUTPUT_DIR = join(process.cwd(), 'dist/docs');
const INDEX_JSON_PATH = join(OUTPUT_DIR, 'index.json');
const PAGEFIND_OUTPUT = join(OUTPUT_DIR, 'pagefind');

/**
 * Patterns for lines that should be stripped from MDX before extracting text.
 * This removes import statements, JSX component tags, code fences, etc.
 */
const STRIP_PATTERNS = [
  /^import\s.*/, // import statements
  /^export\s.*/, // export statements
  /^<Meta\s.*/, // <Meta of={...} />
  /^<Canvas\s.*/, // <Canvas of={...} />
  /^<Controls\s.*/, // <Controls of={...} />
  /^<Story\s.*/, // <Story />
  /^<Source\s.*/, // <Source />
  /^<ArgsTable\s.*/, // <ArgsTable />
  /^<Tabs>/, // <Tabs>
  /^<\/Tabs>/, // </Tabs>
  /^<Tab\s.*/, // <Tab label="...">
  /^<\/Tab>/, // </Tab>
  /^```/, // code fence markers
  /^\s*\|[-:|\s]+\|$/, // table separator rows (|---|---|)
];

// #endregion

// #region Types

interface StoryEntry {
  id: string;
  title: string;
  name: string;
  type: 'story' | 'docs' | 'component';
  importPath?: string;
  tags?: string[];
}

interface Section {
  heading: string;
  headingLevel: number;
  /** Anchor ID derived from heading text */
  anchor: string;
  /** Plain text content under this heading */
  content: string;
}

interface DocRecord {
  /** Storybook URL path, e.g. "?path=/docs/grid-core--core" */
  url: string;
  /** Document title from Storybook index */
  title: string;
  /** Heading hierarchy path, e.g. "Grid > Core > Columns" */
  breadcrumb: string;
  /** Plain text content */
  content: string;
  /** Category for filtering */
  category: string;
}

// #endregion

// #region MDX Parsing

/**
 * Strips MDX/JSX-specific syntax and extracts plain text content.
 * Preserves headings, paragraphs, list items, and table cells.
 */
function stripMdxToText(line: string): string | null {
  const trimmed = line.trim();

  // Skip empty lines
  if (!trimmed) return null;

  // Skip lines matching strip patterns
  for (const pattern of STRIP_PATTERNS) {
    if (pattern.test(trimmed)) return null;
  }

  // Skip standalone JSX tags (self-closing or opening/closing)
  if (/^<[A-Z][^>]*\/?>$/.test(trimmed)) return null;
  if (/^<\/[A-Z][^>]*>$/.test(trimmed)) return null;

  // Strip inline JSX tags but keep text content
  const withoutJsx = trimmed.replace(/<[^>]+>/g, '').trim();
  if (!withoutJsx) return null;

  // Strip markdown formatting but keep text
  return withoutJsx
    .replace(/\*\*(.*?)\*\*/g, '$1') // bold
    .replace(/\*(.*?)\*/g, '$1') // italic
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/^#+\s*/, '') // heading markers (we handle headings separately)
    .replace(/^[-*+]\s+/, '') // list markers
    .replace(/^\d+\.\s+/, '') // numbered list markers
    .trim();
}

/**
 * Generates a URL-safe anchor ID from heading text, matching how
 * Storybook/rehype-slug generates heading anchors.
 */
function headingToAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // remove non-word chars except spaces and hyphens
    .replace(/\s+/g, '-') // spaces to hyphens
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-|-$/g, ''); // trim leading/trailing hyphens
}

/**
 * Parses an MDX file into sections based on headings.
 * Each section contains a heading and the text content below it until the next heading.
 */
function parseMdxSections(content: string): Section[] {
  const lines = content.split('\n');
  const sections: Section[] = [];
  let inCodeBlock = false;

  // Start with a virtual root section for content before the first heading
  let currentSection: Section = {
    heading: '',
    headingLevel: 0,
    anchor: '',
    content: '',
  };

  for (const line of lines) {
    // Track code blocks to avoid treating # in code as headings
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Check for heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      // Save previous section if it has content
      if (currentSection.heading || currentSection.content.trim()) {
        sections.push(currentSection);
      }

      const level = headingMatch[1].length;
      const text = headingMatch[2]
        .replace(/`([^`]+)`/g, '$1') // strip backticks from heading
        .trim();

      currentSection = {
        heading: text,
        headingLevel: level,
        anchor: headingToAnchor(text),
        content: '',
      };
      continue;
    }

    // Accumulate text content
    const text = stripMdxToText(line);
    if (text) {
      currentSection.content += (currentSection.content ? ' ' : '') + text;
    }
  }

  // Don't forget the last section
  if (currentSection.heading || currentSection.content.trim()) {
    sections.push(currentSection);
  }

  return sections;
}

// #endregion

// #region Index Building

/**
 * Maps a Storybook index entry to the file path of its MDX source.
 * The importPath in index.json is relative to the workspace root with ./ prefix.
 */
function resolveImportPath(importPath: string): string {
  // importPath looks like "./libs/grid/docs/Core.mdx"
  return join(process.cwd(), importPath.replace(/^\.\//, ''));
}

/**
 * Extracts the category from a Storybook title path.
 * "Grid/Plugins/Selection" → "Plugins"
 * "Grid/Core" → "Grid"
 * "Grid/Introduction" → "Grid"
 */
function extractCategory(title: string): string {
  const parts = title.split('/');
  return parts.length > 2 ? parts[1] : parts[0];
}

/**
 * Builds doc records from the Storybook index and MDX files.
 * Creates one record per heading section for fine-grained search results.
 */
function buildRecords(entries: StoryEntry[]): DocRecord[] {
  const records: DocRecord[] = [];
  const docEntries = entries.filter((e) => e.type === 'docs' && e.importPath?.endsWith('.mdx'));

  for (const entry of docEntries) {
    const filePath = resolveImportPath(entry.importPath!);
    if (!existsSync(filePath)) {
      console.warn(`  ⚠ MDX file not found: ${filePath}`);
      continue;
    }

    const content = readFileSync(filePath, 'utf-8');
    const sections = parseMdxSections(content);
    const baseUrl = `?path=/docs/${entry.id}`;
    const category = extractCategory(entry.title);
    const titleParts = entry.title.split('/');

    // Create a record for each section with a heading
    for (const section of sections) {
      if (!section.content.trim() && !section.heading) continue;

      const url = section.anchor ? `${baseUrl}#${section.anchor}` : baseUrl;

      // Build breadcrumb: "Grid > Core > Section Heading"
      const breadcrumb = section.heading ? `${titleParts.join(' > ')} > ${section.heading}` : titleParts.join(' > ');

      // For heading-level records, include the heading text in content for better matching
      const searchContent = section.heading ? `${section.heading}. ${section.content}` : section.content;

      if (!searchContent.trim()) continue;

      records.push({
        url,
        title: section.heading || titleParts[titleParts.length - 1],
        breadcrumb,
        content: searchContent,
        category,
      });
    }

    // Also create a top-level record for the whole document if it has content
    const allContent = sections.map((s) => [s.heading, s.content].filter(Boolean).join(': ')).join('. ');
    if (allContent.trim()) {
      records.push({
        url: baseUrl,
        title: titleParts[titleParts.length - 1],
        breadcrumb: titleParts.join(' > '),
        content: allContent.slice(0, 2000), // Truncate to avoid huge records
        category,
      });
    }
  }

  return records;
}

// #endregion

// #region Main

async function main() {
  console.log('🔍 Generating Pagefind search index...\n');

  // Read Storybook's index.json
  if (!existsSync(INDEX_JSON_PATH)) {
    console.error(`❌ index.json not found at ${INDEX_JSON_PATH}`);
    console.error('   Run "bun nx build docs" first.');
    process.exit(1);
  }

  const indexJson = JSON.parse(readFileSync(INDEX_JSON_PATH, 'utf-8'));
  const entries: StoryEntry[] = Object.values(indexJson.entries || {});
  console.log(`  📚 Found ${entries.length} total entries in index.json`);

  // Build records from MDX files
  const records = buildRecords(entries);
  console.log(`  📝 Created ${records.length} search records from MDX content\n`);

  // Create Pagefind index
  const { index, errors } = await createIndex({
    forceLanguage: 'en',
  });

  if (errors.length) {
    console.error('❌ Failed to create Pagefind index:', errors);
    process.exit(1);
  }

  if (!index) {
    console.error('❌ Pagefind index was not created');
    process.exit(1);
  }

  // Add records to index
  let added = 0;
  for (const record of records) {
    const result = await index.addCustomRecord({
      url: record.url,
      content: record.content,
      language: 'en',
      meta: {
        title: record.title,
        category: record.category,
        breadcrumb: record.breadcrumb,
      },
      filters: {
        category: [record.category],
      },
    });

    if (result.errors.length) {
      console.warn(`  ⚠ Error indexing ${record.url}:`, result.errors);
    } else {
      added++;
    }
  }

  console.log(`  ✅ Indexed ${added} records`);

  // Write the index files
  const writeResult = await index.writeFiles({
    outputPath: PAGEFIND_OUTPUT,
  });

  if (writeResult.errors.length) {
    console.error('❌ Failed to write Pagefind index:', writeResult.errors);
    process.exit(1);
  }

  console.log(`  📦 Index written to ${writeResult.outputPath}\n`);
  console.log('✅ Search index generated successfully!');

  await close();
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

// #endregion
