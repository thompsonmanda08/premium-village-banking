import { useCallback, useEffect, useRef, useState } from 'react';

export function useConfirmTap(onConfirm: () => void, timeoutMs = 4000) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const tap = useCallback(() => {
    if (armed) {
      window.clearTimeout(timer.current);
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timer.current = window.setTimeout(() => setArmed(false), timeoutMs);
  }, [armed, onConfirm, timeoutMs]);

  const reset = useCallback(() => {
    window.clearTimeout(timer.current);
    setArmed(false);
  }, []);

  return { armed, tap, reset };
}
