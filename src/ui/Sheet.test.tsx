import { fireEvent, render, screen } from '@testing-library/react';
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

// A drawer of <details> rows: the row headers (<summary>) are keyboard stops, the content of a closed row is not.
function RowsHarness() {
  return (
    <Sheet open onClose={() => {}} title="Rows">
      <button>First</button>
      <button>Middle</button>
      <details>
        <summary>Row</summary>
        <button>Hidden while closed</button>
      </details>
    </Sheet>
  );
}

const tab = (shiftKey = false) => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab', shiftKey });

test('a <summary> is a keyboard stop: Tab reaches it, and from it Tab wraps to the first element', () => {
  render(<RowsHarness />);
  const summary = screen.getByText('Row');
  screen.getByRole('button', { name: 'Middle' }).focus();
  expect(tab()).toBe(true); // not intercepted: the browser moves on to the summary
  summary.focus();
  expect(summary).toHaveFocus();
  expect(tab()).toBe(false); // intercepted: the summary is the last stop, not the closed row's button
  expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
});

test('Shift+Tab from the first element wraps to the last stop, the summary', () => {
  render(<RowsHarness />);
  screen.getByRole('button', { name: 'Close' }).focus();
  expect(tab(true)).toBe(false);
  expect(screen.getByText('Row')).toHaveFocus();
});

test('an open row puts its own controls in the trap', () => {
  render(
    <Sheet open onClose={() => {}} title="Rows">
      <details open>
        <summary>Row</summary>
        <button>Inside the row</button>
      </details>
    </Sheet>,
  );
  const inside = screen.getByRole('button', { name: 'Inside the row' });
  inside.focus();
  expect(tab()).toBe(false);
  expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
});
