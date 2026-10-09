export const FETCH_TIMEOUT_MS = 20_000;

/**
 * `fetch` that gives up after `ms` (a stalled request would otherwise leave a screen on its skeleton for ever) and
 * still honours the caller's own abort signal. The timeout rejects with a `TimeoutError`; friendlyError words it as a
 * slow or missing connection. `AbortSignal.any` / `.timeout` are missing before iOS 17.4, so those get an
 * AbortController, a timer and a forwarded abort instead.
 */
export const makeTimeoutFetch =
  (ms = FETCH_TIMEOUT_MS): typeof fetch =>
  (input, init) => {
    const caller = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    if (typeof AbortSignal.any === 'function' && typeof AbortSignal.timeout === 'function') {
      const timeout = AbortSignal.timeout(ms);
      return fetch(input, { ...init, signal: caller ? AbortSignal.any([caller, timeout]) : timeout });
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(new DOMException('The request timed out', 'TimeoutError')), ms);
    const forward = () => ctl.abort(caller?.reason);
    if (caller?.aborted) forward();
    else caller?.addEventListener('abort', forward, { once: true });
    return fetch(input, { ...init, signal: ctl.signal }).finally(() => {
      clearTimeout(timer);
      caller?.removeEventListener('abort', forward);
    });
  };

export const timeoutFetch = makeTimeoutFetch();
