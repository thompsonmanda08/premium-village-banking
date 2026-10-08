export type MemberFormValues = { full_name: string; short_name: string; email: string };

// Mirrors the checks on public.members, so a refusal never has to come back from the database.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const defaultShortName = (fullName: string): string => fullName.trim().split(/\s+/)[0] ?? '';

export function validateMember(f: MemberFormValues): Partial<Record<keyof MemberFormValues, string>> {
  const e: Partial<Record<keyof MemberFormValues, string>> = {};
  const full = f.full_name.trim();
  const short = f.short_name.trim();
  const email = f.email.trim();
  if (!full) e.full_name = 'Enter the member’s full name.';
  else if (full.length > 120) e.full_name = 'Use 120 characters or fewer.';
  if (!short) e.short_name = 'Enter a short name.';
  else if (short.length > 40) e.short_name = 'Use 40 characters or fewer.';
  if (email && !EMAIL.test(email)) e.email = 'Enter a valid email address.';
  return e;
}
