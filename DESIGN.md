# Premium Village Bank: Design system

Near-black (dark) or cool grey (light) ground, one lime accent, Inter, pill controls. Dark mode is tuned to the
FinWise finance-dashboard reference; light mode keeps the same shapes and fills with ink so lime still reads.
Source of truth for values: `src/styles/tokens.css`. Rules are enforced by `scripts/check-tokens.mjs`.

## Colour tokens

| Spec token | Tailwind utility | Light | Dark | Use |
|---|---|---|---|---|
| bg | `bg-canvas` | #EEF0F2 | #0F1113 | app background |
| surface | `bg-surface` | #FFFFFF | #1A1D20 | cards, bars, nav pills |
| surface-2 | `bg-surface-2` | #F4F5F7 | #24282C | insets, date blocks, chart tracks, hovers |
| line | `border-line` | #DFE2E6 | #2E3338 | borders, dividers |
| text | `text-fg` | #121417 | #F3F4F1 | primary text |
| text-muted | `text-muted` | #555B65 | #9EA3AB | secondary text |
| accent | `text-accent`, `ring-accent` | #3F6212 | #C6F432 | links, focus, accent text |
| accent-solid | `bg-accent-solid` + `text-on-accent` | #16181B + #C6F432 | #C6F432 + #121417 | filled buttons, active nav, selected segment |
| accent-soft | `bg-accent-soft` | #EAF7C4 | lime 14% | avatars, selected rows |
| meter | `bg-meter` | #65A30D | #C6F432 | chart and progress fills (3:1 against the surface) |
| success / warning / danger / info | `text-success` … and `bg-success-soft` … | emerald-700 / amber-700 / rose-600 / sky-700 | emerald-400 / amber-400 / rose-400 / sky-400 | status and money |
| scrim | `bg-scrim` | ink 45% | black 60% | behind sheets |

Light mode never fills with lime: a lime fill on white has no edge. `accent-solid` there is ink with lime lettering.
Money: savings and earnings `success`, amounts owed `warning`, penalties and losses `danger`.

## Brand mark

The group's emblem (hands holding a coin and a sprout among village huts), cut to a circle on transparency:
`public/brand-mark.png` (192px, in-app via `BrandMark`) and `public/logo.png` (512px, the source for the favicon and install
icons; regenerate with `bun x pwa-assets-generator`). The emblem keeps its own colours in both themes; maskable and Apple
icons pad it with white to match its white disc. It is detailed artwork, so keep it at 36px or larger.

## Shape

- Interactive pills are round: buttons, nav items, segmented controls (`rounded-full`); icon buttons and avatars are circles.
- Containers are `rounded-2xl` (cards, stat tiles); insets, inputs and list rows `rounded-xl`; chart columns `rounded-lg`.
- Stat tiles (`src/features/home/StatTile.tsx`) cut their top-right corner with the `notch` utility; the round link to the
  figure's page sits in the cut. A gradient is allowed only inside `mask`, where it cuts a shape and paints nothing.

## Layout

- Phone (< md): sticky top bar with the page title, bottom nav with a filled active pill, More sheet.
- md and up: `TopNav` header. Brand pill left, centred pill nav, round Group settings and Account buttons right.
  Below xl the nav pills are icons with the current page labelled; from xl they are text only. No sidebar.
- Content max width 1280px. Home: four stat tiles, then cycle card (1.6fr) beside Coming up (1fr).
- Group settings is a page, `/settings/:tab` (general, privacy, members, rules), with a segmented tab bar of links.

## Rules

- No raw palette classes, no `dark:` colour variants, no gradients (masks excepted), no glow shadows, no glass blur on
  cards (blur only on the sticky top bar, desktop header and bottom nav).
- Light mode cards use `shadow-sm`; dark mode relies on `border-line`. Notched tiles use the border only.
- Text: 12px minimum (metadata only), 16px body on phones, `tabular` on every figure. Headings `font-semibold tracking-tight`.
- Primary controls 48px tall; nav and tab pills at least 40px inside a padded track (44px on phones).
- Every badge carries a text label and a glyph; colour never stands alone. Charts carry a text summary (`role="img"`).
- Motion 150–200ms ease-out for state; one load moment (Home's cycle columns rise in order). Everything stops under
  `prefers-reduced-motion`.
- Icons: lucide-react; icon-only controls need an accessible label.
- No invented figures: until the ledger lands, Home shows only what the cycle, its rules and the member list say.
