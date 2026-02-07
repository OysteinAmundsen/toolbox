import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

interface TestEntry {
  test: TestCase;
  result: TestResult;
  testName: string;
  duration: number;
}

interface TestGroup {
  tests: TestEntry[];
  expectedCount: number;
  passed: number;
  failed: number;
  skipped: number;
  totalDuration: number;
  printed: boolean;
  parent: string | null;
  children: Set<string>;
}

/**
 * Clean List Reporter - A Vitest-style Playwright reporter that groups tests
 * by describe block, outputs in real-time as groups complete, and expands
 * groups with failures.
 *
 * Output format (all pass):
 *   ✓ Test Suite (5 tests) (1.2s)
 *
 * Output format (with failures - hierarchical):
 *   ✓ Cross-Framework Functional Parity
 *     ✓ react Demo (4 tests) (7.3s)
 *     ✗ vue Demo (12.6s)
 *       ✓ name of test that passes (6.5s)
 *       ✗ name of test that fails (6.1s)
 *
 * Failed tests show error details at the end.
 */
export default class CleanListReporter implements Reporter {
  private groups = new Map<string, TestGroup>();
  private topLevelGroups: string[] = [];
  private passed = 0;
  private failed = 0;
  private skipped = 0;
  private startTime = 0;
  private failedTests: Array<{ test: TestCase; result: TestResult; fullPath: string }> = [];
  private totalTests = 0;
  private completedTests = 0;
  private activeGroups = new Set<string>();
  private progressShown = false;

  // ANSI color codes
  private readonly red = '\x1b[31m';
  private readonly green = '\x1b[32m';
  private readonly yellow = '\x1b[33m';
  private readonly cyan = '\x1b[36m';
  private readonly dim = '\x1b[2m';
  private readonly reset = '\x1b[0m';

  // Browser names to filter out
  private readonly browsers = new Set(['chromium', 'firefox', 'webkit', 'Mobile Chrome', 'Mobile Safari']);

  onBegin(_config: FullConfig, suite: Suite): void {
    this.startTime = Date.now();
    this.groups.clear();
    this.topLevelGroups = [];
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
    this.failedTests = [];
    this.totalTests = 0;
    this.completedTests = 0;
    this.activeGroups.clear();
    this.progressShown = false;

    // Walk the suite tree to count expected tests per group
    this.walkSuite(suite);

    // Count total tests
    for (const groupPath of this.topLevelGroups) {
      const group = this.groups.get(groupPath);
      if (group) this.totalTests += group.expectedCount;
    }
  }

  private walkSuite(suite: Suite): void {
    for (const test of suite.tests) {
      const titleParts = this.getFilteredTitlePath(test);
      // Register this test in all ancestor groups
      for (let i = 1; i < titleParts.length; i++) {
        const groupPath = titleParts.slice(0, i).join(' › ');
        const parentPath = i > 1 ? titleParts.slice(0, i - 1).join(' › ') : null;

        if (!this.groups.has(groupPath)) {
          this.groups.set(groupPath, {
            tests: [],
            expectedCount: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            totalDuration: 0,
            printed: false,
            parent: parentPath,
            children: new Set(),
          });
          if (!parentPath) {
            this.topLevelGroups.push(groupPath);
          } else {
            this.groups.get(parentPath)?.children.add(groupPath);
          }
        }
        this.groups.get(groupPath)!.expectedCount++;
      }
    }
    for (const child of suite.suites) {
      this.walkSuite(child);
    }
  }

  private getFilteredTitlePath(test: TestCase): string[] {
    return test
      .titlePath()
      .filter(
        (part) =>
          part && part.trim() && !this.browsers.has(part) && !part.endsWith('.spec.ts') && !part.endsWith('.test.ts'),
      );
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const titleParts = this.getFilteredTitlePath(test);
    const testName = titleParts[titleParts.length - 1] || 'unnamed test';
    const fullPath = titleParts.join(' › ');

    // Track global stats
    switch (result.status) {
      case 'passed':
        this.passed++;
        break;
      case 'failed':
      case 'timedOut':
        this.failed++;
        this.failedTests.push({ test, result, fullPath });
        break;
      case 'skipped':
        this.skipped++;
        break;
    }

    // Track completed tests and active groups
    this.completedTests++;
    const topLevelGroup = titleParts[0];
    if (topLevelGroup) {
      this.activeGroups.add(topLevelGroup);
    }

    // Update all ancestor groups
    for (let i = 1; i < titleParts.length; i++) {
      const groupPath = titleParts.slice(0, i).join(' › ');
      const group = this.groups.get(groupPath);
      if (!group) continue;

      // Only add test entry to immediate parent group
      if (i === titleParts.length - 1) {
        group.tests.push({ test, result, testName, duration: result.duration });
      }
      group.totalDuration += result.duration;

      switch (result.status) {
        case 'passed':
          group.passed++;
          break;
        case 'failed':
        case 'timedOut':
          group.failed++;
          break;
        case 'skipped':
          group.skipped++;
          break;
      }
    }

    // Check if any top-level group is now complete and can be printed
    this.tryPrintCompletedGroups();

    // Show progress for incomplete groups
    this.showProgress();
  }

  private showProgress(): void {
    // Find groups still in progress
    const inProgress: string[] = [];
    for (const groupPath of this.topLevelGroups) {
      const group = this.groups.get(groupPath);
      if (!group || group.printed) continue;
      const completed = group.passed + group.failed + group.skipped;
      if (completed > 0 && completed < group.expectedCount) {
        inProgress.push(`${groupPath.split(' › ')[0]} ${completed}/${group.expectedCount}`);
      }
    }

    if (inProgress.length > 0) {
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);
      let progress = `  ${this.dim}Running: ${inProgress.join(', ')} (${elapsed}s)${this.reset}`;

      // Truncate to terminal width to prevent line wrapping (which breaks \r overwrite)
      const termWidth = process.stdout.columns || 80;
      const ansiLength = this.dim.length + this.reset.length; // ANSI codes don't take visual space
      const maxVisibleLength = termWidth - 1; // Leave 1 char margin
      const visibleLength = progress.length - ansiLength;

      if (visibleLength > maxVisibleLength) {
        // Truncate content and add ellipsis
        const content = `  Running: ${inProgress.join(', ')} (${elapsed}s)`;
        const truncated = content.slice(0, maxVisibleLength - 3) + '...';
        progress = `${this.dim}${truncated}${this.reset}`;
      }

      // Clear line and write progress
      process.stdout.write(`\r\x1b[K${progress}`);
      this.progressShown = true;
    }
  }

  private clearProgress(): void {
    if (this.progressShown) {
      process.stdout.write('\r\x1b[K');
      this.progressShown = false;
    }
  }

  private tryPrintCompletedGroups(): void {
    for (const groupPath of this.topLevelGroups) {
      const group = this.groups.get(groupPath);
      if (!group || group.printed) continue;

      const completedCount = group.passed + group.failed + group.skipped;
      if (completedCount >= group.expectedCount) {
        this.clearProgress();
        this.printGroup(groupPath, 0);
        group.printed = true;
        this.activeGroups.delete(groupPath.split(' › ')[0]);
      }
    }
  }

  private printGroup(groupPath: string, indent: number): void {
    const group = this.groups.get(groupPath);
    if (!group) return;

    const padding = '  '.repeat(indent + 1);
    const total = group.expectedCount;
    const durationStr = this.formatDuration(group.totalDuration);
    const hasFailed = group.failed > 0;
    const hasChildren = group.children.size > 0;
    const groupName = groupPath.split(' › ').pop() || groupPath;

    if (hasFailed) {
      if (hasChildren) {
        // Parent group with children that have failures - show header and expand children
        console.log(`${padding}${this.red}✗${this.reset} ${groupName}`);
        for (const childPath of group.children) {
          this.printGroup(childPath, indent + 1);
        }
      } else {
        // Leaf group with failures - expand to show individual tests
        console.log(`${padding}${this.red}✗${this.reset} ${groupName} ${this.dim}(${durationStr})${this.reset}`);
        for (const entry of group.tests) {
          const { icon, color } = this.getStatusStyle(entry.result.status);
          const testDuration = this.formatDuration(entry.duration);
          console.log(
            `${padding}    ${color}${icon}${this.reset} ${entry.testName} ${this.dim}(${testDuration})${this.reset}`,
          );
        }
      }
    } else {
      // All passed - single collapsed line with total count (Vitest style)
      const countStr = total === 1 ? '1 test' : `${total} tests`;
      console.log(
        `${padding}${this.green}✓${this.reset} ${groupName} ${this.dim}(${countStr}) (${durationStr})${this.reset}`,
      );
    }
  }

  onEnd(_result: FullResult): void {
    this.clearProgress();
    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);

    // Output error details for failed tests
    if (this.failedTests.length > 0) {
      console.log('');
      console.log(`${this.red}─── Failed Tests ───${this.reset}`);

      for (let i = 0; i < this.failedTests.length; i++) {
        const { test, result: testResult, fullPath } = this.failedTests[i];
        console.log('');
        console.log(`  ${this.red}${i + 1}) ${fullPath}${this.reset}`);

        // Show file location
        const location = test.location;
        if (location) {
          console.log(`     ${this.dim}${location.file}:${location.line}:${location.column}${this.reset}`);
        }

        // Show error message and stack
        for (const error of testResult.errors) {
          if (error.message) {
            console.log('');
            console.log(`     ${this.red}Error: ${error.message.split('\n')[0]}${this.reset}`);
          }
          if (error.stack) {
            const stackLines = error.stack.split('\n').slice(0, 8);
            for (const line of stackLines) {
              console.log(`     ${this.dim}${line}${this.reset}`);
            }
            if (error.stack.split('\n').length > 8) {
              console.log(`     ${this.dim}...${this.reset}`);
            }
          }
        }

        // Show attachments (screenshots, traces)
        if (testResult.attachments.length > 0) {
          console.log('');
          console.log(`     ${this.cyan}Attachments:${this.reset}`);
          for (const attachment of testResult.attachments) {
            if (attachment.path) {
              console.log(`       ${this.dim}${attachment.name}: ${attachment.path}${this.reset}`);
            }
          }
        }
      }
      console.log('');
    }

    // Summary
    console.log('');
    if (this.failed > 0) {
      console.log(`  ${this.red}${this.failed} failed${this.reset}`);
    }

    const parts: string[] = [];
    if (this.passed > 0) parts.push(`${this.green}${this.passed} passed${this.reset}`);
    if (this.skipped > 0) parts.push(`${this.yellow}${this.skipped} skipped${this.reset}`);

    console.log(`  ${parts.join(', ')} ${this.dim}(${totalTime}s)${this.reset}`);
    console.log('');
  }

  private formatDuration(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  }

  private getStatusStyle(status: string): { icon: string; color: string } {
    switch (status) {
      case 'passed':
        return { icon: '✓', color: this.green };
      case 'failed':
      case 'timedOut':
        return { icon: '✗', color: this.red };
      case 'skipped':
        return { icon: '⊘', color: this.yellow };
      default:
        return { icon: '?', color: this.dim };
    }
  }
}
