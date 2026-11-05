import { supabase } from './supabase';

/** What the file picker offers. The server checks the real bytes again. */
export const PROOF_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
export const MAX_PROOF_BYTES = 4 * 1024 * 1024; // Vercel functions take request bodies up to 4.5 MB
const LONG_SIDE = 1600;

const fail = (code: string) => Object.assign(new Error(code), { code });

/**
 * Makes a picked file ready to send. A phone photo is shrunk to a 1600px JPEG (a payment screenshot stays readable and
 * usually lands under 500 KB); a PDF is sent as it is. Throws `invalid_file` or `file_too_large`.
 */
export async function prepareProof(file: File): Promise<Blob> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PROOF_BYTES) throw fail('file_too_large');
    return file;
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw fail('invalid_file');
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (blob && blob.size <= MAX_PROOF_BYTES) return blob;
  } catch {
    // No canvas or an image the browser cannot decode: fall through and send the original if it is small enough.
  }
  if (file.size > MAX_PROOF_BYTES) throw fail('file_too_large');
  return file;
}

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw fail('not_signed_in');
  return data.session.access_token;
}

/** Attaches a proof to a member's month through our own /api/proof (a Vercel Node function), as the signed-in user. */
export async function uploadProof(periodId: string, memberId: string, file: Blob): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`/api/proof?period=${encodeURIComponent(periodId)}&member=${encodeURIComponent(memberId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': file.type },
      body: file,
    });
  } catch (e) {
    throw (e as { code?: string }).code ? e : fail('upload_failed'); // network failure
  }
  const body = (await res.json().catch(() => null)) as { id?: unknown; error?: unknown } | null;
  if (res.ok && typeof body?.id === 'string') return body.id;
  throw fail(typeof body?.error === 'string' ? body.error : 'proof_failed');
}

/** The stored file as a blob URL the page can show; the caller revokes it. */
export async function fetchProof(id: string): Promise<{ url: string; type: string }> {
  const res = await fetch(`/api/proof?id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${await token()}` } });
  if (!res.ok) throw fail('proof_failed');
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };
}
