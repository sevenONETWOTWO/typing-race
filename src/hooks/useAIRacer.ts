import { useCallback, useEffect, useRef, useState } from 'react';

export interface AIRacer {
  /** 0–100. Updated on a 100ms timer while `running` is true. */
  progress: number;
  isDone: boolean;
  /** Clear progress + start-time. Call between races before starting again. */
  reset: () => void;
}

/**
 * Advance an AI opponent's progress at a fixed characters-per-second rate.
 *
 * - `running=false → true`: capture start time (if not already set) and begin
 *   ticking every 100ms. On the very first true, progress resets to 0 via the
 *   startRef=null branch, so the AI's clock always begins at the moment the
 *   race starts (not when the hook mounts).
 * - `running=true → false`: stop the timer but leave progress untouched so
 *   the results screen can still display where the AI ended up.
 * - `reset()`: clear progress and start-time. Call before kicking off a new
 *   race so the previous ending progress doesn't briefly bleed into the
 *   countdown UI.
 *
 * The 100ms tick pairs with a CSS `transition: width 100ms` on the progress
 * bar to keep motion smooth between updates.
 */
export function useAIRacer(
  targetLength: number,
  charsPerSecond: number,
  running: boolean,
): AIRacer {
  const [progress, setProgress] = useState<number>(0);
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (startRef.current === null) {
      startRef.current = Date.now();
      setProgress(0);
    }

    const tick = () => {
      if (startRef.current === null) return;
      const elapsedSec = (Date.now() - startRef.current) / 1000;
      const chars = elapsedSec * charsPerSecond;
      const pct =
        targetLength > 0
          ? Math.min(100, (chars / targetLength) * 100)
          : 100;
      setProgress(pct);
      if (pct < 100) {
        timerRef.current = window.setTimeout(tick, 100);
      } else {
        timerRef.current = null;
      }
    };

    timerRef.current = window.setTimeout(tick, 100);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [running, charsPerSecond, targetLength]);

  const reset = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
    setProgress(0);
  }, []);

  return { progress, isDone: progress >= 100, reset };
}
