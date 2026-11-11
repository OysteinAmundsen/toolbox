// Print the minified output a bundle attributes to ONE source file (companion of attribute-bundle.mjs).
//
//   bun nx build grid
//   node .github/skills/bundle-check/dump-source.mjs <source-substring> [dist/libs/grid/index.js]
//   node .github/skills/bundle-check/dump-source.mjs internal/validate-config.ts
//
// Reading what terser actually emits for a file is the fastest way to spot what minifies badly:
// long string literals, repeated property chains, `this.#private` accessors (kept as WeakMap-free
// `#x` but never shortened), duplicated loops. Contiguous segments are joined; a gap prints `…`.
import { readFileSync } from 'node:fs';
import { TraceMap, eachMapping } from '@jridgewell/trace-mapping';

const needle = process.argv[2];
const file = process.argv[3] ?? 'dist/libs/grid/index.js';
if (!needle) {
  console.error('usage: dump-source.mjs <source-substring> [bundle.js]');
  process.exit(2);
}
const code = readFileSync(file, 'utf8');
const map = new TraceMap(JSON.parse(readFileSync(file + '.map', 'utf8')));
const lines = code.split('\n');

const perLine = new Map();
eachMapping(map, (m) => {
  if (!perLine.has(m.generatedLine)) perLine.set(m.generatedLine, []);
  perLine.get(m.generatedLine).push({ col: m.generatedColumn, src: m.source ?? '' });
});
let out = '';
let bytes = 0;
let lastEnd = -1;
for (const [ln, segs] of [...perLine].sort((a, b) => a[0] - b[0])) {
  segs.sort((a, b) => a.col - b.col);
  const line = lines[ln - 1] ?? '';
  for (let i = 0; i < segs.length; i++) {
    if (!segs[i].src.includes(needle)) continue;
    const end = i + 1 < segs.length ? segs[i + 1].col : line.length;
    const text = line.slice(segs[i].col, end);
    const pos = ln * 1e7 + segs[i].col;
    if (lastEnd >= 0 && pos !== lastEnd) out += '\n…\n';
    out += text;
    bytes += Buffer.byteLength(text, 'utf8');
    lastEnd = ln * 1e7 + end;
  }
}
console.log(out);
console.error(`\n${bytes} B attributed to *${needle}*`);
