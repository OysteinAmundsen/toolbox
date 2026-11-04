/**
 * Run a throwaway integration probe and clean it up — `qa` skill, "Prove, don't argue".
 *
 * Copies an existing spec (for its imports, fixtures and helpers), turns every top-level
 * `describe(` / `describe.each(` into a skipped one, appends your probe body, runs it via Nx,
 * prints the `PROBE` lines plus any failures, and deletes the probe file (unless `--keep`).
 *
 * Usage (from repo root):
 *   bun .github/skills/qa/scripts/probe.ts --body tmp/probe-body.ts \
 *     [--from libs/grid/src/__tests__/integration/foo.spec.ts] [--name pivot-window] \
 *     [--project grid] [--keep]
 *
 * `--body` is a file with one or more `describe`/`it` blocks that `console.log('PROBE …')` the
 * measured values. Without `--from`, the body must be a complete spec (own imports) and is
 * written to `libs/grid/src/__tests__/integration/`.
 *
 * Measure the change AND a control (same probe without the changed plugin/flag) so a
 * pre-existing defect is not blamed on the diff. Exit code = the Vitest exit code.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fail, parseArgs, runNxTest, testSummary } from './lib';

const args = parseArgs();
const bodyPath = typeof args.body === 'string' ? args.body : fail('Missing --body <file>');
const from = typeof args.from === 'string' ? args.from : undefined;
const name = typeof args.name === 'string' ? args.name : 'adhoc';
const project = typeof args.project === 'string' ? args.project : 'grid';

if (!existsSync(bodyPath)) fail(`Body file not found: ${bodyPath}`);
if (from && !existsSync(from)) fail(`--from spec not found: ${from}`);

const body = readFileSync(bodyPath, 'utf8');
let source = '';
if (from) {
  const raw = readFileSync(from, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  source =
    raw.replace(/^describe\.each\(/gm, 'describe.skip.each(').replace(/^describe\(/gm, 'describe.skip(') + eol + eol;
}

const dir = from ? dirname(from) : 'libs/grid/src/__tests__/integration';
const probeFile = join(dir, `zz-probe-${name}.spec.ts`);
if (existsSync(probeFile)) fail(`Refusing to overwrite existing ${probeFile}`);

writeFileSync(probeFile, source + body);
let code = 1;
try {
  const res = runNxTest(project, `zz-probe-${name}`);
  code = res.code;
  const lines = res.output.split(/\r?\n/).filter((l) => l.includes('PROBE'));
  console.log(lines.length ? lines.join('\n') : '(no PROBE lines — did the body console.log them?)');
  for (const l of testSummary(res.output)) console.log(l);
} finally {
  if (args.keep) console.log(`kept ${probeFile}`);
  else rmSync(probeFile, { force: true });
}
process.exit(code);
