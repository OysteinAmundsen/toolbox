/**
 * CLI wrapper for bundle budget checks.
 *
 * Usage: bun run tools/check-bundle-budget.ts <outDir> <budgetJson>
 *
 * Example:
 *   bun run tools/check-bundle-budget.ts dist/libs/grid-angular \
 *     '[{"path":"fesm2022/toolbox-web-grid-angular.mjs","maxSize":262144}]'
 */
import { resolve } from 'node:path';
import { checkBudgets, type BudgetEntry } from './vite-bundle-budget';

const [outDir, budgetJson] = process.argv.slice(2);

if (!outDir || !budgetJson) {
  console.error('Usage: check-bundle-budget <outDir> <budgetJson>');
  process.exit(1);
}

const budgets: BudgetEntry[] = JSON.parse(budgetJson);
const { violations, warnings } = checkBudgets({ outDir: resolve(outDir), budgets });

if (warnings.length > 0) {
  console.warn(`\n\x1b[33mBundle budget warnings:\x1b[0m`);
  for (const w of warnings) console.warn(`  \x1b[33m⚠\x1b[0m ${w}`);
  console.warn();
}

if (violations.length > 0) {
  console.error(`\n\x1b[31mBundle budget exceeded:\x1b[0m`);
  for (const v of violations) console.error(`  \x1b[31m✗\x1b[0m ${v}`);
  console.error();
  process.exit(1);
} else if (warnings.length === 0) {
  console.log('\x1b[32m✓ All bundle budgets passed\x1b[0m');
}
