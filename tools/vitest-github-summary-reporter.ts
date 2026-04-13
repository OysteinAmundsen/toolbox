import { writeFileSync } from 'node:fs';

/**
 * Custom Vitest reporter that generates a GitHub Actions job summary
 * with the project name in the heading (e.g. "grid - Vitest Test Report").
 *
 * Use this alongside `['github-actions', { jobSummary: { enabled: false } }]`
 * to replace the default anonymous "Vitest Test Report" heading.
 */
export default class GitHubProjectSummaryReporter {
  private ctx!: { config: { name?: string } };

  onInit(ctx: { config: { name?: string } }) {
    this.ctx = ctx;
  }

  onTestRunEnd(testModules: TestModule[]) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) return;

    const name = this.ctx?.config?.name ?? 'Vitest';
    const stats = collectStats(testModules);

    const summary = renderSummary(name, stats);
    try {
      writeFileSync(summaryPath, summary, { flag: 'a' });
    } catch {
      /* ignore — not in CI or path unavailable */
    }
  }
}

// #region ---- Stat collection (mirrors vitest internals) ----

interface Stats {
  filesPassed: number;
  filesFailed: number;
  filesTotal: number;
  testsPassed: number;
  testsFailed: number;
  testsSkipped: number;
  testsTodo: number;
  testsTotal: number;
}

interface TestModule {
  task: { result?: { state: string } };
  children: {
    allTests(): Iterable<{
      task: { mode: string; result?: { state: string }; fails?: boolean };
    }>;
  };
}

function collectStats(testModules: TestModule[]): Stats {
  const s: Stats = {
    filesPassed: 0,
    filesFailed: 0,
    filesTotal: testModules.length,
    testsPassed: 0,
    testsFailed: 0,
    testsSkipped: 0,
    testsTodo: 0,
    testsTotal: 0,
  };

  for (const mod of testModules) {
    if (mod.task.result?.state === 'fail') s.filesFailed++;
    else if (mod.task.result?.state === 'pass') s.filesPassed++;

    for (const test of mod.children.allTests()) {
      s.testsTotal++;
      if (test.task.mode === 'skip') {
        s.testsSkipped++;
      } else if (test.task.mode === 'todo') {
        s.testsTodo++;
      } else if (test.task.result?.state === 'fail') {
        s.testsFailed++;
      } else if (test.task.result?.state === 'pass') {
        s.testsPassed++;
      }
    }
  }

  return s;
}

// #endregion

// #region ---- Markdown rendering ----

const SEP = ' · ';

function noun(n: number, singular: string, plural: string) {
  return n === 1 ? singular : plural;
}

function renderSummary(projectName: string, s: Stats): string {
  const fileInfo: string[] = [];
  if (s.filesFailed > 0) fileInfo.push(`❌ **${s.filesFailed} ${noun(s.filesFailed, 'failure', 'failures')}**`);
  if (s.filesPassed > 0) fileInfo.push(`✅ **${s.filesPassed} ${noun(s.filesPassed, 'pass', 'passes')}**`);
  fileInfo.push(`${s.filesTotal} total`);

  const testInfo: string[] = [];
  if (s.testsFailed > 0) testInfo.push(`❌ **${s.testsFailed} ${noun(s.testsFailed, 'failure', 'failures')}**`);
  if (s.testsPassed > 0) testInfo.push(`✅ **${s.testsPassed} ${noun(s.testsPassed, 'pass', 'passes')}**`);
  testInfo.push(`${s.testsTotal} total`);

  let md = `## ${projectName} - Vitest Test Report\n\n### Summary\n\n`;
  md += `- **Test Files**: ${fileInfo.join(SEP)}\n`;
  md += `- **Test Results**: ${testInfo.join(SEP)}\n`;

  const otherInfo: string[] = [];
  if (s.testsSkipped > 0) otherInfo.push(`${s.testsSkipped} ${noun(s.testsSkipped, 'skip', 'skips')}`);
  if (s.testsTodo > 0) otherInfo.push(`${s.testsTodo} ${noun(s.testsTodo, 'todo', 'todos')}`);
  if (otherInfo.length > 0) {
    otherInfo.push(`${s.testsSkipped + s.testsTodo} total`);
    md += `- **Other**: ${otherInfo.join(SEP)}\n`;
  }

  return md + '\n';
}

// #endregion
