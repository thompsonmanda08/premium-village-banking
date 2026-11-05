export const MAX_PROOF_BYTES = 4 * 1024 * 1024; // Vercel functions accept request bodies up to 4.5 MB

export const PROOF_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' } as const;
export type ProofType = keyof typeof PROOF_TYPES;

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** What a file really is, from its first bytes: the declared type is only believed when it agrees. */
export function sniffType(b: Uint8Array): ProofType | null {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  return null;
}

/** A random key inside the group's own folder; the file name from the phone is never used. */
export const proofKey = (groupId: string, periodId: string, type: ProofType): string =>
  `proofs/${groupId}/${periodId}/${crypto.randomUUID()}.${PROOF_TYPES[type]}`;
