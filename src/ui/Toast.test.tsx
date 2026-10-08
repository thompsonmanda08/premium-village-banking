import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider, useToast } from './Toast';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function Trigger({ onUndo }: { onUndo: () => void }) {
  const toast = useToast();
  return <button onClick={() => toast('Saved', { action: { label: 'Undo', onClick: onUndo } })}>Show</button>;
}

function setup(onUndo = vi.fn()) {
  render(
    <ToastProvider>
      <Trigger onUndo={onUndo} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Show' }));
  return { onUndo, undo: () => screen.getByRole('button', { name: 'Undo' }) };
}

test('action click fires once and dismisses the toast', () => {
  const { onUndo, undo } = setup();
  fireEvent.click(undo());
  expect(onUndo).toHaveBeenCalledOnce();
  expect(screen.queryByText('Saved')).toBeNull();
  act(() => void vi.advanceTimersByTime(6000));
  expect(onUndo).toHaveBeenCalledOnce();
});

test('auto-dismisses after 5s', () => {
  setup();
  act(() => void vi.advanceTimersByTime(4900));
  expect(screen.getByText('Saved')).toBeInTheDocument();
  act(() => void vi.advanceTimersByTime(200));
  expect(screen.queryByText('Saved')).toBeNull();
});

test('stays while focus is inside, then dismisses ~5s after blur', () => {
  const { undo } = setup();
  act(() => undo().focus());
  act(() => void vi.advanceTimersByTime(6000));
  expect(screen.getByText('Saved')).toBeInTheDocument();
  act(() => undo().blur());
  act(() => void vi.advanceTimersByTime(4900));
  expect(screen.getByText('Saved')).toBeInTheDocument();
  act(() => void vi.advanceTimersByTime(200));
  expect(screen.queryByText('Saved')).toBeNull();
});

test('stays while hovered, then dismisses ~5s after the pointer leaves', () => {
  setup();
  const toast = screen.getByText('Saved').parentElement as HTMLElement;
  fireEvent.mouseEnter(toast);
  act(() => void vi.advanceTimersByTime(6000));
  expect(screen.getByText('Saved')).toBeInTheDocument();
  fireEvent.mouseLeave(toast);
  act(() => void vi.advanceTimersByTime(5100));
  expect(screen.queryByText('Saved')).toBeNull();
});

test('clears pending timers on unmount', () => {
  const { unmount } = render(
    <ToastProvider>
      <Trigger onUndo={() => {}} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Show' }));
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
