/**
 * Summarise fallow JSON outputs for one path prefix (default `libs/`).
 *
 * Usage (from repo root):
 *   bunx fallow health --score --targets --hotspots --complexity --min-severity high --top 150 --format json --quiet > tmp/fallow-health.json
 *   bunx fallow dead-code --format json --quiet > tmp/fallow-deadcode.json
 *   bunx fallow dupes --skip-local --format json --quiet > tmp/fallow-dupes.json
 *   bun .github/skills/fallow/scripts/summarize.ts [--scope libs/] [--dir tmp] [--top 60]
 *
 * Missing input files are skipped. Never pipe fallow output through `tail`/`head`
 * on this workspace (see copilot-instructions) — write to a file, then run this.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Json = Record<string, unknown>;
const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const scope = arg('--scope', 'libs/').replace(/\\/g, '/');
const dir = arg('--dir', 'tmp');
const top = Number(arg('--top', '60'));

const inScope = (f: unknown): boolean => typeof f === 'string' && f.replace(/\\/g, '/').startsWith(scope);
const isTestFile = (f: string): boolean => /\.(spec|bench)\.tsx?$/.test(f);
const load = (name: string): Json | null => {
  const p = join(dir, name);
  if (!existsSync(p)) {
    console.log(`(skip) ${p} not found`);
    return null;
  }
  return JSON.parse(readFileSync(p, 'utf8')) as Json;
};
const pad = (v: unknown, n: number) => String(v ?? '').padEnd(n);

// ---- health (needs --complexity for per-function findings) ----
const health = load('fallow-health.json');
if (health) {
  const summary = health.summary as Json | undefined;
  // fallow ≥2.x emits `health_score`; `summary.score` is the older location. Both need `--score`.
  const hs = (health.health_score as Json | undefined) ?? { score: summary?.score, grade: summary?.grade };
  console.log(
    `\n== HEALTH  score=${hs.score ?? '? (run with --score)'} grade=${hs.grade ?? '?'}  penalties=${JSON.stringify(hs.penalties ?? {})}`,
  );
  const findings = ((health.findings as Json[] | undefined) ?? []).filter((x) => inScope(x.path ?? x.file));
  findings.sort((a, b) => Number(b.crap ?? 0) - Number(a.crap ?? 0));
  console.log(
    `-- per-function findings in ${scope}: ${findings.length} (sorted by CRAP; coverage_model=${summary?.coverage_model})`,
  );
  for (const f of findings.slice(0, top)) {
    console.log(
      `${pad(f.severity, 9)} crap=${pad(f.crap, 6)} cc=${pad(f.cyclomatic, 3)} cog=${pad(f.cognitive, 3)} cov=${pad(f.coverage_tier, 8)} ${f.path ?? f.file}:${f.line} ${f.name ?? f.function ?? ''}`,
    );
  }
  const targets = ((health.targets as Json[] | undefined) ?? []).filter((x) => inScope(x.path));
  console.log(`-- refactor targets in ${scope}: ${targets.length}`);
  for (const t of targets.slice(0, 25))
    console.log(`  p=${pad(t.priority, 5)} ${pad(t.category, 26)} ${t.path} — ${t.recommendation}`);
  const hot = ((health.hotspots as Json[] | undefined) ?? []).filter((x) => inScope(x.path));
  console.log(`-- hotspots in ${scope}: ${hot.length}`);
  for (const h of hot.slice(0, 15))
    console.log(`  score=${pad(h.score, 5)} commits=${pad(h.commits, 3)} trend=${pad(h.trend, 12)} ${h.path}`);
}

// ---- dead code ----
const dead = load('fallow-deadcode.json');
if (dead) {
  console.log(`\n== DEAD CODE  total_issues=${dead.total_issues}`);
  for (const [k, v] of Object.entries(dead)) {
    if (!Array.isArray(v) || v.length === 0) continue;
    const scoped = (v as Json[]).filter((x) => inScope(x.path ?? x.file ?? x.from));
    if (scoped.length === 0) continue;
    console.log(`-- ${k}: total=${v.length} in-scope=${scoped.length}`);
    for (const x of scoped.slice(0, top)) {
      const name = x.export_name ?? x.member_name ?? x.input_name ?? x.output_name ?? x.prop_name ?? '';
      const parent = x.parent_name ? `${x.parent_name}.` : '';
      console.log(`  ${x.path ?? x.file}:${x.line ?? ''} ${parent}${name}`);
    }
  }
  console.log(
    'NOTE: fallow is syntactic — verify class-member/export hits against docs + `this.#manager.x()` call sites before deleting.',
  );
}

// ---- dupes ----
const dupes = load('fallow-dupes.json');
if (dupes) {
  const stats = dupes.stats as Json | undefined;
  console.log(
    `\n== DUPES  duplication=${Number(stats?.duplication_percentage ?? 0).toFixed(1)}% groups=${stats?.clone_groups}`,
  );
  type Inst = { file: string; start_line: number; end_line: number };
  const groups = ((dupes.clone_groups as Array<{ instances: Inst[] }> | undefined) ?? []).filter(
    (g) => g.instances.every((i) => inScope(i.file)) && !g.instances.every((i) => isTestFile(i.file)),
  );
  const span = (g: { instances: Inst[] }) => g.instances[0].end_line - g.instances[0].start_line + 1;
  groups.sort((a, b) => span(b) - span(a));
  console.log(`-- non-test clone groups in ${scope}: ${groups.length}`);
  for (const g of groups.slice(0, top)) {
    console.log(`  lines=${span(g)} x${g.instances.length}`);
    for (const i of g.instances) console.log(`     ${i.file}:${i.start_line}-${i.end_line}`);
  }
}
