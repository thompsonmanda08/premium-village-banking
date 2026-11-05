import { useEffect, useRef, useState } from 'react';

/**
 * The width, in pixels, of the element the ref is put on. A chart is drawn at that width so one drawing unit is one pixel and its 12px text
 * stays 12px on a phone. Until it is measured (and where there is no ResizeObserver, as in tests) it is `fallback`.
 */
export function useWidth(fallback = 640, min = 280) {
  const ref = useRef<HTMLElement | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const w = Math.floor(el.clientWidth);
      if (w > 0) setWidth(Math.max(min, w));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [min]);
  return [ref, width] as const;
}
