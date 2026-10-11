import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { DifferenceList } from './DifferenceList';

const d = (o: Partial<Parameters<typeof DifferenceList>[0]['diff'][number]>) => ({
  member_id: 'm1', short_name: 'Eve', field: 'cum_savings', app: 300, workbook: 350, difference: -50, reason_code: 'unexplained', ...o,
});

test('groups by reason with unexplained first, and shows the three figures', () => {
  render(
    <DifferenceList
      diff={[
        d({ field: 'idle_cash', member_id: null, short_name: null, app: 299, workbook: 289, difference: 10, reason_code: 'fee_pot_vs_cash' }),
        d({}),
        d({ short_name: 'Ann', member_id: 'm2', field: 'excess_charged', app: 4.09, workbook: 4.1, difference: -0.01, reason_code: 'workbook_rounded' }),
      ]}
    />,
  );
  expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
    'Unexplained1', 'Loan fees paid from the fee pot, not lending cash1', 'Workbook rounding1',
  ]);
  expect(screen.getByText('Eve · Savings to date')).toBeInTheDocument();
  expect(screen.getByText('App K 300 · Workbook K 350 · Difference −K 50')).toBeInTheDocument();
  expect(screen.getByText('Group · Idle cash')).toBeInTheDocument();
});

test('an unknown reason code is still shown, and a missing app figure reads none', () => {
  render(<DifferenceList diff={[d({ app: null, difference: null, reason_code: 'brand_new_code' })]} />);
  const other = screen.getByRole('heading', { level: 3, name: /Other differences/ }).closest('section')!;
  expect(within(other).getByText('App none · Workbook K 350 · Difference not available')).toBeInTheDocument();
});
