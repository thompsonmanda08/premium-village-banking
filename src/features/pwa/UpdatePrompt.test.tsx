import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

const sw = vi.hoisted(() => ({ needRefresh: false, setNeedRefresh: vi.fn(), updateServiceWorker: vi.fn(async () => {}) }));
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [sw.needRefresh, sw.setNeedRefresh],
    offlineReady: [false, () => {}],
    updateServiceWorker: sw.updateServiceWorker,
  }),
}));
const { UpdatePrompt } = await import('./UpdatePrompt');

beforeEach(() => {
  sw.needRefresh = false;
  sw.setNeedRefresh.mockClear();
  sw.updateServiceWorker.mockClear();
});

test('renders nothing until an update is waiting', () => {
  render(<UpdatePrompt />);
  expect(screen.queryByRole('status')).toBeNull();
});

test('Update activates the waiting service worker and reloads', async () => {
  sw.needRefresh = true;
  render(<UpdatePrompt />);
  await userEvent.click(screen.getByRole('button', { name: 'Update' }));
  expect(sw.updateServiceWorker).toHaveBeenCalledWith(true);
});

test('Later dismisses the prompt without updating', async () => {
  sw.needRefresh = true;
  render(<UpdatePrompt />);
  await userEvent.click(screen.getByRole('button', { name: 'Later' }));
  expect(sw.setNeedRefresh).toHaveBeenCalledWith(false);
  expect(sw.updateServiceWorker).not.toHaveBeenCalled();
});
