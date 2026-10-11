import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Figure } from './Figure';
import { MemberScreen } from './MemberScreen';
import { renderLedger } from './testFixtures';

const q = (o: Partial<{ data: unknown; isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown }> = {}) => ({
  data: [], isPending: false, isError: false, error: null, refetch: vi.fn(), ...o,
});
const screenWith = (queries: ReturnType<typeof q>[]) => (
  <MemberScreen title="Passbook" subtitle="As at Sep 2026" loadingLabel="Loading your passbook" queries={queries}>
    <p>the content</p>
  </MemberScreen>
);

test('shows the content once every query has data', () => {
  renderLedger(screenWith([q(), q({ data: null })]));
  expect(screen.getByRole('heading', { name: 'Passbook' })).toBeInTheDocument();
  expect(screen.getByText('As at Sep 2026')).toBeInTheDocument();
  expect(screen.getByText('the content')).toBeInTheDocument();
});

test('an owner with no member row gets the unlinked message and no content', () => {
  renderLedger(screenWith([q()]), { member: null });
  expect(screen.getByText('Your account isn’t linked to a member')).toBeInTheDocument();
  expect(screen.queryByText('the content')).toBeNull();
});

test('loading shows a labelled skeleton and no content', () => {
  renderLedger(screenWith([q({ data: undefined, isPending: true })]));
  expect(screen.getByText('Loading your passbook')).toBeInTheDocument();
  expect(screen.queryByText('the content')).toBeNull();
});

test('a failed load with nothing to show offers a retry that refetches every query', async () => {
  const a = q({ data: undefined, isError: true, error: { message: 'x', code: 'PGRST301' } });
  const b = q();
  renderLedger(screenWith([a, b]));
  expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(a.refetch).toHaveBeenCalled();
  expect(b.refetch).toHaveBeenCalled();
});

test('a failed refetch that still has data keeps showing the data', () => {
  renderLedger(screenWith([q({ data: [], isError: true, error: { message: 'x' } })]));
  expect(screen.getByText('the content')).toBeInTheDocument();
});

test('Figure puts the label and the value in one tile', () => {
  renderLedger(<Figure label="You owe" value="K 700" note="As at Sep 2026" />);
  expect(screen.getByText('You owe').parentElement).toHaveTextContent('K 700');
});
