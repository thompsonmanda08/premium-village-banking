// Captured at module scope (imported first thing from main.tsx): Android fires `beforeinstallprompt` once, usually before the
// signed-in shell mounts, so a listener added by the component would miss it.
export type InstallEvent = Event & { prompt: () => Promise<void> };

let stored: InstallEvent | null = null;
const listeners = new Set<() => void>();

function set(next: InstallEvent | null) {
  stored = next;
  listeners.forEach((l) => l());
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  set(e as InstallEvent);
});
window.addEventListener('appinstalled', () => set(null));

export const getInstallPrompt = () => stored;
export const clearInstallPrompt = () => set(null);
export const subscribeInstallPrompt = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
