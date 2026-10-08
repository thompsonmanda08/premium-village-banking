import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PALETTE = 'slate|zinc|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black';
// Every utility prefix that takes a colour (inset-/drop-/text- variants of ring and shadow end in these).
const PROPS = 'bg|text|border(?:-[trblxyse])?|(?:inset-)?ring(?:-offset)?|from|via|to|(?:inset-|drop-)?shadow|fill|stroke|divide|outline|placeholder|decoration|caret|accent';
// Same list for dark: variants, minus shadow (dark:shadow-none is a legitimate elevation tweak, not a colour).
const DARK_PROPS = 'bg|text|border|ring|from|via|to|fill|stroke|divide|outline|placeholder|decoration|caret|accent';
// One Tailwind variant segment: hover, md, group-hover, aria-[x=y], [&>svg].
const VARIANT = String.raw`(?:[\w-]+(?:-\[[^\]]*\])?|\[[^\]]*\])`;

export const RULES = [
  { name: 'raw palette colour', re: new RegExp(String.raw`\b(?:${PROPS})-(?:${PALETTE})(?:-\d{2,3})?(?:\/(?:\d{1,3}|\[[^\]]+\]))?(?![\w-])`, 'g') },
  {
    name: 'arbitrary colour value',
    re: new RegExp(String.raw`\b(?:${PROPS})-\[[^\]]*(?:#[0-9a-fA-F]{3,8}\b|(?:rgb|hsl|hwb|lab|lch|oklab|oklch)a?\()`, 'g'),
  },
  {
    name: 'text under 12px',
    re: /\btext-\[(\d*\.?\d+)(px|rem|em)\]/g,
    keep: (m) => Number(m[1]) * (m[2] === 'px' ? 1 : 16) < 12,
  },
  { name: 'theme ternary', re: /\bisLight\b/g },
  { name: 'dark: colour variant', re: new RegExp(String.raw`\bdark:(?:${VARIANT}:)*(?:${DARK_PROPS})-`, 'g') },
  { name: 'gradient', re: /\bbg-(?:gradient|linear|radial|conic)(?![A-Za-z0-9_])|\b(?:repeating-)?(?:linear|radial|conic)-gradient\(/g },
];

export function scan(text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    for (const rule of RULES) {
      for (const m of line.matchAll(rule.re)) {
        if (!rule.keep || rule.keep(m)) hits.push({ line: i + 1, rule: rule.name, match: m[0] });
      }
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
