import { beforeEach, expect, test, vi } from 'vitest';

const session = vi.hoisted(() => ({ value: { access_token: 'tok' } as { access_token: string } | null }));
vi.mock('./supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: session.value } }) } } }));
const { prepareProof, uploadProof, MAX_PROOF_BYTES } = await import('./proof');

const fetchMock = vi.fn();
beforeEach(() => {
  session.value = { access_token: 'tok' };
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

const file = (type: string, size = 10) => new File([new Uint8Array(size)], 'f', { type });

test('only photos and PDFs are accepted; a PDF over 4 MB is too large; a small PDF goes as it is', async () => {
  await expect(prepareProof(file('text/plain'))).rejects.toMatchObject({ code: 'invalid_file' });
  await expect(prepareProof(file('application/pdf', MAX_PROOF_BYTES + 1))).rejects.toMatchObject({ code: 'file_too_large' });
  const pdf = file('application/pdf');
  expect(await prepareProof(pdf)).toBe(pdf);
});

test('a photo the browser cannot shrink is sent as it is when small, and refused when large', async () => {
  const small = file('image/jpeg');
  expect(await prepareProof(small)).toBe(small); // no canvas in the test browser
  await expect(prepareProof(file('image/jpeg', MAX_PROOF_BYTES + 1))).rejects.toMatchObject({ code: 'file_too_large' });
});

test('upload sends the file to the month with the member’s token and returns its id', async () => {
  fetchMock.mockResolvedValue(Response.json({ id: 'proof-1' }));
  expect(await uploadProof('p1', 'm1', file('image/jpeg'))).toBe('proof-1');
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe('/api/proof?period=p1&member=m1');
  expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'Content-Type': 'image/jpeg' });
});

test('upload failures keep the server’s code, and a dropped connection is upload_failed', async () => {
  fetchMock.mockResolvedValue(Response.json({ error: 'too_many_files' }, { status: 409 }));
  await expect(uploadProof('p1', 'm1', file('image/jpeg'))).rejects.toMatchObject({ code: 'too_many_files' });
  fetchMock.mockRejectedValue(new TypeError('network'));
  await expect(uploadProof('p1', 'm1', file('image/jpeg'))).rejects.toMatchObject({ code: 'upload_failed' });
  session.value = null;
  await expect(uploadProof('p1', 'm1', file('image/jpeg'))).rejects.toMatchObject({ code: 'not_signed_in' });
});
