import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { Sheet } from './Sheet';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Settings">
        <button>Inside</button>
      </Sheet>
    </>
  );
}

test('opens as a labelled modal dialog, closes on Escape, and returns focus', async () => {
  render(<Harness />);
  const opener = screen.getByRole('button', { name: 'Open' });
  await userEvent.click(opener);
  const dialog = screen.getByRole('dialog', { name: 'Settings' });
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(opener).toHaveFocus();
});

test('closes from the close button', async () => {
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('keeps Shift+Tab inside the dialog from a freshly opened sheet, and wraps Tab from the last element', async () => {
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  const dialog = screen.getByRole('dialog', { name: 'Settings' });
  expect(dialog).toHaveFocus();

  await userEvent.tab({ shift: true });
  expect(dialog).toContainElement(document.activeElement as HTMLElement);
  expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus();

  await userEvent.tab();
  expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
});
