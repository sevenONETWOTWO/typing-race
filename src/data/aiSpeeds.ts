import type { Language } from './texts';

export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * AI target speeds by difficulty and language.
 * - English speeds are WPM (words per minute, 1 word = 5 chars).
 * - Chinese speeds are CPM (characters per minute).
 *
 * Tune these numbers here to change AI difficulty across the whole app.
 */
export const AI_SPEEDS: Record<Language, Record<Difficulty, number>> = {
  en: { easy: 25, medium: 45, hard: 70 },
  zh: { easy: 30, medium: 80, hard: 160 },
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

export const DIFFICULTY_ORDER: readonly Difficulty[] = [
  'easy',
  'medium',
  'hard',
] as const;

/** Convert a language-native speed (WPM or CPM) into chars-per-second. */
export function speedToCharsPerSecond(lang: Language, speed: number): number {
  return lang === 'en' ? (speed * 5) / 60 : speed / 60;
}

/** Unit label to display for the given language. */
export function speedUnit(lang: Language): 'WPM' | 'CPM' {
  return lang === 'en' ? 'WPM' : 'CPM';
}
