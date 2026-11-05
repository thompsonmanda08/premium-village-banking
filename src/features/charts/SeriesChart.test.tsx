import { act, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { SeriesChart, type SeriesDef } from './SeriesChart';

const fmt = (n: number) => `K ${n}`;
const base = { label: 'Savings by month', categories: ['Feb', 'Mar', 'Apr'], format: fmt };
const bar = (key: string, values: Array<number | null>, o: Partial<SeriesDef> = {}): SeriesDef => ({ key, label: key, tone: 'accent', values, kind: 'bar', ...o });
const line = (key: string, values: Array<number | null>, o: Partial<SeriesDef> = {}): SeriesDef => ({ key, label: key, tone: 'warning', values, kind: 'line', ...o });
const num = (el: Element, attr: string) => Number(el.getAttribute(attr));
const rects = (c: HTMLElement, key: string) => [...c.querySelectorAll(`rect[data-series="${key}"]`)];

test('the chart is an image with a label, and a fixed drawing size', () => {
  const { container } = render(<SeriesChart {...base} series={[bar('a', [100, 200, 300])]} />);
  const svg = container.querySelector('svg')!;
  expect(svg).toHaveAttribute('role', 'img');
  expect(svg).toHaveAttribute('aria-label', 'Savings by month');
  expect(svg).toHaveAttribute('viewBox', '0 0 640 260');
});

test('bars are proportional to their values, and a missing value draws nothing', () => {
  const { container } = render(<SeriesChart {...base} series={[bar('a', [100, 200, null])]} />);
  const [first, second] = rects(container, 'a');
  expect(rects(container, 'a')).toHaveLength(2);
  expect(num(second!, 'height')).toBeCloseTo(2 * num(first!, 'height'), 1);
});

test('stacked bars sit on top of one another', () => {
  const { container } = render(<SeriesChart {...base} categories={['Feb']} stacked series={[bar('a', [100]), bar('b', [200])]} />);
  const [a] = rects(container, 'a');
  const [b] = rects(container, 'b');
  expect(num(b!, 'y') + num(b!, 'height')).toBeCloseTo(num(a!, 'y'), 1);
});

test('grouped bars sit side by side', () => {
  const { container } = render(<SeriesChart {...base} categories={['Feb']} series={[bar('a', [100]), bar('b', [100])]} />);
  const [a] = rects(container, 'a');
  const [b] = rects(container, 'b');
  expect(num(b!, 'x')).toBeCloseTo(num(a!, 'x') + num(a!, 'width'), 1);
});

test('a line breaks where a value is missing: [1, null, 3, 4] is two strokes and three points', () => {
  const { container } = render(<SeriesChart {...base} categories={['a', 'b', 'c', 'd']} series={[line('l', [1, null, 3, 4])]} />);
  expect(container.querySelectorAll('path[data-line="l"]')).toHaveLength(2);
  expect(container.querySelectorAll('circle[data-series="l"]')).toHaveLength(3);
});

test('a dashed line says so, and an area is filled under the first line', () => {
  const { container } = render(<SeriesChart {...base} series={[line('l', [1, 2, 3], { area: true }), line('m', [1, 1, 1], { dashed: true })]} />);
  expect(container.querySelector('path[data-area="l"]')).not.toBeNull();
  expect(container.querySelector('path[data-line="m"]')).toHaveAttribute('stroke-dasharray');
  expect(container.querySelector('path[data-line="l"]')).not.toHaveAttribute('stroke-dasharray');
});

test('a series on the right axis has its own scale and labels', () => {
  const { container } = render(
    <SeriesChart {...base} rightFormat={(n) => `${n}%`} series={[bar('a', [100, 100, 100]), line('g', [5, 5, 5], { axis: 'right' })]} />,
  );
  const point = container.querySelector('circle[data-series="g"]')!;
  expect(num(point, 'cy')).toBeLessThan(130); // 5 on a 0–6 scale is near the top, not near the bottom as on the left 0–100 scale
  expect([...container.querySelectorAll('text')].some((t) => t.textContent?.endsWith('%'))).toBe(true);
});

test('negative values hang below a zero line', () => {
  const { container } = render(<SeriesChart {...base} series={[bar('a', [-100, 200, 0])]} />);
  const zero = container.querySelector('line[data-zero]')!;
  const [neg, pos] = rects(container, 'a');
  expect(num(neg!, 'y')).toBeCloseTo(num(zero, 'y1'), 1);
  expect(num(pos!, 'y') + num(pos!, 'height')).toBeCloseTo(num(zero, 'y1'), 1);
});

test('a reference line is dashed and named', () => {
  const { container } = render(<SeriesChart {...base} series={[bar('a', [100, 200, 300])]} reference={{ label: 'K250 minimum', value: 250 }} />);
  expect(container.querySelector('line[data-reference]')).toHaveAttribute('stroke-dasharray');
  expect(container.textContent).toContain('K250 minimum');
});

test('a bar can take its own tone', () => {
  const { container } = render(<SeriesChart {...base} series={[bar('a', [100, 200, 300], { tones: ['success', 'danger', 'success'] })]} />);
  const [first, second] = rects(container, 'a');
  expect(first!.getAttribute('class')).toContain('fill-success');
  expect(second!.getAttribute('class')).toContain('fill-danger');
});

test('empty, all-zero, single-point and all-null data never produce NaN or Infinity', () => {
  const cases: Array<{ categories: string[]; series: SeriesDef[] }> = [
    { categories: [], series: [] },
    { categories: ['a', 'b'], series: [bar('a', [0, 0]), line('l', [0, 0])] },
    { categories: ['a'], series: [bar('a', [5]), line('l', [5])] },
    { categories: ['a', 'b'], series: [bar('a', [null, null])] },
    { categories: ['a', 'b'], series: [bar('a', [-5, -1])] },
  ];
  for (const c of cases) {
    const { container, unmount } = render(<SeriesChart {...base} {...c} />);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    unmount();
  }
});

test('with nothing to draw it says so instead of showing an empty axis', () => {
  const { container } = render(<SeriesChart {...base} categories={['a']} series={[bar('a', [null])]} />);
  expect(container.querySelector('svg')).toBeNull();
  expect(container.textContent).toContain('No data yet');
});

test('the same numbers are in a table: a row per category, a dash for a gap', () => {
  const { container } = render(<SeriesChart {...base} series={[bar('a', [100, null, 300]), line('b', [1, 2, 3])]} />);
  const rows = [...container.querySelectorAll('tbody tr')].map((r) => [...r.querySelectorAll('td,th')].map((c) => c.textContent));
  expect(rows).toEqual([['Feb', 'K 100', 'K 1'], ['Mar', '—', 'K 2'], ['Apr', 'K 300', 'K 3']]);
  expect([...container.querySelectorAll('thead th')].map((c) => c.textContent)).toEqual(['Month', 'a', 'b']);
});

test('each mark carries its value in a title, and the legend names every series', () => {
  const { container } = render(<SeriesChart {...base} series={[bar('Saved', [100, 200, 300]), line('Pool', [1, 2, 3])]} />);
  expect(container.querySelector('rect[data-series="Saved"] title')?.textContent).toBe('Feb — Saved: K 100');
  const legend = container.querySelector('[data-legend]')!;
  expect(legend.textContent).toContain('Saved');
  expect(legend.textContent).toContain('Pool');
});

test('the table and the hover titles give the exact amount even when the right axis is shortened', () => {
  const { container } = render(
    <SeriesChart {...base} rightFormat={(n) => `${n / 1000}k`} series={[bar('a', [100, 100, 100]), line('pool', [4749, 4800, 4900], { axis: 'right' })]} />,
  );
  const first = container.querySelector('tbody tr')!;
  expect([...first.querySelectorAll('td')].map((c) => c.textContent)).toEqual(['K 100', 'K 4749']);
  expect(container.querySelector('circle[data-series="pool"] title')?.textContent).toBe('Feb — pool: K 4749');
  expect([...container.querySelectorAll('svg text')].some((t) => t.textContent === '4k')).toBe(true); // the axis itself stays short (ticks are 0, 2k, 4k, 6k)
});

// Text must stay readable on a phone: one drawing unit is one pixel, so the drawing is as wide as the space it is given.
let resized: (() => void) | null = null;
const stubSize = (width: number) => {
  vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { resized = cb; } observe() {} disconnect() {} unobserve() {} });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width });
};
afterEach(() => {
  vi.unstubAllGlobals();
  resized = null;
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
});

test('the drawing takes the width of its container, so 12px text stays 12px on a phone', () => {
  stubSize(320);
  const { container } = render(<SeriesChart {...base} series={[bar('a', [100, 200, 300])]} />);
  act(() => resized?.());
  expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 320 260');
});

test('on a narrow screen only every other month label is drawn so they do not run together', () => {
  stubSize(300);
  const months = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
  const { container } = render(<SeriesChart {...base} categories={months} series={[bar('a', months.map(() => 100))]} />);
  act(() => resized?.());
  const labels = [...container.querySelectorAll('svg text')].map((t) => t.textContent).filter((t) => months.includes(t ?? ''));
  expect(labels).toEqual(['Feb', 'Apr', 'Jun', 'Aug', 'Oct', 'Dec']);
  expect(container.querySelectorAll('tbody tr')).toHaveLength(12); // the table still has every month
});
