import { useEffect, useState } from 'react';
import { IconMoon, IconSun } from './Icon';

type Theme = 'light' | 'dark';

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme: Theme) {
  const el = document.documentElement;
  if (theme === 'dark') el.setAttribute('data-theme', 'dark');
  else el.removeAttribute('data-theme');
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem('theme', theme);
    } catch {
      /* localStorage disabled — session-only */
    }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'light' ? '切换深色主题' : '切换浅色主题'}
      className="fixed top-3 right-3 sm:top-4 sm:right-4 z-50 h-11 w-11 rounded-full bg-surface border border-line text-amber shadow-[0_3px_0_var(--color-keycap)] hover:shadow-[0_2px_0_var(--color-keycap)] hover:translate-y-[1px] active:shadow-[0_1px_0_var(--color-keycap)] active:translate-y-[2px] transition-[transform,box-shadow] duration-75 flex items-center justify-center"
    >
      {theme === 'light' ? <IconMoon size={20} /> : <IconSun size={20} />}
    </button>
  );
}
