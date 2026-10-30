// Attribute the minified bytes of a built bundle to its source files via the sourcemap.
//
//   bun nx build grid
//   node .github/skills/bundle-check/attribute-bundle.mjs [dist/libs/grid/index.js] [rows=45]
//
// Answers "where do the bytes go?" before any optimisation attempt. The CSS inlined
// through `core/styles/index.ts` shows up as that one file. Raw bytes only — gzip
// attribution per source is not meaningful (the deflate window spans files).
import { readFileSync } from 'node:fs';
import { TraceMap, eachMapping } from '@jridgewell/trace-mapping';

const file = process.argv[2] ?? 'dist/libs/grid/index.js';
const rows = Number(process.argv[3] ?? 45);
const code = readFileSync(file, 'utf8');
const map = new TraceMap(JSON.parse(readFileSync(file + '.map', 'utf8')));
const lines = code.split('\n');

// A segment runs from its column to the next segment's column on the same generated
// line. Source-map columns are UTF-16 string offsets, so slice the line by those and
// only then measure the slice in UTF-8 bytes — mixing the two units misattributes
// every non-ASCII literal (icon glyphs, en dashes) to the last segment on the line.
const perLine = new Map();
eachMapping(map, (m) => {
  if (!perLine.has(m.generatedLine)) perLine.set(m.generatedLine, []);
  perLine.get(m.generatedLine).push({ col: m.generatedColumn, src: m.source });
});
const bytes = new Map();
for (const [ln, segs] of perLine) {
  segs.sort((a, b) => a.col - b.col);
  const line = lines[ln - 1] ?? '';
  for (let i = 0; i < segs.length; i++) {
    const end = i + 1 < segs.length ? segs[i + 1].col : line.length;
    const key = (segs[i].src ?? '<helpers>').replace(/^.*?libs\/grid\//, '');
    bytes.set(key, (bytes.get(key) ?? 0) + Buffer.byteLength(line.slice(segs[i].col, end), 'utf8'));
  }
}
const sorted = [...bytes].sort((a, b) => b[1] - a[1]);
const total = sorted.reduce((s, r) => s + r[1], 0);
console.log(`${file}: ${Buffer.byteLength(code)} B, ${total} B mapped`);
for (const [src, b] of sorted.slice(0, rows)) {
  console.log(String(b).padStart(7), ((b / total) * 100).toFixed(1).padStart(5) + '%', src);
}
