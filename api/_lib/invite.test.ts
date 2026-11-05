// @vitest-environment node
import { expect, test } from 'vitest'
import { HttpError, hashToken, inviteExpiry, inviteLink, isRateLimited, makeToken, parseInviteRequest, trimSlashes } from './invite.js'

test('makeToken returns 43 url-safe characters and never repeats', () => {
  const a = makeToken()
  expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(makeToken()).not.toBe(a)
})

test('hashToken matches Postgres encode(digest(token, sha256), hex)', async () => {
  expect(await hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

test('inviteExpiry is 14 days out', () => {
  expect(inviteExpiry(new Date('2027-01-01T00:00:00Z'))).toBe('2027-01-15T00:00:00.000Z')
})

const id = '6f1c7a52-6a1b-4c6e-9a43-2b0a9f0b1c2d'

test('parseInviteRequest normalises email', () => {
  expect(parseInviteRequest({ memberId: id, email: '  Tafara@Example.COM ' })).toEqual({ memberId: id, email: 'tafara@example.com' })
})

test('parseInviteRequest rejects bad input with 400', () => {
  for (const body of [null, 'x', { memberId: 'nope', email: 'a@b.co' }, { memberId: id, email: 'not-an-email' }]) {
    expect(() => parseInviteRequest(body)).toThrow(HttpError)
    try {
      parseInviteRequest(body)
    } catch (e) {
      expect((e as HttpError).status).toBe(400)
    }
  }
})

test('trimSlashes drops trailing slashes and surrounding spaces only', () => {
  expect(trimSlashes('https://site.example/')).toBe('https://site.example')
  expect(trimSlashes(' https://site.example/// ')).toBe('https://site.example')
  expect(trimSlashes('https://site.example/app')).toBe('https://site.example/app')
  expect(trimSlashes('/')).toBe('')
})

test('inviteLink has a single slash whether or not SITE_URL ends in one', () => {
  for (const site of ['https://site.example', 'https://site.example/', 'https://site.example//'])
    expect(inviteLink(site, 'tok')).toBe('https://site.example/invite/tok')
})

test('isRateLimited recognises GoTrue 429s and its rate-limit codes only', () => {
  expect(isRateLimited({ status: 429 })).toBe(true)
  expect(isRateLimited({ status: 400, code: 'over_email_send_rate_limit' })).toBe(true)
  expect(isRateLimited({ code: 'over_request_rate_limit' })).toBe(true)
  expect(isRateLimited({ status: 422, code: 'email_exists' })).toBe(false)
  expect(isRateLimited({ status: 500 })).toBe(false)
  expect(isRateLimited({})).toBe(false)
})
