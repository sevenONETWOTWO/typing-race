import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IconArrowLeft } from '../components/Icon';
import { getRandomText, type Language } from '../data/texts';
import { useIsMobile } from '../hooks/useIsMobile';
import { useTypingEngine, type CharState } from '../hooks/useTypingEngine';

const charClass: Record<CharState, string> = {
  correct: 'text-ink',
  incorrect: 'text-err bg-err-tint rounded-sm',
  current: 'text-ink bg-amber-tint rounded-sm',
  untyped: 'text-ink-soft',
};

function renderChar(target: string, state: CharState): string {
  if (target === ' ' && state === 'incorrect') return '·';
  return target;
}

function resolveLang(raw: string | null): Language {
  return raw === 'zh' ? 'zh' : 'en';
}

const inputVisible =
  'mt-6 sm:mt-8 w-full max-w-3xl px-4 py-3 rounded-xl bg-surface border border-line focus:border-amber outline-none text-ink font-mono text-lg tracking-wide shadow-[0_3px_0_var(--color-keycap)] focus:shadow-[0_2px_0_var(--color-keycap)] transition-[box-shadow]';
const inputHidden = 'absolute left-[-9999px] top-0 opacity-0';

export default function Practice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lang = resolveLang(searchParams.get('lang'));
  const isMobile = useIsMobile();

  const [target, setTarget] = useState<string>(() => getRandomText(lang));
  const [prevLang, setPrevLang] = useState<Language>(lang);
  if (lang !== prevLang) {
    setPrevLang(lang);
    setTarget(getRandomText(lang));
  }

  const engine = useTypingEngine(target, lang);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState<boolean>(true);

  useEffect(() => {
    inputRef.current?.focus();
  }, [target]);

  const isZh = lang === 'zh';
  const showInput = isZh || isMobile;
  const speed = isZh ? engine.stats.cpm : engine.stats.wpm;
  const speedLabel = isZh ? 'CPM' : 'WPM';
  const elapsedSeconds = (engine.stats.elapsedMs / 1000).toFixed(1);

  const focusInput = () => inputRef.current?.focus();
  const handleNext = () => {
    setTarget((prev) => getRandomText(lang, prev));
  };
  const handleHome = () => {
    navigate('/');
  };

  return (
    <div
      className={`min-h-dvh bg-canvas text-ink flex flex-col items-center px-4 sm:px-6 ${
        engine.isComplete || showInput ? '' : 'cursor-text'
      }`}
      onClick={engine.isComplete || showInput ? undefined : focusInput}
    >
      <header
        className="w-full max-w-3xl flex items-center justify-between pt-4 sm:pt-6 pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleHome}
          className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink transition"
        >
          <IconArrowLeft size={16} />
          首页
        </button>
        <div className="text-[11px] uppercase tracking-widest text-ink-soft font-mono">
          {isZh ? '中文 · CPM' : 'English · WPM'}
        </div>
      </header>

      {engine.isComplete ? (
        <div
          className="flex flex-col items-center justify-center pt-12 sm:pt-20"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs sm:text-sm uppercase tracking-widest text-amber font-mono">
            完成 · Complete
          </div>
          <div className="mt-6 sm:mt-8 grid grid-cols-3 gap-3 sm:gap-6">
            <BigStat label={speedLabel} value={speed} />
            <BigStat label="Accuracy" value={`${engine.stats.accuracy}%`} />
            <BigStat label="Time" value={`${elapsedSeconds}s`} />
          </div>
          <div className="mt-10 sm:mt-14 flex flex-col sm:flex-row gap-3 w-full max-w-sm sm:w-auto">
            <PrimaryButton onClick={handleNext}>再来一句</PrimaryButton>
            <SecondaryButton onClick={handleHome}>回首页</SecondaryButton>
          </div>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center pt-2">
          <div className="w-full max-w-3xl flex items-center flex-wrap gap-4 sm:gap-8 justify-end mb-6 sm:mb-8 text-ink">
            <MiniStat label={speedLabel} value={speed} />
            <MiniStat label="Acc" value={`${engine.stats.accuracy}%`} />
            <div className="w-32 sm:w-40 flex flex-col justify-center">
              <div className="text-[10px] uppercase tracking-wider text-ink-soft mb-1 font-mono">
                Progress
              </div>
              <div className="h-2.5 rounded-full bg-surface-soft overflow-hidden border border-line">
                <div
                  className="h-full bg-amber transition-all duration-150"
                  style={{ width: `${engine.stats.progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="max-w-3xl w-full text-xl sm:text-2xl md:text-3xl leading-relaxed font-mono tracking-wide select-none break-words">
            {engine.chars.map((c, i) => (
              <span key={i} className={charClass[c.state]}>
                {renderChar(c.char, c.state)}
              </span>
            ))}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={engine.rawInput}
            onChange={(e) => engine.handleInputChange(e.target.value)}
            onCompositionStart={engine.handleCompositionStart}
            onCompositionEnd={(e) =>
              engine.handleCompositionEnd(e.currentTarget.value)
            }
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Tab') e.preventDefault();
            }}
            onClick={(e) => e.stopPropagation()}
            className={showInput ? inputVisible : inputHidden}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            aria-label="typing input"
            placeholder={
              isZh ? '用中文输入法在这里打字…' : isMobile ? '在这里打字…' : undefined
            }
          />

          {showInput ? (
            <div className="mt-2 sm:mt-3 text-xs text-ink-soft text-center max-w-3xl">
              {isZh
                ? '使用系统中文输入法逐字输入 · 汉字上屏后才会自动比对'
                : '点击输入框调出键盘'}
            </div>
          ) : (
            <div className="h-6 mt-8 sm:mt-10 text-sm text-ink-soft">
              {focused ? '直接开始打字' : '点击继续打字 · Click to continue'}
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="mt-6 sm:mt-8 text-xs text-ink-soft hover:text-amber underline underline-offset-4 transition"
          >
            换一句 · Skip
          </button>
        </div>
      )}
    </div>
  );
}

function BigStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface shadow-[0_4px_0_var(--color-keycap)] px-4 py-4 sm:px-6 sm:py-5 text-center min-w-0">
      <div className="text-3xl sm:text-5xl font-mono font-bold text-amber tabular-nums">
        {value}
      </div>
      <div className="mt-1 sm:mt-2 text-[10px] sm:text-xs uppercase tracking-widest text-ink-soft font-mono">
        {label}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-xl sm:text-2xl font-mono font-semibold text-ink tabular-nums">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-ink-soft font-mono">
        {label}
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-amber hover:bg-amber-hover text-white font-medium px-8 py-3 shadow-[0_3px_0_var(--color-keycap)] hover:shadow-[0_2px_0_var(--color-keycap)] hover:translate-y-[1px] active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-keycap)] transition-[transform,box-shadow,background-color] duration-75"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-line bg-surface hover:bg-surface-soft text-ink font-medium px-8 py-3 shadow-[0_3px_0_var(--color-keycap)] hover:shadow-[0_2px_0_var(--color-keycap)] hover:translate-y-[1px] active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-keycap)] transition-[transform,box-shadow,background-color] duration-75"
    >
      {children}
    </button>
  );
}
