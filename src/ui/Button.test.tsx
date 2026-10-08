import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Button } from './Button';

test('fires onClick', async () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>Save</Button>);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onClick).toHaveBeenCalledOnce();
});

test('is disabled and busy while loading', () => {
  render(<Button isLoading>Save</Button>);
  const btn = screen.getByRole('button', { name: 'Save' });
  expect(btn).toBeDisabled();
  expect(btn).toHaveAttribute('aria-busy', 'true');
});

test('defaults to type=button so it never submits forms by accident', () => {
  render(<Button>Go</Button>);
  expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
});
