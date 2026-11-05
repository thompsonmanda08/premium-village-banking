import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// Script tests run under `// @vitest-environment node`, where there is no window.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// Newer Node versions ship their own `localStorage` global that is undefined without --localstorage-file and hides jsdom's.
// vitest exposes the jsdom instance as `jsdom`; its Storage is the real one (own enumerable keys, spy-able Storage.prototype).
const dom = (globalThis as { jsdom?: { window: Window & { Storage: typeof Storage } } }).jsdom;
if (dom && typeof globalThis.localStorage?.clear !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, configurable: true });
  Object.defineProperty(globalThis, 'Storage', { value: dom.window.Storage, configurable: true });
}
