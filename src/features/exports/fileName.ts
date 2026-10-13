const REJECTED = /[\\/:*?"<>|]/g;

/** A name every file system accepts: the characters \ / : * ? " < > | and control characters become spaces, spaces collapse. */
export function safeFileName(name: string): string {
  const printable = Array.from(name, (c) => (c.charCodeAt(0) < 32 ? ' ' : c)).join('');
  return printable.replace(REJECTED, ' ').replace(/\s+/g, ' ').trim();
}

/** `Premium VB Mar 2026.xlsx` from parts; blank parts are skipped. */
export function xlsxName(...parts: string[]): string {
  const base = safeFileName(parts.filter((p) => p.trim() !== '').join(' ')).slice(0, 120).trim();
  return `${base || 'Export'}.xlsx`;
}
