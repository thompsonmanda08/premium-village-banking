import { act, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/ui';

const download = vi.hoisted(() => vi.fn());
vi.mock('./download', () => ({ downloadBytes: download }));
const { useExportRunner } = await import('./useExportRunner');

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
const file = { bytes: new Uint8Array([1]), fileName: 'Test Group Apr 2026.xlsx' };

beforeEach(() => download.mockReset());

test('two presses in the same instant, before the screen can update, run the export once', async () => {
  const { result } = renderHook(() => useExportRunner(), { wrapper });
  const job = vi.fn().mockResolvedValue(file);
  await act(async () => {
    void result.current.run('month', job);
    void result.current.run('period', job); // arrives before React has re-rendered the disabled buttons
  });
  expect(job).toHaveBeenCalledTimes(1);
  expect(download).toHaveBeenCalledTimes(1);
});

test('a finished export downloads the file, says so, and frees the runner', async () => {
  const { result } = renderHook(() => useExportRunner(), { wrapper });
  await act(async () => { await result.current.run('month', async () => ({ ...file, note: 'May 2026 is left out: declarations are still waiting.' })); });
  expect(download).toHaveBeenCalledWith(file.bytes, file.fileName);
  expect(screen.getByText('Test Group Apr 2026.xlsx downloaded. May 2026 is left out: declarations are still waiting.')).toBeInTheDocument();
  expect(result.current.busy).toBeNull();
  const again = vi.fn().mockResolvedValue(file);
  await act(async () => { await result.current.run('month', again); });
  expect(again).toHaveBeenCalledTimes(1); // not stuck busy
});

test('a failed export downloads nothing, shows the friendly sentence and frees the runner', async () => {
  const { result } = renderHook(() => useExportRunner(), { wrapper });
  await act(async () => { await result.current.run('month', async () => { throw { message: 'declarations_pending', code: 'P0001' }; }); });
  expect(download).not.toHaveBeenCalled();
  expect(screen.getByText('Some declarations are still waiting. Approve or return them first.')).toBeInTheDocument();
  expect(result.current.busy).toBeNull();
});
