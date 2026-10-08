import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Badge } from './Badge';

test('shows a text label with a decorative glyph', () => {
  const { container } = render(<Badge tone="warning">Pending</Badge>);
  expect(screen.getByText('Pending')).toBeInTheDocument();
  const svg = container.querySelector('svg');
  expect(svg).not.toBeNull();
  expect(svg).toHaveAttribute('aria-hidden', 'true');
});
