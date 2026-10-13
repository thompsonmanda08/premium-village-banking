import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { renderLedger, year } from '@/features/ledger/testFixtures';

const hooks = vi.hoisted(() => ({ cycle: vi.fn() }));
const actions = vi.hoisted(() => ({ exportMember: vi.fn() }));
const download = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/features/ledger/queries', async (orig) => ({ ...(await orig<typeof import('@/features/ledger/queries')>()), useLedgerCycle: () => hooks.cycle() }));
vi.mock('@/features/exports/exportActions', () => actions);
vi.mock('@/features/exports/download', () => ({ downloadBytes: download }));
const { MemberReportButton } = await import('./MemberReportButton');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const CYCLE = { id: 'c1', label: 'Cycle 2026' };

beforeEach(() => {
  actions.exportMember.mockReset();
  download.mockReset();
  actions.exportMember.mockResolvedValue({ bytes: new Uint8Array([1]), fileName: 'Test Group Eve Cycle 2026 through Sep 2026.xlsx' });
  hooks.cycle.mockReturnValue(ok({ cycle: CYCLE, periods: year(8) }));
});

test('pressing it exports that member’s report once and downloads the file', async () => {
  renderLedger(<MemberReportButton memberId="m1" memberName="Eve" />, { isAdmin: true });
  await userEvent.click(screen.getByRole('button', { name: 'Download Eve’s report' }));
  await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
  expect(actions.exportMember).toHaveBeenCalledTimes(1);
  expect(actions.exportMember.mock.calls[0]![0]).toMatchObject({ groupId: 'g1', groupName: 'Test Group', cycle: CYCLE });
  expect(actions.exportMember.mock.calls[0]![1]).toBe('m1');
  expect(download).toHaveBeenCalledWith(expect.any(Uint8Array), 'Test Group Eve Cycle 2026 through Sep 2026.xlsx');
});

test('a double press while it is preparing makes one file', async () => {
  let release: (v: unknown) => void = () => {};
  actions.exportMember.mockReturnValue(new Promise((resolve) => { release = resolve; }));
  renderLedger(<MemberReportButton memberId="m1" memberName="Eve" />, { isAdmin: true });
  const button = screen.getByRole('button', { name: 'Download Eve’s report' });
  await userEvent.click(button);
  await userEvent.click(button);
  expect(actions.exportMember).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  release({ bytes: new Uint8Array([1]), fileName: 'x.xlsx' });
  await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
});

test('it shows nothing until the cycle is known, and nothing without an active cycle', () => {
  hooks.cycle.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  const { unmount } = renderLedger(<MemberReportButton memberId="m1" memberName="Eve" />, { isAdmin: true });
  expect(screen.queryByRole('button')).toBeNull();
  unmount();
  hooks.cycle.mockReturnValue(ok({ cycle: null, periods: [] }));
  renderLedger(<MemberReportButton memberId="m1" memberName="Eve" />, { isAdmin: true });
  expect(screen.queryByRole('button')).toBeNull();
});
