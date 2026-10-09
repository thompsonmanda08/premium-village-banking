import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { FETCH_TIMEOUT_MS, makeTimeoutFetch } from './timeoutFetch';

// A fetch that never answers on its own, but rejects with the signal's reason when it is aborted, like the real one.
const hangingFetch = () =>
  vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      if (init?.signal?.aborted) reject(init.signal.reason);
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
    });
  });

const settled = (p: Promise<unknown>) => p.then(() => 'resolved', (e: unknown) => e);
const nameOf = (e: unknown) => (e as { name?: string }).name;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// iOS before 17.4 has neither AbortSignal.any nor AbortSignal.timeout; remove them so the fallback is what runs.
describe('without AbortSignal.any / AbortSignal.timeout', () => {
  const saved = { any: AbortSignal.any, timeout: AbortSignal.timeout };
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(AbortSignal, 'any', { value: undefined, configurable: true, writable: true });
    Object.defineProperty(AbortSignal, 'timeout', { value: undefined, configurable: true, writable: true });
  });
  afterEach(() => {
    Object.defineProperty(AbortSignal, 'any', { value: saved.any, configurable: true, writable: true });
    Object.defineProperty(AbortSignal, 'timeout', { value: saved.timeout, configurable: true, writable: true });
  });

  test('a request that never answers rejects with a TimeoutError after the timeout', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const result = settled(makeTimeoutFetch()('https://x.example/rest'));
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS - 1);
    let early = true;
    void result.then(() => (early = false));
    await vi.advanceTimersByTimeAsync(0);
    expect(early).toBe(true); // still waiting just before the deadline
    await vi.advanceTimersByTimeAsync(1);
    expect(nameOf(await result)).toBe('TimeoutError');
  });

  test('the caller can still abort, and its reason comes through', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const caller = new AbortController();
    const result = settled(makeTimeoutFetch()('https://x.example/rest', { signal: caller.signal }));
    caller.abort(new DOMException('cancelled', 'AbortError'));
    expect(nameOf(await result)).toBe('AbortError');
    expect(vi.getTimerCount()).toBe(0); // no timer left running
  });

  test('an already-aborted caller signal aborts straight away', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const result = settled(makeTimeoutFetch()('https://x.example/rest', { signal: AbortSignal.abort() }));
    expect(nameOf(await result)).toBe('AbortError');
  });

  test('a fast response passes through untouched and clears the timer', async () => {
    const response = new Response('{}');
    const fake = vi.fn<typeof fetch>(async () => response);
    vi.stubGlobal('fetch', fake);
    const caller = new AbortController();
    await expect(makeTimeoutFetch()('https://x.example/rest', { method: 'POST', signal: caller.signal })).resolves.toBe(response);
    expect(fake.mock.calls[0]![1]).toMatchObject({ method: 'POST' });
    expect(vi.getTimerCount()).toBe(0);
  });
});

test('native: the same three behaviours with AbortSignal.any and AbortSignal.timeout', async () => {
  expect(typeof AbortSignal.any).toBe('function');
  expect(typeof AbortSignal.timeout).toBe('function');
  vi.stubGlobal('fetch', hangingFetch());
  const quick = makeTimeoutFetch(30);
  expect(nameOf(await settled(quick('https://x.example/rest')))).toBe('TimeoutError');
  const caller = new AbortController();
  const aborted = settled(quick('https://x.example/rest', { signal: caller.signal }));
  caller.abort(new DOMException('cancelled', 'AbortError'));
  expect(nameOf(await aborted)).toBe('AbortError');
  const response = new Response('{}');
  vi.stubGlobal('fetch', vi.fn(async () => response));
  await expect(makeTimeoutFetch(30)('https://x.example/rest')).resolves.toBe(response);
});
