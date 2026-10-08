import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PALETTE = 'slate|zinc|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black';
const PROPS = 'bg|text|border|ring|from|via|to|shadow|fill|stroke|divide|outline|placeholder|decoration|caret';

export const RULES = [
  { name: 'raw palette colour', re: new RegExp(`\\b(?:${PROPS})-(?:${PALETTE})(?:-\\d{2,3})?(?:\\/\\d{1,3})?(?![\\w-])`) },
  { name: 'text under 12px', re: /text-\[(?:\d|1[01])px\]/ },
  { name: 'theme ternary', re: /\bisLight\b/ },
  { name: 'dark: colour variant', re: /\bdark:(?:bg|text|border|ring)-/ },
  { name: 'gradient', re: /\bbg-(?:gradient|linear)-to-/ },
];

export function scan(text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    for (const rule of RULES) {
      const m = line.match(rule.re);
      if (m) hits.push({ line: i + 1, rule: rule.name, match: m[0] });
    }
  });
  return hits;
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (['.ts', '.tsx', '.css'].includes(extname(p)) && !p.endsWith('database.types.ts')) yield p;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? 'src';
  let count = 0;
  for (const f of files(root)) {
    for (const h of scan(readFileSync(f, 'utf8'))) {
      console.error(`${f}:${h.line} ${h.rule}: ${h.match}`);
      count++;
    }
  }
  if (count) {
    console.error(`\n${count} design-token violation(s). See DESIGN.md.`);
    process.exit(1);
  }
  console.log('check-tokens: clean');
}
