// @vitest-environment node
import { expect, test } from 'vitest'
import { proofKey, sniffType } from './proof.js'

const bytes = (...n: number[]) => new Uint8Array(n)

test('files are recognised by their first bytes', () => {
  expect(sniffType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
  expect(sniffType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('image/png')
  expect(sniffType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe('image/webp')
  expect(sniffType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31))).toBe('application/pdf')
})

test('anything else, including an HTML page renamed to .jpg, is refused', () => {
  expect(sniffType(new TextEncoder().encode('<html><script>alert(1)</script>'))).toBeNull()
  expect(sniffType(bytes())).toBeNull()
  expect(sniffType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20))).toBeNull()
})

test('the key sits in the group and month folder, with a random name and the right extension', () => {
  const a = proofKey('g1', 'p1', 'application/pdf')
  const b = proofKey('g1', 'p1', 'application/pdf')
  expect(a).toMatch(/^proofs\/g1\/p1\/[0-9a-f-]{36}\.pdf$/)
  expect(a).not.toBe(b)
})
