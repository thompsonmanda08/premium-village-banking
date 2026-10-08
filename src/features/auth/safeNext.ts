// Whitespace anywhere is refused: URL parsers drop tab/newline, so "/\t/evil.example" would otherwise become "//evil.example".
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\') || /\s/.test(raw)) return '/';
  if (raw.startsWith('/sign-in') || raw.startsWith('/auth/')) return '/';
  return raw;
}
