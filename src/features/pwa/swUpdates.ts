const HOUR = 60 * 60 * 1000;
const watched = new WeakSet<ServiceWorkerRegistration>();

// An installed app resumed from the app switcher can sit on an old build for days, so ask for a new one hourly and on return.
// Once per registration: the hook can run again on remount, and intervals must not stack.
export function watchForUpdates(registration: ServiceWorkerRegistration) {
  if (watched.has(registration)) return;
  watched.add(registration);
  const check = () => {
    registration.update().catch(() => {
      // Offline or the server is unreachable: try again at the next tick.
    });
  };
  setInterval(check, HOUR);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}
