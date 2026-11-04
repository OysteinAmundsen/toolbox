/**
 * Shared helpers for the `qa` skill scripts (probe, mutation-check, spec-typecheck).
 * Zero dependencies; run under Bun from the repo root.
 */
import { spawnSync } from 'node:child_process';

/** Parse `--name value` style flags; boolean flags (`--keep`) map to `true`. */
export function parseArgs(argv = process.argv.slice(2)): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key.slice(2)] = true;
    else out[key.slice(2)] = argv[++i];
  }
  return out;
}

/** Remove ANSI colour codes — Nx and tsc colour their output, which defeats line matching. */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
export const stripAnsi = (s: string): string => s.replace(ANSI, '');

/** Run a Bun-resolved command (`bun <args>`) and return combined, ANSI-stripped output. */
export function runBun(args: string[]): { code: number; output: string } {
  const res = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { code: res.status ?? 1, output: stripAnsi(`${res.stdout ?? ''}\n${res.stderr ?? ''}`) };
}

/** `bun nx test <project> <filter>` with static output so Vitest results are not swallowed. */
export function runNxTest(project: string, filter: string): { code: number; output: string } {
  return runBun(['nx', 'test', project, filter, '--output-style=static']);
}

/** Lines worth showing from a Vitest run: failures, assertion messages and the totals. */
export function testSummary(output: string): string[] {
  return output
    .split(/\r?\n/)
    .filter((l) => /^\s+×|FAIL\s|AssertionError|Error:|Test Files|Tests\s{2}/.test(l))
    .map((l) => l.trimEnd());
}

export function fail(message: string): never {
  console.error(message);
  process.exit(2);
}
