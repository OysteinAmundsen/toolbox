/**
 * Prove a test actually guards a fix — `qa` / `qa-pr` skills.
 *
 * Optionally runs the spec on the current source (must pass), then swaps ONE exact text
 * occurrence in a source file for the old/broken version, re-runs the spec (must FAIL), and
 * restores the original bytes — verified byte-for-byte, so CRLF/BOM never drift (PowerShell
 * `Set-Content` re-encodes and breaks the restore; see testing-patterns "Prove a regression test").
 *
 * Usage (from repo root):
 *   bun .github/skills/qa/scripts/mutation-check.ts --file <source.ts> --spec <nx test filter> \
 *     (--find <text> --replace <text> | --find-file <a.txt> --replace-file <b.txt>) \
 *     [--project grid] [--no-baseline]
 *
 * Exit 0 = mutant killed (the spec failed on the broken source). Exit 1 = mutant SURVIVED
 * (the spec does not guard the fix) or the baseline was red. Exit 2 = bad arguments, or the
 * `--spec` filter (space-separated patterns allowed) matched no test file.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fail, parseArgs, runNxTest, testSummary } from './lib';

const args = parseArgs();
const file = typeof args.file === 'string' ? args.file : fail('Missing --file <source>');
const spec = typeof args.spec === 'string' ? args.spec : fail('Missing --spec <filter>');
const project = typeof args.project === 'string' ? args.project : 'grid';
const read = (flag: string, fileFlag: string): string => {
  if (typeof args[flag] === 'string') return args[flag] as string;
  if (typeof args[fileFlag] === 'string') return readFileSync(args[fileFlag] as string, 'utf8');
  return fail(`Missing --${flag} or --${fileFlag}`);
};
const original = readFileSync(file);
const text = original.toString('utf8');
// Working trees here are CRLF (core.autocrlf=true); let multi-line --find/--replace use plain \n.
const toFileEol = (s: string): string => (text.includes('\r\n') && !s.includes('\r\n') ? s.replace(/\n/g, '\r\n') : s);
const find = toFileEol(read('find', 'find-file'));
const replace = toFileEol(read('replace', 'replace-file'));
const hits = text.split(find).length - 1;
if (hits !== 1) fail(`--find must match exactly once in ${file} (matched ${hits})`);
const failIfNoTestFiles = (output: string) => {
  if (/No test files found/.test(output)) fail(`--spec "${spec}" matched no test files — nothing was tested`);
};

if (!args['no-baseline']) {
  const base = runNxTest(project, spec);
  console.log('BASELINE (current source):');
  for (const l of testSummary(base.output)) console.log(`  ${l}`);
  failIfNoTestFiles(base.output);
  if (base.code !== 0) {
    console.log('Baseline is red — fix the spec before judging the mutant.');
    process.exit(1);
  }
}

let mutant: { code: number; output: string };
writeFileSync(file, text.replace(find, replace));
try {
  mutant = runNxTest(project, spec);
} finally {
  writeFileSync(file, original);
}
if (!readFileSync(file).equals(original)) fail(`RESTORE FAILED — ${file} differs from the original bytes`);

console.log('MUTANT (broken source):');
for (const l of testSummary(mutant.output)) console.log(`  ${l}`);
failIfNoTestFiles(mutant.output);
if (mutant.code === 0) {
  console.log('SURVIVED — the spec passes on the broken source, so it does not guard the fix.');
  process.exit(1);
}
console.log(`KILLED — ${file} restored byte-for-byte.`);
