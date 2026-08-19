import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRandomText } from '../data/texts';
import {
  useTypingEngine,
  type CharState,
  type TypingEngine,
} from '../hooks/useTypingEngine';

const charClass: Record<CharState, string> = {
  correct: 'text-slate-200',
  incorrect: 'text-red-400 bg-red-500/20 rounded-sm',
  current: 'text-slate-100 bg-sky-500/40 rounded-sm',
  untyped: 'text-slate-600',
};

function renderChar(target: string, state: CharState): string {
  if (target === ' ') {
    if (state === 'incorrect') return '·';
    // Non-breaking space keeps highlight visible without breaking wrap logic
    return ' ';
  }
  return target;
}

export default function Practice() {
  const navigate = useNavigate();
  const [target, setTarget] = useState<string>(() => getRandomText());
  const engine = useTypingEngine(target);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState<boolean>(true);

  useEffect(() => {
    inputRef.current?.focus();
  }, [target]);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const handleNext = () => {
    setTarget((prev) => getRandomText(prev));
  };

  const handleHome = () => {
    navigate('/');
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') e.preventDefault();
  };

  return (
    <div className="relative min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center px-6">
      <input
        ref={inputRef}
        type="text"
        value={engine.input}
        onChange={(e) => engine.handleInputChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        className="absolute left-[-9999px] top-0 opacity-0"
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        aria-label="typing input"
      />

      {engine.isComplete ? (
        <ResultsView
          engine={engine}
          onNext={handleNext}
          onHome={handleHome}
        />
      ) : (
        <TypingView
          engine={engine}
          focused={focused}
          onSurfaceClick={focusInput}
          onSkip={handleNext}
          onHome={handleHome}
        />
      )}
    </div>
  );
}

function TypingView({
  engine,
  focused,
  onSurfaceClick,
  onSkip,
  onHome,
}: {
  engine: TypingEngine;
  focused: boolean;
  onSurfaceClick: () => void;
  onSkip: () => void;
  onHome: () => void;
}) {
  return (
    <div
      className="w-full flex flex-col items-center pt-16 cursor-text"
      onClick={onSurfaceClick}
    >
      <div className="w-full max-w-3xl flex items-center justify-between mb-10">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onHome();
          }}
          className="text-sm text-slate-500 hover:text-slate-300"
        >
          ← 首页
        </button>
        <div className="flex gap-8 text-slate-300">
          <MiniStat label="WPM" value={engine.stats.wpm} />
          <MiniStat label="Acc" value={`${engine.stats.accuracy}%`} />
          <div className="w-40 flex flex-col justify-center">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
              Progress
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all duration-150"
                style={{ width: `${engine.stats.progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl w-full text-2xl md:text-3xl leading-relaxed font-mono tracking-wide select-none break-words">
        {engine.chars.map((c, i) => (
          <span key={i} className={charClass[c.state]}>
            {renderChar(c.char, c.state)}
          </span>
        ))}
      </div>

      <div className="h-6 mt-10 text-sm text-slate-500">
        {focused ? '直接开始打字' : '点击继续打字 · Click to continue'}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSkip();
        }}
        className="mt-8 text-xs text-slate-500 hover:text-slate-300 underline underline-offset-4"
      >
        换一句 · Skip
      </button>
    </div>
  );
}

function ResultsView({
  engine,
  onNext,
  onHome,
}: {
  engine: TypingEngine;
  onNext: () => void;
  onHome: () => void;
}) {
  const seconds = (engine.stats.elapsedMs / 1000).toFixed(1);
  return (
    <div className="w-full flex flex-col items-center justify-center pt-24">
      <div className="text-sm uppercase tracking-widest text-slate-500">
        完成 · Complete
      </div>
      <div className="mt-8 grid grid-cols-3 gap-12 md:gap-20">
        <BigStat label="WPM" value={engine.stats.wpm} />
        <BigStat label="Accuracy" value={`${engine.stats.accuracy}%`} />
        <BigStat label="Time" value={`${seconds}s`} />
      </div>
      <div className="mt-14 flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          onClick={onNext}
          className="rounded-full bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium px-8 py-3 transition"
        >
          再来一句
        </button>
        <button
          type="button"
          onClick={onHome}
          className="rounded-full border border-slate-700 hover:bg-slate-800 text-slate-200 font-medium px-8 py-3 transition"
        >
          回首页
        </button>
      </div>
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-5xl md:text-6xl font-bold text-sky-400 tabular-nums">
        {value}
      </div>
      <div className="mt-2 text-xs uppercase tracking-widest text-slate-500">
        {label}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
    </div>
  );
}
