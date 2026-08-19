import { useCallback, useEffect, useMemo, useState } from 'react';

export type CharState = 'correct' | 'incorrect' | 'current' | 'untyped';

export interface TypingChar {
  char: string;
  state: CharState;
}

export interface TypingStats {
  wpm: number;
  accuracy: number;
  progress: number;
  elapsedMs: number;
  correctChars: number;
  totalTyped: number;
}

export interface TypingEngine {
  input: string;
  chars: TypingChar[];
  stats: TypingStats;
  isComplete: boolean;
  startedAt: number | null;
  endedAt: number | null;
  handleInputChange: (value: string) => void;
  reset: () => void;
}

/**
 * Strict typing engine.
 * - Users can freely type and backspace via the controlled input.
 * - `progress` reflects only the leading run of consecutive correct chars,
 *   so an error blocks forward progress until it is fixed.
 * - `wpm` is derived from that same leading-correct count so speed reflects
 *   real advancement, not raw keystrokes.
 * - `accuracy` counts position-matched characters against total typed chars.
 * - `isComplete` is a strict full-string equality check.
 */
export function useTypingEngine(target: string): TypingEngine {
  const [input, setInput] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // Reset on target change via the "adjust state during render" pattern.
  // See https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevTarget, setPrevTarget] = useState(target);
  if (target !== prevTarget) {
    // nowTick doesn't need resetting here — when startedAt is null,
    // elapsedMs is 0 regardless; the interval effect refreshes nowTick
    // once the user starts typing again.
    setPrevTarget(target);
    setInput('');
    setStartedAt(null);
    setEndedAt(null);
  }

  useEffect(() => {
    if (!startedAt || endedAt) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [startedAt, endedAt]);

  const isComplete = input.length === target.length && input === target;

  const handleInputChange = useCallback(
    (value: string) => {
      if (endedAt) return;
      const capped =
        value.length > target.length ? value.slice(0, target.length) : value;
      const now = Date.now();
      if (!startedAt && capped.length > 0) {
        setStartedAt(now);
      }
      setInput(capped);
      if (capped.length === target.length && capped === target) {
        setEndedAt(now);
      }
    },
    [startedAt, endedAt, target],
  );

  const reset = useCallback(() => {
    setInput('');
    setStartedAt(null);
    setEndedAt(null);
    setNowTick(Date.now());
  }, []);

  const chars = useMemo<TypingChar[]>(() => {
    return target.split('').map((char, i) => {
      let state: CharState;
      if (i < input.length) {
        state = input[i] === char ? 'correct' : 'incorrect';
      } else if (i === input.length) {
        state = 'current';
      } else {
        state = 'untyped';
      }
      return { char, state };
    });
  }, [target, input]);

  const stats = useMemo<TypingStats>(() => {
    let leading = 0;
    for (let i = 0; i < input.length && i < target.length; i++) {
      if (input[i] === target[i]) leading++;
      else break;
    }

    let matched = 0;
    for (let i = 0; i < input.length && i < target.length; i++) {
      if (input[i] === target[i]) matched++;
    }

    const totalTyped = input.length;
    const endTs = endedAt ?? nowTick;
    const elapsedMs = startedAt ? Math.max(0, endTs - startedAt) : 0;
    const elapsedMin = elapsedMs / 60000;

    const wpm = elapsedMin > 0 ? Math.round(leading / 5 / elapsedMin) : 0;
    const accuracy =
      totalTyped > 0 ? Math.round((matched / totalTyped) * 100) : 100;
    const progress =
      target.length > 0 ? Math.round((leading / target.length) * 100) : 0;

    return {
      wpm,
      accuracy,
      progress,
      elapsedMs,
      correctChars: leading,
      totalTyped,
    };
  }, [target, input, startedAt, endedAt, nowTick]);

  return {
    input,
    chars,
    stats,
    isComplete,
    startedAt,
    endedAt,
    handleInputChange,
    reset,
  };
}
