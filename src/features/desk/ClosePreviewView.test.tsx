import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { closeMember, closePreview } from '@/features/ledger/testFixtures';
import { ClosePreviewView } from './ClosePreviewView';

test('shows the group statement the close would write', () => {
  render(<ClosePreviewView preview={closePreview()} />);
  const group = screen.getByRole('heading', { name: 'Group statement' }).closest('section')!;
  expect(within(group).getByText('Idle cash').nextElementSibling).toHaveTextContent('K 7,000');
  expect(within(group).getByText('Excess billed').nextElementSibling).toHaveTextContent('K 700');
  expect(within(group).getByText('Interest collected').nextElementSibling).toHaveTextContent('K 120');
  expect(within(group).getByText('Fee pot').nextElementSibling).toHaveTextContent('K 40');
  expect(within(group).getByText('Meeting pot').nextElementSibling).toHaveTextContent('K 900');
  expect(within(group).getByText('Total owed').nextElementSibling).toHaveTextContent('K 2,300');
  expect(screen.queryByText(/fee pot is short/i)).toBeNull();
});

test('a negative fee pot is a warning', () => {
  const p = closePreview();
  render(<ClosePreviewView preview={{ ...p, group: { ...p.group, fee_pot_balance: -15 } }} />);
  expect(screen.getByText(/The fee pot is short/)).toBeInTheDocument();
});

test('one expandable card per member, with the count in the heading', () => {
  render(<ClosePreviewView preview={closePreview()} />);
  expect(screen.getByRole('heading', { name: 'Members (2)' })).toBeInTheDocument();
  expect(screen.getAllByRole('group')).toHaveLength(2);
});

test('a member card hides untouched zero lines but shows negative ones, and always shows closing owed and the next minimum', () => {
  render(
    <ClosePreviewView
      preview={closePreview({
        members: [closeMember({ penalties_charged: -50, paid_to_principal: -100, loan_interest_charged: 45, closing_owed: 300, next_minimum: 400 })],
      })}
    />,
  );
  const card = screen.getByRole('group');
  expect(within(card).getByText('Loan interest charged').nextElementSibling).toHaveTextContent('K 45');
  expect(within(card).getByText('Penalties charged').nextElementSibling).toHaveTextContent('−50');
  expect(within(card).getByText('Paid to loan principal').nextElementSibling).toHaveTextContent('−100');
  expect(within(card).queryByText('Excess charged')).toBeNull();
  expect(within(card).getByText('Closing owed').nextElementSibling).toHaveTextContent('K 300');
  expect(within(card).getByText('Next minimum').nextElementSibling).toHaveTextContent('K 400');
});

test('a credit reads In credit in the card and in the summary', () => {
  render(<ClosePreviewView preview={closePreview({ members: [closeMember({ closing_owed: -50 })] })} />);
  const card = screen.getByRole('group');
  expect(within(card).getByText('In credit K 50')).toBeInTheDocument();
  expect(within(card).getByText('Closing credit').nextElementSibling).toHaveTextContent('K 50');
});

test('with no differences it says there is nothing to compare', () => {
  render(<ClosePreviewView preview={closePreview()} />);
  expect(screen.getByText('No workbook figures are loaded for this month, so there is nothing to compare.')).toBeInTheDocument();
});

test('differences are listed by reason, and unexplained ones are counted', () => {
  render(
    <ClosePreviewView
      preview={closePreview({
        unexplained: 1,
        diff: [{ member_id: 'm1', short_name: 'Eve', field: 'cum_savings', app: 300, workbook: 350, difference: -50, reason_code: 'unexplained' }],
      })}
    />,
  );
  expect(screen.getByText('Eve · Savings to date')).toBeInTheDocument();
  expect(screen.getByText('1 difference from the workbook is unexplained.')).toBeInTheDocument();
});

test('a member card shows interest earned this month and so far, since both are written into the locked statement', () => {
  render(<ClosePreviewView preview={closePreview({ members: [closeMember({ interest_earned: 12, interest_earned_to_date: 80 })] })} />);
  const card = screen.getByRole('group');
  expect(within(card).getByText('Interest earned this month').nextElementSibling).toHaveTextContent('K 12');
  expect(within(card).getByText('Interest earned so far').nextElementSibling).toHaveTextContent('K 80');
});
