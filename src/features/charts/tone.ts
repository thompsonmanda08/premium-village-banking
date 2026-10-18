export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

// Literal class names (Tailwind reads them from source); colours come from the theme tokens only.
export const TONE: Record<Tone, { fill: string; stroke: string; swatch: string }> = {
  accent: { fill: 'fill-accent-solid', stroke: 'stroke-accent-solid', swatch: 'bg-accent-solid' },
  success: { fill: 'fill-success', stroke: 'stroke-success', swatch: 'bg-success' },
  warning: { fill: 'fill-warning', stroke: 'stroke-warning', swatch: 'bg-warning' },
  danger: { fill: 'fill-danger', stroke: 'stroke-danger', swatch: 'bg-danger' },
  info: { fill: 'fill-info', stroke: 'stroke-info', swatch: 'bg-info' },
  muted: { fill: 'fill-muted', stroke: 'stroke-muted', swatch: 'bg-muted' },
};

/** The soft fill under an area line. */
export const AREA = 'fill-accent-soft';
