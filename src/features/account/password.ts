export type PasswordProblem = 'password_too_short' | 'password_needs_letters_digits' | 'password_mismatch';

/**
 * Same rules as the server (supabase/config.toml: minimum_password_length = 12, password_requirements = "letters_digits"),
 * so a doomed password is stopped on the phone. Returns a code for friendlyError(), never display text.
 */
export function checkPassword(password: string, confirm: string): PasswordProblem | null {
  if (password.length < 12) return 'password_too_short';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'password_needs_letters_digits';
  if (password !== confirm) return 'password_mismatch';
  return null;
}
