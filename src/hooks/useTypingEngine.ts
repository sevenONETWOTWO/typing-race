import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Language } from '../data/texts';

export type CharState = 'correct' | 'incorrect' | 'current' | 'untyped';

export interface TypingChar {
  char: string;
  state: CharState;
}

export interface TypingStats {
  wpm: number;
  cpm: number;
  accuracy: number;
  progress: number;
  elapsedMs: number;
  correctChars: number;
  totalTyped: number;
}

export interface TypingEngine {
  /** Value bound to the controlled input element. During IME composition this
   *  can contain the in-progress pinyin so the candidate box behaves correctly. */
  rawInput: string;
  /** Only the finalized characters. All comparison/coloring uses this. */
  committedInput: string;
  chars: TypingChar[];
  stats: TypingStats;
  isComplete: boolean;
  startedAt: number | null;
  endedAt: number | null;
  handleInputChange: (value: string) => void;
  handleCompositionStart: () => void;
  handleCompositionEnd: (value: string) => void;
  reset: () => void;
}

/**
 * Strict typing engine with IME (composition) support.
 *
 * Design:
 * - `rawInput` mirrors the DOM input value so IME candidate boxes work naturally.
 * - `committedInput` is only updated when we're NOT mid-composition
 *   (or when compositionend hands us a finalized string). All comparison,
 *   coloring, progress, WPM/CPM and completion checks use `committedInput`.
 * - `progress` uses the leading run of consecutive correct chars, so a
 *   wrong character blocks forward progress until it's fixed.
 * - `wpm` = leading-correct / 5 / minutes (English convention).
 * - `cpm` = leading-correct / minutes (Chinese convention — chars per minute,
 *   not divided by 5). Both are exposed; UI picks based on `lang`.
 * - `accuracy` counts position-matched chars against total committed chars.
 * - `isComplete` is a strict full-string equality on committedInput.
 */
export function useTypingEngine(
  target: string,
  lang: Language = 'en',
): TypingEngine {
  const [rawInput, setRawInput] = useState('');
  const [committedInput, setCommittedInput] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const composingRef = useRef<boolean>(false);

  // Reset on target OR lang change via the "adjust state during render" pattern.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevTarget, setPrevTarget] = useState(target);
  const [prevLang, setPrevLang] = useState(lang);
  if (target !== prevTarget || lang !== prevLang) {
    setPrevTarget(target);
    setPrevLang(lang);
    setRawInput('');
    setCommittedInput('');
    setStartedAt(null);
    setEndedAt(null);
    // composingRef is reset in the effect below (writing to refs during
    // render is disallowed; browser will also fire compositionend when the
    // input value is programmatically cleared).
  }

  useEffect(() => {
    composingRef.current = false;
  }, [target, lang]);

  useEffect(() => {
    if (!startedAt || endedAt) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [startedAt, endedAt]);

  const commit = useCallback(
    (value: string) => {
      if (endedAt) return;
      const capped =
        value.length > target.length ? value.slice(0, target.length) : value;
      const now = Date.now();
      if (!startedAt && capped.length > 0) {
        setStartedAt(now);
      }
      setRawInput(capped);
      setCommittedInput(capped);
      if (capped.length === target.length && capped === target) {
        setEndedAt(now);
      }
    },
    [startedAt, endedAt, target],
  );

  const handleInputChange = useCallback(
    (value: string) => {
      if (endedAt) return;
      if (composingRef.current) {
        // Mid-composition (IME pinyin buffer). Keep the DOM display in sync
        // but do NOT commit — comparison/coloring stays frozen at the last
        // committed value.
        setRawInput(value);
        return;
      }
      commit(value);
    },
    [endedAt, commit],
  );

  const handleCompositionStart = useCallback(() => {
    if (endedAt) return;
    composingRef.current = true;
  }, [endedAt]);

  const handleCompositionEnd = useCallback(
    (value: string) => {
      composingRef.current = false;
      if (endedAt) return;
      commit(value);
    },
    [endedAt, commit],
  );

  const reset = useCallback(() => {
    setRawInput('');
    setCommittedInput('');
    setStartedAt(null);
    setEndedAt(null);
    composingRef.current = false;
  }, []);

  const isComplete =
    committedInput.length === target.length && committedInput === target;

  const chars = useMemo<TypingChar[]>(() => {
    return target.split('').map((char, i) => {
      let state: CharState;
      if (i < committedInput.length) {
        state = committedInput[i] === char ? 'correct' : 'incorrect';
      } else if (i === committedInput.length) {
        state = 'current';
      } else {
        state = 'untyped';
      }
      return { char, state };
    });
  }, [target, committedInput]);

  const stats = useMemo<TypingStats>(() => {
    let leading = 0;
    for (let i = 0; i < committedInput.length && i < target.length; i++) {
      if (committedInput[i] === target[i]) leading++;
      else break;
    }
    let matched = 0;
    for (let i = 0; i < committedInput.length && i < target.length; i++) {
      if (committedInput[i] === target[i]) matched++;
    }

    const totalTyped = committedInput.length;
    const endTs = endedAt ?? nowTick;
    const elapsedMs = startedAt ? Math.max(0, endTs - startedAt) : 0;
    const elapsedMin = elapsedMs / 60000;

    const wpm = elapsedMin > 0 ? Math.round(leading / 5 / elapsedMin) : 0;
    const cpm = elapsedMin > 0 ? Math.round(leading / elapsedMin) : 0;
    const accuracy =
      totalTyped > 0 ? Math.round((matched / totalTyped) * 100) : 100;
    const progress =
      target.length > 0 ? Math.round((leading / target.length) * 100) : 0;

    return {
      wpm,
      cpm,
      accuracy,
      progress,
      elapsedMs,
      correctChars: leading,
      totalTyped,
    };
  }, [target, committedInput, startedAt, endedAt, nowTick]);

  return {
    rawInput,
    committedInput,
    chars,
    stats,
    isComplete,
    startedAt,
    endedAt,
    handleInputChange,
    handleCompositionStart,
    handleCompositionEnd,
    reset,
  };
}
