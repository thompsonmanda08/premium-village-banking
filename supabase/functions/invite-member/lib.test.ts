import { assertEquals, assertMatch, assertNotEquals, assertThrows } from 'jsr:@std/assert@1';
import { HttpError, corsOrigin, hashToken, inviteExpiry, makeToken, parseInviteRequest } from './lib.ts';

Deno.test('makeToken returns 43 url-safe characters and never repeats', () => {
  const a = makeToken();
  const b = makeToken();
  assertMatch(a, /^[A-Za-z0-9_-]{43}$/);
  assertNotEquals(a, b);
});

Deno.test('hashToken matches Postgres encode(digest(token, sha256), hex)', async () => {
  assertEquals(await hashToken('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

Deno.test('inviteExpiry is 14 days out', () => {
  assertEquals(inviteExpiry(new Date('2027-01-01T00:00:00Z')), '2027-01-15T00:00:00.000Z');
});

Deno.test('parseInviteRequest normalises email', () => {
  const id = '6f1c7a52-6a1b-4c6e-9a43-2b0a9f0b1c2d';
  assertEquals(parseInviteRequest({ memberId: id, email: '  Tafara@Example.COM ' }), { memberId: id, email: 'tafara@example.com' });
});

Deno.test('parseInviteRequest rejects bad input with 400', () => {
  for (const body of [null, 'x', { memberId: 'nope', email: 'a@b.co' }, { memberId: '6f1c7a52-6a1b-4c6e-9a43-2b0a9f0b1c2d', email: 'not-an-email' }]) {
    const err = assertThrows(() => parseInviteRequest(body), HttpError);
    assertEquals(err.status, 400);
  }
});

const SITE = 'https://site.example';

Deno.test('corsOrigin reflects SITE_URL and every allowlisted origin', () => {
  const env = 'http://localhost:3000,http://127.0.0.1:3000';
  assertEquals(corsOrigin(SITE, SITE, env), SITE);
  assertEquals(corsOrigin('http://localhost:3000', SITE, env), 'http://localhost:3000');
  assertEquals(corsOrigin('http://127.0.0.1:3000', SITE, env), 'http://127.0.0.1:3000');
});

Deno.test('corsOrigin falls back to SITE_URL for unknown or missing origins', () => {
  const env = 'http://localhost:3000';
  assertEquals(corsOrigin('https://evil.example', SITE, env), SITE);
  assertEquals(corsOrigin(null, SITE, env), SITE);
  assertEquals(corsOrigin('', SITE, env), SITE);
  assertEquals(corsOrigin('http://localhost:3000', SITE, undefined), SITE);
});

Deno.test('corsOrigin trims entries, ignores empty ones and never matches a bare empty origin', () => {
  const env = ' http://localhost:3000 ,, ,https://preview.example ,';
  assertEquals(corsOrigin('http://localhost:3000', SITE, env), 'http://localhost:3000');
  assertEquals(corsOrigin('https://preview.example', SITE, env), 'https://preview.example');
  assertEquals(corsOrigin('', SITE, env), SITE);
});

Deno.test('corsOrigin is exact-match only: no lookalikes, prefixes, wildcards or trailing slashes', () => {
  assertEquals(corsOrigin('https://site.example.evil.com', SITE, undefined), SITE);
  assertEquals(corsOrigin('https://evil.site.example', SITE, undefined), SITE);
  assertEquals(corsOrigin('https://site.example/', SITE, undefined), SITE);
  assertEquals(corsOrigin('https://anything.example', SITE, '*'), SITE);
  assertEquals(corsOrigin('https://x.preview.example', SITE, 'https://*.preview.example'), SITE);
});
