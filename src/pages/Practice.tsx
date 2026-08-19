import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRandomText, type Language } from '../data/texts';
import { useTypingEngine, type CharState } from '../hooks/useTypingEngine';

const charClass: Record<CharState, string> = {
  correct: 'text-slate-200',
  incorrect: 'text-red-400 bg-red-500/20 rounded-sm',
  current: 'text-slate-100 bg-sky-500/40 rounded-sm',
  untyped: 'text-slate-600',
};

function renderChar(target: string, state: CharState): string {
  // Spaces on incorrect state get a middle-dot so misses on whitespace are visible.
  // Chinese chars aren't spaces, so this only affects English.
  if (target === ' ' && state === 'incorrect') return '·';
  return target;
}

export default function Practice() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Language>('en');
  const [target, setTarget] = useState<string>(() => getRandomText('en'));
  const engine = useTypingEngine(target, lang);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState<boolean>(true);

  useEffect(() => {
    inputRef.current?.focus();
  }, [target]);

  const isZh = lang === 'zh';
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

  const handleLangSwitch = (newLang: Language) => {
    if (newLang === lang) return;
    setLang(newLang);
    setTarget(getRandomText(newLang));
  };

  return (
    <div
      className={`min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center px-6 ${
        engine.isComplete || isZh ? '' : 'cursor-text'
      }`}
      onClick={engine.isComplete || isZh ? undefined : focusInput}
    >
      <header
        className="w-full max-w-3xl flex items-center justify-between pt-6 pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleHome}
          className="text-sm text-slate-500 hover:text-slate-300 transition"
        >
          ← 首页
        </button>
        <div
          className="inline-flex bg-slate-800/60 border border-slate-700 rounded-full p-1"
          role="tablist"
          aria-label="language"
        >
          <button
            type="button"
            role="tab"
            aria-selected={lang === 'en'}
            onClick={() => handleLangSwitch('en')}
            className={`px-4 py-1.5 rounded-full text-sm transition ${
              lang === 'en'
                ? 'bg-sky-500 text-slate-900 font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={lang === 'zh'}
            onClick={() => handleLangSwitch('zh')}
            className={`px-4 py-1.5 rounded-full text-sm transition ${
              lang === 'zh'
                ? 'bg-sky-500 text-slate-900 font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            中文
          </button>
        </div>
        <div className="w-16" aria-hidden="true" />
      </header>

      {engine.isComplete ? (
        <div
          className="flex flex-col items-center justify-center pt-20"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-sm uppercase tracking-widest text-slate-500">
            完成 · Complete
          </div>
          <div className="mt-8 grid grid-cols-3 gap-12 md:gap-20">
            <BigStat label={speedLabel} value={speed} />
            <BigStat label="Accuracy" value={`${engine.stats.accuracy}%`} />
            <BigStat label="Time" value={`${elapsedSeconds}s`} />
          </div>
          <div className="mt-14 flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              onClick={handleNext}
              className="rounded-full bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium px-8 py-3 transition"
            >
              再来一句
            </button>
            <button
              type="button"
              onClick={handleHome}
              className="rounded-full border border-slate-700 hover:bg-slate-800 text-slate-200 font-medium px-8 py-3 transition"
            >
              回首页
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center pt-4">
          <div className="w-full max-w-3xl flex items-center gap-8 justify-end mb-8 text-slate-300">
            <MiniStat label={speedLabel} value={speed} />
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

          <div className="max-w-3xl w-full text-2xl md:text-3xl leading-relaxed font-mono tracking-wide select-none break-words">
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
            className={
              isZh
                ? 'mt-8 w-full max-w-3xl px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700 focus:border-sky-500/60 outline-none text-slate-100 font-mono text-lg tracking-wide'
                : 'absolute left-[-9999px] top-0 opacity-0'
            }
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            aria-label="typing input"
            placeholder={isZh ? '用中文输入法在这里打字…' : undefined}
          />

          {isZh ? (
            <div className="mt-3 text-xs text-slate-500 text-center max-w-3xl">
              使用系统中文输入法逐字输入 · 汉字上屏后才会自动比对(合成中的拼音不参与判定)
            </div>
          ) : (
            <div className="h-6 mt-10 text-sm text-slate-500">
              {focused ? '直接开始打字' : '点击继续打字 · Click to continue'}
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="mt-8 text-xs text-slate-500 hover:text-slate-300 underline underline-offset-4"
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

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
    </div>
  );
}
