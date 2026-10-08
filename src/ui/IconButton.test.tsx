import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { IconButton } from './IconButton';

test('labels the button with the waiting count and caps the visible count at 99+', () => {
  const { rerender } = render(<IconButton label="Alerts" icon={<svg />} badge={7} />);
  expect(screen.getByRole('button', { name: 'Alerts, 7 waiting' })).toHaveTextContent('7');
  rerender(<IconButton label="Alerts" icon={<svg />} badge={150} />);
  const btn = screen.getByRole('button', { name: 'Alerts, 150 waiting' });
  expect(btn).toHaveTextContent('99+');
  expect(btn).not.toHaveTextContent('150');
});
