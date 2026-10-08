export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden className="shrink-0">
      <rect width="512" height="512" rx="112" className="fill-accent-solid" />
      <path d="M176 368V144h96c48 0 80 30 80 72s-32 72-80 72h-48v80" fill="none" className="stroke-on-accent" strokeWidth="44" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
