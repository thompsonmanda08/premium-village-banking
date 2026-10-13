import { useCallback, useRef, useState } from 'react';
import { friendlyError } from '@/lib/errors';
import { useToast } from '@/ui';
import { downloadBytes } from './download';
import type { ExportResult } from './exportActions';

/**
 * Runs one export at a time. A second press while one is running does nothing (a ref, so even a double tap before the next render is caught);
 * success downloads the file and says so; failure shows the friendly sentence and downloads nothing.
 */
export function useExportRunner() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);
  const run = useCallback(
    async (key: string, job: () => Promise<ExportResult>): Promise<void> => {
      if (lock.current) return;
      lock.current = true;
      setBusy(key);
      try {
        const out = await job();
        downloadBytes(out.bytes, out.fileName);
        toast(`${out.fileName} downloaded.${out.note ? ` ${out.note}` : ''}`, { tone: 'success' });
      } catch (err) {
        toast(friendlyError(err), { tone: 'danger' });
      } finally {
        lock.current = false;
        setBusy(null);
      }
    },
    [toast],
  );
  return { busy, run };
}
