/**
 * _docs-fences.spec.ts — Structural guard over every authored docs page.
 *
 * WHY this exists: `architecture.mdx` once shipped a ```css block whose closing
 * fence was missing. Astro/MDX rendered it without complaint, so nothing failed —
 * but the next fence in the file silently became the *closer*, swallowing a `---`
 * rule, a `## DOM Structure` heading, and a 28-line DOM example into the code
 * block. That corruption then propagated into every generated agent corpus
 * (`llms-full*.txt`), where an entire documented section simply vanished.
 *
 * A naive "count the ``` markers and check for an even number" test does NOT catch
 * this: the swallowed block still contains its own fence lines, so the total stays
 * even. The reliable signal is that a *correctly* fenced block never contains a
 * markdown heading, a `:::` directive, or a nested fence carrying an info string.
 * If it does, the fence pairing has drifted.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const CONTENT_ROOT = join(import.meta.dirname, '..', 'content', 'docs');

/**
 * TypeDoc output directories. They are generated on every `bun nx typedoc grid`
 * run and gitignored, so they are not authored content and must not gate the
 * build (a machine-generated page cannot be hand-fixed anyway).
 */
const GENERATED_DIRS = /^(api|Classes|Interfaces|Functions|Types|Enums|Variables|Enumerations)$/;

function collectDocs(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!GENERATED_DIRS.test(entry.name)) collectDocs(full, out);
    } else if (/\.mdx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

interface FenceProblem {
  file: string;
  detail: string;
}

/**
 * Walk a document's lines tracking fence state, and report any block that is
 * either never closed or that swallows markdown it should not contain.
 *
 * Fence rules follow CommonMark closely enough for our content: a fence opens on
 * a line of 3+ backticks indented at most 3 spaces, and closes on a line of at
 * least as many backticks with an EMPTY info string. Shell comments (`# foo`)
 * inside a block are legitimate, so headings only count as swallowed when the
 * block's language is not a shell dialect.
 */
function findFenceProblems(file: string, source: string): FenceProblem[] {
  const problems: FenceProblem[] = [];
  const lines = source.split('\n');
  let open: { line: number; ticks: number; info: string; swallowed: string[] } | null = null;
  let frontmatterDelimiters = 0;

  lines.forEach((line, i) => {
    // Frontmatter `---` delimiters are not horizontal rules; skip the leading pair.
    if (!open && frontmatterDelimiters < 2 && /^---\s*$/.test(line) && i < 40) {
      frontmatterDelimiters++;
      return;
    }

    const fence = line.match(/^ {0,3}(`{3,})(.*)$/);
    if (fence) {
      const ticks = fence[1].length;
      const info = fence[2].trim();
      if (!open) {
        open = { line: i + 1, ticks, info, swallowed: [] };
      } else if (ticks >= open.ticks && info === '') {
        if (open.swallowed.length > 0) {
          problems.push({
            file,
            detail:
              `\`\`\`${open.info || '(bare)'} opened at line ${open.line} and closed at line ${i + 1}, ` +
              `swallowing ${open.swallowed.length} markdown construct(s) — the opening fence is probably ` +
              `missing its closer. First: ${open.swallowed[0]}`,
          });
        }
        open = null;
      } else if (info !== '') {
        // A fence WITH an info string cannot close a block; seeing one here means
        // the enclosing block never got its own closer.
        open.swallowed.push(`line ${i + 1}: ${line.trim()}`);
      }
      return;
    }

    if (!open) return;
    const isShell = /^(bash|sh|shell|zsh|console|powershell|ps1|ini|toml|yaml|yml|python|py|makefile|diff)$/i.test(
      open.info.split(/\s+/)[0] ?? '',
    );
    if (!isShell && /^#{1,6}\s/.test(line)) open.swallowed.push(`line ${i + 1}: ${line.trim()}`);
    if (/^:::/.test(line)) open.swallowed.push(`line ${i + 1}: ${line.trim()}`);
  });

  if (open) {
    const unclosed: { line: number; info: string } = open;
    problems.push({
      file,
      detail: `\`\`\`${unclosed.info || '(bare)'} opened at line ${unclosed.line} is never closed.`,
    });
  }
  return problems;
}

describe('authored docs code fences', () => {
  const files = collectDocs(CONTENT_ROOT);

  it('finds authored documentation pages to check', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('has no unclosed fence and no fence that swallows headings or directives', () => {
    const problems = files.flatMap((file) =>
      findFenceProblems(relative(CONTENT_ROOT, file), readFileSync(file, 'utf8')),
    );
    expect(problems.map((p) => `${p.file.replace(/\\/g, '/')}: ${p.detail}`)).toEqual([]);
  });

  // Guard the guard: these fixtures reproduce the real `architecture.mdx` defect
  // and the false positives it must tolerate.
  it('flags a fence whose missing closer swallows a heading', () => {
    const broken = ['```css', 'tbw-grid { --x: 1; }', '', '## DOM Structure', '', '```html', '<div></div>', '```'].join(
      '\n',
    );
    expect(findFenceProblems('x.mdx', broken)).toHaveLength(1);
  });

  it('flags a fence that is never closed at all', () => {
    expect(findFenceProblems('x.mdx', '```ts\nconst a = 1;\n')).toHaveLength(1);
  });

  it('accepts correctly paired fences and shell comments', () => {
    const fine = [
      '```bash',
      '# Install both packages',
      'bun add pkg',
      '```',
      '',
      '## Next',
      '',
      '```ts',
      'x',
      '```',
    ].join('\n');
    expect(findFenceProblems('x.mdx', fine)).toEqual([]);
  });
});
