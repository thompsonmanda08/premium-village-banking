import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { RankedBars } from './RankedBars';

const fmt = (n: number) => `K ${n}`;
const num = (el: Element, attr: string) => Number(el.getAttribute(attr));

test('bars start at the zero line: gains go right, losses go left', () => {
  const { container } = render(<RankedBars label="Who is ahead" format={fmt} rows={[{ label: 'Ann', value: 300 }, { label: 'Bob', value: -100 }]} />);
  const zero = num(container.querySelector('line[data-zero]')!, 'x1');
  const [ann, bob] = [...container.querySelectorAll('rect[data-row]')];
  expect(num(ann!, 'x')).toBeCloseTo(zero, 1);
  expect(num(bob!, 'x') + num(bob!, 'width')).toBeCloseTo(zero, 1);
  expect(num(ann!, 'width')).toBeCloseTo(3 * num(bob!, 'width'), 1);
});

test('rows keep the order given; positives, negatives and the highlighted row have their own tones', () => {
  const { container } = render(
    <RankedBars label="Who is ahead" format={fmt} rows={[{ label: 'Ann', value: 300 }, { label: 'Eve', value: 50, highlight: true }, { label: 'Bob', value: -100 }]} />,
  );
  const bars = [...container.querySelectorAll('rect[data-row]')];
  expect(bars.map((b) => b.getAttribute('data-row'))).toEqual(['Ann', 'Eve', 'Bob']);
  expect(bars[0]!.getAttribute('class')).toContain('fill-success');
  expect(bars[1]!.getAttribute('class')).toContain('fill-warning');
  expect(bars[2]!.getAttribute('class')).toContain('fill-danger');
});

test('all-negative and all-zero data stay finite', () => {
  for (const values of [[-5, -1], [0, 0]]) {
    const { container, unmount } = render(<RankedBars label="x" format={fmt} rows={values.map((v, i) => ({ label: `m${i}`, value: v }))} />);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    unmount();
  }
});

test('no rows says so; the table lists the rows', () => {
  const { container, unmount } = render(<RankedBars label="x" format={fmt} rows={[]} />);
  expect(container.textContent).toContain('No data yet');
  expect(container.querySelector('svg')).toBeNull();
  unmount();
  const second = render(<RankedBars label="x" format={fmt} rows={[{ label: 'Ann', value: 300 }]} />);
  const rows = [...second.container.querySelectorAll('tbody tr')].map((r) => [...r.querySelectorAll('td,th')].map((c) => c.textContent));
  expect(rows).toEqual([['Ann', 'K 300']]);
  expect(second.container.querySelector('svg')).toHaveAttribute('aria-label', 'x');
});
