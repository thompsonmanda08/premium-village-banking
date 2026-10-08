# Premium Village Bank — Design system

The template's identity, cleaned up: slate in light mode, zinc in dark mode, one indigo accent, Inter.
Source of truth for values: `src/styles/tokens.css`. Rules are enforced by `scripts/check-tokens.mjs`.

## Colour tokens

| Spec token | Tailwind utility | Light | Dark | Use |
|---|---|---|---|---|
| bg | `bg-canvas` | #F1F5F9 | #09090B | app background |
| surface | `bg-surface` | #FFFFFF | #18181B | cards, sheets, bars |
| surface-2 | `bg-surface-2` | #F8FAFC | #27272A | insets, table headers, chips |
| line | `border-line` | #E2E8F0 | #3F3F46 | borders, dividers |
| text | `text-fg` | #0F172A | #F4F4F5 | primary text |
| text-muted | `text-muted` | #475569 | #A1A1AA | secondary text |
| accent | `text-accent`, `ring-accent` | #4F46E5 | #818CF8 | links, active nav, focus |
| accent-solid | `bg-accent-solid` + `text-on-accent` | #4F46E5 | #4F46E5 | filled buttons |
| accent-soft | `bg-accent-soft` | #EEF2FF | indigo 15% | selected rows, active nav pill |
| success / warning / danger / info | `text-success` … and `bg-success-soft` … | emerald-700 / amber-700 / rose-600 / sky-700 | emerald-400 / amber-400 / rose-400 / sky-400 | status and money |
| scrim | `bg-scrim` | slate-900 45% | black 60% | behind sheets |

Money: savings and earnings `success`, amounts owed `warning`, penalties and losses `danger`.

## Rules

- No raw palette classes, no `dark:` colour variants, no gradients, no glow shadows, no glass blur on cards
  (blur is allowed only on the sticky top bar and bottom nav).
- Light mode cards use `shadow-sm`; dark mode relies on `border-line`.
- Text: 12px minimum (metadata only), 16px body on phones, `tabular` on every figure.
- Controls: `rounded-xl`; cards `rounded-2xl`; badges and chips `rounded-full`; primary controls 48px tall.
- Every badge carries a text label and a glyph; colour never stands alone.
- Motion 150–200ms ease-out; everything stops under `prefers-reduced-motion`.
- Icons: lucide-react; icon-only buttons need an accessible label.
