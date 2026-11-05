import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { InfoTip } from './InfoTip';

test('a tap shows the explanation, Escape hides it', async () => {
  render(<InfoTip label="Penalty">Only enter a penalty on your statement.</InfoTip>);
  const button = screen.getByRole('button', { name: 'What is Penalty?' });
  expect(screen.queryByRole('tooltip')).toBeNull();
  await userEvent.click(button);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Only enter a penalty');
  expect(button).toHaveAttribute('aria-expanded', 'true');
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('tooltip')).toBeNull();
});

test('Enter toggles it, and a tap elsewhere closes it', async () => {
  render(<><InfoTip label="Penalty">Explained.</InfoTip><p>elsewhere</p></>);
  await userEvent.tab();
  await userEvent.keyboard('{Enter}');
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  await userEvent.keyboard('{Enter}');
  expect(screen.queryByRole('tooltip')).toBeNull();
  await userEvent.keyboard('{Enter}');
  await userEvent.click(screen.getByText('elsewhere'));
  expect(screen.queryByRole('tooltip')).toBeNull();
});
