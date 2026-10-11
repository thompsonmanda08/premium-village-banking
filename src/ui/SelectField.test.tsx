import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { SelectField } from './SelectField';

test('a labelled select that reports the choice', async () => {
  const onChange = vi.fn();
  render(
    <SelectField label="Wallet" value="" onChange={onChange}>
      <option value="">Choose</option>
      <option value="w1">Airtel</option>
    </SelectField>,
  );
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  expect(onChange).toHaveBeenCalled();
});

test('an error is announced and linked to the select', () => {
  render(
    <SelectField label="Wallet" error="Choose a wallet." defaultValue="">
      <option value="">Choose</option>
    </SelectField>,
  );
  const select = screen.getByLabelText('Wallet');
  expect(select).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a wallet.');
  expect(select.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
});
