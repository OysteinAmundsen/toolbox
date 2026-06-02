#!/usr/bin/env node
// @ts-check
/**
 * analyze-trace.mjs — self-contained performance trace analyzer for the
 * `debug-perf` skill. Zero dependencies; runs under Node or Bun.
 *
 * Input: a Chrome DevTools timeline trace JSON, produced either by
 *   - Playwright: `await page.tracing.stop({ path: 'trace.json' })`, or
 *   - DevTools Performance tab → right-click timeline → "Save profile…".
 *
 * Both produce the Chrome Trace Event Format: either a bare array of events
 * or an object with a `traceEvents` array.
 *
 * Output (matches the debug-perf SKILL.md contract):
 *   1. Top 20 long tasks (>50ms)
 *   2. Layout / style-recalc frequency and total cost
 *   3. Forced reflows (layout thrashing) with the triggering JS stack
 *   4. Scroll-related bottlenecks
 *
 * Usage: node .github/skills/debug-perf/analyze-trace.mjs <trace.json>
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LONG_TASK_US = 50_000; // 50 ms, in microseconds (trace ts/dur are µs)

/** @param {number} us */
const ms = (us) => (us / 1000).toFixed(2);

function fail(message) {
  console.error(`analyze-trace: ${message}`);
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  fail('missing trace file argument.\nUsage: node .github/skills/debug-perf/analyze-trace.mjs <trace.json>');
}

let raw;
try {
  raw = readFileSync(resolve(process.cwd(), file), 'utf8');
} catch (err) {
  fail(`cannot read "${file}": ${/** @type {Error} */ (err).message}`);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  fail(`"${file}" is not valid JSON: ${/** @type {Error} */ (err).message}`);
}

/** @type {Array<Record<string, any>>} */
const events = Array.isArray(parsed) ? parsed : parsed.traceEvents;
if (!Array.isArray(events)) {
  fail('no `traceEvents` array found — is this a Chrome DevTools timeline trace?');
}

// Only "complete" (ph: 'X') events carry a duration.
const durational = events.filter((e) => e.ph === 'X' && typeof e.dur === 'number');

const byName = (name) => durational.filter((e) => e.name === name);
const sum = (arr) => arr.reduce((acc, e) => acc + e.dur, 0);

// 1. Long tasks ---------------------------------------------------------------
const longTasks = durational
  .filter((e) => (e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask') && e.dur > LONG_TASK_US)
  .sort((a, b) => b.dur - a.dur)
  .slice(0, 20);

// 2. Layout / style recalc ----------------------------------------------------
const layouts = byName('Layout');
const styleRecalcs = [...byName('UpdateLayoutTree'), ...byName('RecalculateStyles')];

// 3. Forced reflows: a Layout triggered synchronously from JS carries a
//    `beginData.stackTrace`. That is the signature of layout thrashing.
const forcedReflows = layouts
  .filter((e) => e.args?.beginData?.stackTrace?.length)
  .sort((a, b) => b.dur - a.dur)
  .slice(0, 20);

// 4. Scroll bottlenecks -------------------------------------------------------
const scrollEvents = durational.filter(
  (e) =>
    (e.name === 'EventDispatch' && (e.args?.data?.type === 'scroll' || e.args?.data?.type === 'wheel')) ||
    e.name === 'ScrollLayer' ||
    e.name === 'HitTest',
);
const scrollByType = new Map();
for (const e of scrollEvents) {
  const key = e.args?.data?.type ? `${e.name}:${e.args.data.type}` : e.name;
  const entry = scrollByType.get(key) ?? { count: 0, total: 0 };
  entry.count += 1;
  entry.total += e.dur;
  scrollByType.set(key, entry);
}

// Report ----------------------------------------------------------------------
const line = '─'.repeat(72);
console.log(`\nTrace analysis: ${file}`);
console.log(`Events: ${events.length} total, ${durational.length} with duration\n`);

console.log(line);
console.log(`1. LONG TASKS (>${LONG_TASK_US / 1000}ms) — top ${longTasks.length}`);
console.log(line);
if (longTasks.length === 0) {
  console.log('  none — no main-thread task exceeded the long-task threshold.');
} else {
  for (const [i, e] of longTasks.entries()) {
    console.log(`  ${String(i + 1).padStart(2)}. ${ms(e.dur).padStart(9)} ms  ${e.name}`);
  }
}

console.log(`\n${line}`);
console.log('2. LAYOUT & STYLE RECALCULATION');
console.log(line);
console.log(
  `  Layout:            ${layouts.length.toString().padStart(6)} events, ${ms(sum(layouts)).padStart(9)} ms total`,
);
console.log(
  `  Style recalc:      ${styleRecalcs.length.toString().padStart(6)} events, ${ms(sum(styleRecalcs)).padStart(9)} ms total`,
);

console.log(`\n${line}`);
console.log(`3. FORCED REFLOWS (layout thrashing) — top ${forcedReflows.length}`);
console.log(line);
if (forcedReflows.length === 0) {
  console.log('  none detected — no Layout was triggered synchronously from JS.');
} else {
  for (const [i, e] of forcedReflows.entries()) {
    const top = e.args.beginData.stackTrace[0] ?? {};
    const fn = top.functionName || '(anonymous)';
    const loc = top.url ? `${top.url}:${top.lineNumber ?? '?'}` : '(no source)';
    console.log(`  ${String(i + 1).padStart(2)}. ${ms(e.dur).padStart(9)} ms  ${fn}  ${loc}`);
  }
  console.log('\n  Fix: batch DOM reads before writes; cache layout queries (offsetWidth,');
  console.log('  getBoundingClientRect, scrollTop) outside write loops.');
}

console.log(`\n${line}`);
console.log('4. SCROLL BOTTLENECKS');
console.log(line);
if (scrollByType.size === 0) {
  console.log('  none — no scroll/wheel/hit-test work recorded.');
} else {
  for (const [key, { count, total }] of [...scrollByType.entries()].sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  ${key.padEnd(28)} ${count.toString().padStart(6)} events, ${ms(total).padStart(9)} ms total`);
  }
}

console.log('');
