/**
 * _llm-markdown.ts — Pure MDX → agent-markdown transform (no Astro/Vite deps).
 *
 * Underscore prefix keeps this OUT of the route table; it is a helper imported
 * by the `[...slug].md.ts` endpoint. Kept pure (demo resolution is injected) so
 * it can be unit-tested without a running Vite/Astro pipeline.
 *
 * Goal: turn a human-facing `.mdx` doc page into a lean, self-contained Markdown
 * document that an AI agent can fetch in isolation. The critical job is
 * **inlining demo `<script>` blocks** — in the source MDX the runnable code lives
 * inside imported `.astro` demo components (`<IntroBasicDemo />`), so an agent that
 * only sees the MDX would get prose plus an opaque component tag. We resolve each
 * demo back to its `.astro` source and inline the script as a fenced code block.
 */

// #region Types

export interface AgentMarkdownOptions {
  /**
   * Resolve a demo `.astro` path (e.g. `demos/IntroBasicDemo.astro`) to its raw
   * source text, or `undefined` if it cannot be found.
   */
  resolveDemo: (relPath: string) => string | undefined;
  /**
   * Return `true` if the given lowercase doc slug (e.g. `grid/getting-started`)
   * has a generated `.md` companion page. Used to rewrite internal HTML links to
   * their `.md` form so agents stay in the markdown graph. When omitted, internal
   * links are left untouched.
   */
  hasDoc?: (slug: string) => boolean;
}

// #endregion

// #region Frontmatter

interface Frontmatter {
  title?: string;
  description?: string;
}

/** Split leading `---` frontmatter from the body. Minimal, no YAML dependency. */
function splitFrontmatter(raw: string): { data: Frontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: raw };
  const data: Frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let value = kv[2].trim();
    // Strip surrounding quotes if present.
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key === 'title' || key === 'description') data[key] = value;
  }
  return { data, body: raw.slice(match[0].length) };
}

/**
 * Extract just the `title` / `description` frontmatter from a raw MDX page.
 * Used by `llms.txt.ts` to label each index link without running the full
 * body transform.
 */
export function extractFrontmatter(raw: string): { title?: string; description?: string } {
  return splitFrontmatter(raw).data;
}

// #endregion

// #region Demo inlining

/** Extract the first `<script>` block's inner content from a demo `.astro` file. */
function extractDemoScript(astroSource: string): string | undefined {
  const match = astroSource.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return undefined;
  return match[1].replace(/^\r?\n/, '').replace(/\s+$/, '');
}

/** Build a fenced code block from a demo's script, or a comment if unavailable. */
function demoCodeBlock(relPath: string, resolveDemo: (p: string) => string | undefined): string {
  const source = resolveDemo(relPath);
  if (!source) return `<!-- demo source not found: ${relPath} -->`;
  const script = extractDemoScript(source);
  if (!script) return `<!-- demo has no <script> block: ${relPath} -->`;
  // Prefix the block with the demo's filename so an agent reading the inlined
  // code knows which `.astro` demo source it represents (provenance hint).
  const fileName = relPath.split(/[\\/]/).pop() ?? relPath;
  return '```ts\n// ' + fileName + '\n' + script + '\n```';
}

// #endregion

// #region Link rewriting

/**
 * Rewrite an internal docs link from its HTML (trailing-slash) form to the `.md`
 * companion, preserving any `#anchor` / `?query` suffix — but only when the
 * target actually has a generated `.md` page (per `hasDoc`). External links,
 * anchors, and unknown paths are returned unchanged.
 */
function rewriteDocLink(url: string, hasDoc?: (slug: string) => boolean): string {
  if (!hasDoc || !url.startsWith('/')) return url; // external, relative, or no predicate
  const suffixStart = url.search(/[#?]/);
  const path = suffixStart === -1 ? url : url.slice(0, suffixStart);
  const suffix = suffixStart === -1 ? '' : url.slice(suffixStart);
  // Slug is the lowercase path without leading/trailing slashes (matches keyToSlug).
  const slug = path.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
  if (!slug || !hasDoc(slug)) return url;
  return '/' + slug + '.md' + suffix;
}

// #endregion

// #region Transform

/**
 * Convert raw MDX source into agent-friendly Markdown.
 *
 * - Strips ESM `import` lines and MDX expression comments.
 * - Inlines `<ShowSource file="…">` and bare demo components as ```ts blocks.
 * - Flattens Starlight `<Tabs>` / `<TabItem label="…">` into `####` headings.
 * - Leaves remaining directive syntax (`:::tip`) in place — agents tolerate it
 *   and it carries structure; aggressive flattening is deferred.
 */
export function mdxToAgentMarkdown(raw: string, opts: AgentMarkdownOptions): string {
  const { data, body } = splitFrontmatter(raw);

  // Split into fenced-code vs prose segments. ALL stripping/replacement runs on
  // prose only — example `import` lines inside ```code``` fences are real,
  // copy-ready guidance for the agent and MUST be preserved verbatim.
  const segments = body.split(/(```[\s\S]*?```)/g);
  const isFence = (s: string) => s.startsWith('```');

  // 1. Map imported demo component names → their `.astro` path (prose only).
  const componentToDemo = new Map<string, string>();
  const importRe = /^import\s+(\w+)\s+from\s+['"]([^'"]+\.astro)['"];?\s*$/gm;
  for (const seg of segments) {
    if (isFence(seg)) continue;
    for (let m = importRe.exec(seg); m; m = importRe.exec(seg)) {
      componentToDemo.set(m[1], m[2]);
    }
  }

  const transformed = segments.map((seg) => {
    if (isFence(seg)) return seg; // leave code blocks untouched

    let out = seg;
    // 2. Drop ESM import lines and MDX comments.
    out = out.replace(/^import\s+.*$/gm, '');
    out = out.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

    // 2b. Flatten Starlight `<Tabs>` / `<TabItem label="…">` into `####` headings.
    //     Tabs render as interactive widgets in HTML but add noise in plain
    //     Markdown; the tab label is the only meaningful structure, so promote it
    //     to a heading and drop the wrapper tags.
    out = out.replace(/<TabItem\b[^>]*\blabel=["']([^"']+)["'][^>]*>/g, (_full, label: string) => `\n#### ${label}\n`);
    out = out.replace(/<\/TabItem>/g, '');
    out = out.replace(/<Tabs\b[^>]*>/g, '');
    out = out.replace(/<\/Tabs>/g, '');

    // 3. Inline `<ShowSource file="…"> … </ShowSource>` blocks first (the `file`
    //    attribute points directly at the demo, and its children are the same
    //    demo component, so replacing the whole block avoids duplicate code).
    out = out.replace(
      /<ShowSource\b[^>]*\bfile=["']([^"']+)["'][^>]*>[\s\S]*?<\/ShowSource>/g,
      (_full, file: string) => '\n' + demoCodeBlock(file, opts.resolveDemo) + '\n',
    );

    // 4. Inline remaining standalone demo components (`<IntroBasicDemo />` or
    //    `<IntroBasicDemo>…</IntroBasicDemo>`).
    for (const [name, demoPath] of componentToDemo) {
      const selfClosing = new RegExp(`<${name}\\b[^>]*/>`, 'g');
      const paired = new RegExp(`<${name}\\b[^>]*>[\\s\\S]*?</${name}>`, 'g');
      const block = '\n' + demoCodeBlock(demoPath, opts.resolveDemo) + '\n';
      out = out.replace(paired, block).replace(selfClosing, block);
    }

    // 5. Rewrite internal doc links from their HTML form to the `.md` companion
    //    so agents keep navigating the markdown graph. Match only the `](url)`
    //    tail (not the link text) so labels containing brackets — e.g.
    //    `[`ColumnConfig[]`](…)` — still rewrite. `hasDoc` gates out images and
    //    any non-doc path, so matching bare `](…)` is safe.
    out = out.replace(/\]\((\/[^)\s]+)\)/g, (full, url: string) => {
      const rewritten = rewriteDocLink(url, opts.hasDoc);
      return rewritten === url ? full : `](${rewritten})`;
    });
    return out;
  });

  // 6. Rejoin and collapse the blank lines left behind by stripped content.
  //    Normalise whitespace-only lines first (stripped wrapper tags were often
  //    indented, leaving lines of stray spaces) so the blank-line collapse works.
  const out = transformed
    .join('')
    .replace(/^[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 7. Prepend a title heading + description so the page is self-describing.
  const header: string[] = [];
  if (data.title) header.push(`# ${data.title}`);
  if (data.description) header.push(`> ${data.description}`);
  return (header.length ? header.join('\n\n') + '\n\n' : '') + out + '\n';
}

// #endregion
