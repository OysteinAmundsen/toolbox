import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { writeFileSync } from 'node:fs';

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;

/** Strip ANSI escape codes — markdown summaries cannot render them. */
function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, '');
}

/**
 * GitHub Actions Job Summary reporter for Playwright.
 *
 * Generates a compact Vitest-style summary (test file counts, pass/fail/skip)
 * and writes it to `$GITHUB_STEP_SUMMARY`. Optionally includes a table of
 * failed tests.
 *
 * Usage in playwright.config.ts:
 *   reporter: [['./reporters/github-summary-reporter.ts', { title: 'E2E Tests' }]]
 */

interface Options {
  /** Heading text for the summary section. Default: "E2E Test Report" */
  title?: string;
}

interface FileStats {
  file: string;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number;
  failures: { name: string; error: string }[];
}

class GitHubSummaryReporter implements Reporter {
  private title: string;
  private files = new Map<string, FileStats>();

  constructor(options: Options = {}) {
    this.title = options.title ?? 'E2E Test Report';
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const file = test.location.file.replace(/.*[\\/]tests[\\/]/, '');
    if (!this.files.has(file)) {
      this.files.set(file, { file, passed: 0, failed: 0, skipped: 0, total: 0, duration: 0, failures: [] });
    }
    const stats = this.files.get(file);
    if (!stats) return;
    stats.total++;
    stats.duration += result.duration;

    if (result.status === 'passed') {
      stats.passed++;
    } else if (result.status === 'failed' || result.status === 'timedOut') {
      stats.failed++;
      const fullName = test.titlePath().slice(1).join(' > ');
      const errorMsg = result.errors.map((e) => stripAnsi(e.message?.split('\n')[0] ?? '')).join('; ');
      stats.failures.push({ name: fullName, error: errorMsg });
    } else if (result.status === 'skipped') {
      stats.skipped++;
    }
  }

  onEnd(): void {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) return;

    const allFiles = [...this.files.values()];
    const totalFiles = allFiles.length;
    const filesPassed = allFiles.filter((f) => f.failed === 0).length;
    const filesFailed = allFiles.filter((f) => f.failed > 0).length;

    const totalTests = allFiles.reduce((s, f) => s + f.total, 0);
    const totalPassed = allFiles.reduce((s, f) => s + f.passed, 0);
    const totalFailed = allFiles.reduce((s, f) => s + f.failed, 0);
    const totalSkipped = allFiles.reduce((s, f) => s + f.skipped, 0);
    const totalDuration = allFiles.reduce((s, f) => s + f.duration, 0);

    const SEP = ' · ';

    // Header
    let md = `## ${this.title}\n\n`;

    // Summary stats
    const fileInfo: string[] = [];
    if (filesFailed > 0) fileInfo.push(`❌ **${filesFailed} ${noun(filesFailed, 'failure', 'failures')}**`);
    if (filesPassed > 0) fileInfo.push(`✅ **${filesPassed} ${noun(filesPassed, 'pass', 'passes')}**`);
    fileInfo.push(`${totalFiles} total`);

    const testInfo: string[] = [];
    if (totalFailed > 0) testInfo.push(`❌ **${totalFailed} ${noun(totalFailed, 'failure', 'failures')}**`);
    if (totalPassed > 0) testInfo.push(`✅ **${totalPassed} ${noun(totalPassed, 'pass', 'passes')}**`);
    testInfo.push(`${totalTests} total`);

    md += `### Summary\n\n`;
    md += `- **Test Files**: ${fileInfo.join(SEP)}\n`;
    md += `- **Test Results**: ${testInfo.join(SEP)}\n`;

    if (totalSkipped > 0) {
      md += `- **Other**: ${totalSkipped} ${noun(totalSkipped, 'skip', 'skips')} · ${totalSkipped} total\n`;
    }

    md += `- **Duration**: ${formatDuration(totalDuration)}\n`;

    // Failed tests details
    const allFailures = allFiles.flatMap((f) => f.failures.map((fail) => ({ ...fail, file: f.file })));
    if (allFailures.length > 0) {
      md += `\n### Failed Tests\n\n`;
      md += `| Test | Error |\n|------|-------|\n`;
      for (const f of allFailures) {
        const escapedError = f.error.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 120);
        md += `| ${f.name} | ${escapedError} |\n`;
      }
    }

    md += '\n';

    try {
      writeFileSync(summaryPath, md, { flag: 'a' });
    } catch {
      /* not in CI */
    }
  }
}

function noun(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
}

export default GitHubSummaryReporter;
