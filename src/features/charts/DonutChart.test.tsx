import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { DonutChart } from './DonutChart';

const fmt = (n: number) => `K ${n}`;
const base = { label: 'Share of the pool', format: fmt, centre: { big: '30%', small: 'of all savings' } };
const C = 2 * Math.PI * 70;
const dash = (el: Element) => (el.getAttribute('stroke-dasharray') ?? '').split(' ').map(Number);

test('each slice covers its share of the ring, and together they cover all of it', () => {
  const { container } = render(<DonutChart {...base} slices={[{ label: 'You', value: 30, tone: 'accent' }, { label: 'The rest', value: 70, tone: 'muted' }]} />);
  const slices = [...container.querySelectorAll('circle[data-slice]')];
  expect(slices).toHaveLength(2);
  expect(dash(slices[0]!)[0]).toBeCloseTo(0.3 * C, 1);
  expect(dash(slices[1]!)[0]).toBeCloseTo(0.7 * C, 1);
  expect(dash(slices[0]!)[0]! + dash(slices[1]!)[0]!).toBeCloseTo(C, 1);
  expect(slices[0]!.getAttribute('class')).toContain('stroke-accent-solid');
});

test('the centre says what the ring shows, and the chart has a label', () => {
  const { container } = render(<DonutChart {...base} slices={[{ label: 'You', value: 30, tone: 'accent' }, { label: 'The rest', value: 70, tone: 'muted' }]} />);
  expect(container.querySelector('svg')).toHaveAttribute('role', 'img');
  expect(container.querySelector('svg')).toHaveAttribute('aria-label', 'Share of the pool');
  expect(container.textContent).toContain('30%');
  expect(container.textContent).toContain('of all savings');
});

test('nothing in the pool is a quiet ring and a line of text, not NaN', () => {
  const { container } = render(<DonutChart {...base} slices={[{ label: 'You', value: 0, tone: 'accent' }, { label: 'The rest', value: 0, tone: 'muted' }]} />);
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  expect(container.textContent).toContain('No data yet');
  expect(container.querySelectorAll('circle[data-slice]')).toHaveLength(0);
});

test('a zero slice draws nothing, and the table lists every slice with its share', () => {
  const { container } = render(<DonutChart {...base} slices={[{ label: 'You', value: 25, tone: 'accent' }, { label: 'Nobody', value: 0, tone: 'info' }, { label: 'The rest', value: 75, tone: 'muted' }]} />);
  expect(container.querySelectorAll('circle[data-slice]')).toHaveLength(2);
  const rows = [...container.querySelectorAll('tbody tr')].map((r) => [...r.querySelectorAll('td,th')].map((c) => c.textContent));
  expect(rows).toEqual([['You', 'K 25', '25.0%'], ['Nobody', 'K 0', '0.0%'], ['The rest', 'K 75', '75.0%']]);
});
