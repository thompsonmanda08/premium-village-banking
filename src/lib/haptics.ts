/** A short buzz on Android for confirmed actions. iOS ignores it. */
export function haptic(ms = 12): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
}
