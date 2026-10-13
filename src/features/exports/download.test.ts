import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { downloadBytes } from './download';

beforeEach(() => {
  vi.useFakeTimers();
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.useRealTimers());

test('hands the bytes to the browser as a named .xlsx download and releases the URL afterwards', () => {
  const clicked: Array<{ href: string; download: string }> = [];
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ href: this.href, download: this.download });
  });
  downloadBytes(new Uint8Array([1, 2, 3]), 'Premium VB Mar 2026.xlsx');
  expect(click).toHaveBeenCalledTimes(1);
  expect(clicked).toEqual([{ href: 'blob:fake', download: 'Premium VB Mar 2026.xlsx' }]);
  const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Blob;
  expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  expect(blob.size).toBe(3);
  expect(document.querySelector('a[download]')).toBeNull();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  vi.advanceTimersByTime(10_000);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  click.mockRestore();
});
