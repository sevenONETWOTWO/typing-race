import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AI_SPEEDS,
  DIFFICULTY_LABEL,
  DIFFICULTY_ORDER,
  speedToCharsPerSecond,
  speedUnit,
  type Difficulty,
} from '../data/aiSpeeds';
import { getRandomText, type Language } from '../data/texts';
import { useAIRacer } from '../hooks/useAIRacer';
import { useTypingEngine, type CharState } from '../hooks/useTypingEngine';

const charClass: Record<CharState, string> = {
  correct: 'text-slate-200',
  incorrect: 'text-red-400 bg-red-500/20 rounded-sm',
  current: 'text-slate-100 bg-sky-500/40 rounded-sm',
  untyped: 'text-slate-600',
};

function renderChar(target: string, state: CharState): string {
  if (target === ' ' && state === 'incorrect') return '·';
  return target;
}

function resolveLang(raw: string | null): Language {
  return raw === 'zh' ? 'zh' : 'en';
}

type Phase = 'select' | 'countdown' | 'racing' | 'finished';
type Winner = 'you' | 'ai';

/**
 * Route wrapper. `key={lang}` forces a clean remount of the inner component
 * when the URL's ?lang= changes, resetting the entire state machine + timers
 * without needing prev-lang bookkeeping inside AIRaceInner.
 */
export default function AIRace() {
  const [searchParams] = useSearchParams();
  const lang = resolveLang(searchParams.get('lang'));
  return <AIRaceInner key={lang} lang={lang} />;
}

function AIRaceInner({ lang }: { lang: Language }) {
  const navigate = useNavigate();
  const isZh = lang === 'zh';
  const unit = speedUnit(lang);

  const [phase, setPhase] = useState<Phase>('select');
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [target, setTarget] = useState<string>(() => getRandomText(lang));
  const [countdown, setCountdown] = useState<number>(3);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [raceStartAt, setRaceStartAt] = useState<number | null>(null);

  const engine = useTypingEngine(target, lang);

  const speed = difficulty !== null ? AI_SPEEDS[lang][difficulty] : 0;
  const charsPerSecond = speedToCharsPerSecond(lang, speed);
  const aiRacer = useAIRacer(
    target.length,
    charsPerSecond,
    phase === 'racing',
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState<boolean>(true);

  // Focus input when the race actually starts (and if target changes mid-race,
  // e.g. on rematch bringing us back through countdown → racing).
  useEffect(() => {
    if (phase === 'racing') {
      inputRef.current?.focus();
    }
  }, [phase, target]);

  // Countdown driver: 3 → 2 → 1 → race. Each number holds for 1s. The
  // transition to 'racing' happens inside the timer callback (async, so it
  // isn't a synchronous setState in the effect body) and stamps raceStartAt
  // in the same batch as the phase flip — that's when both the AI clock and
  // the player input become live.
  useEffect(() => {
    if (phase !== 'countdown') return;
    const id = window.setTimeout(() => {
      if (countdown <= 1) {
        setRaceStartAt(Date.now());
        setPhase('racing');
      } else {
        setCountdown((c) => c - 1);
      }
    }, 1000);
    return () => window.clearTimeout(id);
  }, [phase, countdown]);

  // Winner detection via the "adjust state during render" pattern. Checking
  // engine.isComplete before aiRacer.isDone means any same-tick tie goes to
  // the player (they landed the last char on the exact moment vs. AI's
  // 100ms tick edge).
  if (
    phase === 'racing' &&
    winner === null &&
    (engine.isComplete || aiRacer.isDone)
  ) {
    setWinner(engine.isComplete ? 'you' : 'ai');
    setPhase('finished');
  }

  const focusInput = () => inputRef.current?.focus();
  const handleHome = () => navigate('/');

  const startCountdown = (d: Difficulty, nextTarget: string) => {
    setDifficulty(d);
    setTarget(nextTarget);
    setCountdown(3);
    setWinner(null);
    setRaceStartAt(null);
    aiRacer.reset();
    setPhase('countdown');
  };

  const handleSelectDifficulty = (d: Difficulty) => {
    startCountdown(d, getRandomText(lang));
  };

  const handleRematch = () => {
    if (difficulty !== null) {
      startCountdown(difficulty, getRandomText(lang, target));
    }
  };

  const handleChangeDifficulty = () => {
    aiRacer.reset();
    setDifficulty(null);
    setWinner(null);
    setRaceStartAt(null);
    setPhase('select');
  };

  const playerSpeed = isZh ? engine.stats.cpm : engine.stats.wpm;
  // Race time is derived, not stored — this avoids needing Date.now() at the
  // winner-detection transition. Player win: engine.endedAt is captured
  // synchronously the moment the last char lands. AI win: the AI finishes
  // exactly at raceStartAt + targetLength / charsPerSecond (that's the math
  // the tick converges toward), so we can compute it directly.
  const raceTimeMs =
    raceStartAt === null
      ? 0
      : winner === 'you' && engine.endedAt !== null
        ? engine.endedAt - raceStartAt
        : winner === 'ai' && charsPerSecond > 0 && target.length > 0
          ? (target.length / charsPerSecond) * 1000
          : 0;
  const aiProgress = Math.floor(aiRacer.progress);

  return (
    <div
      className={`min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center px-6 ${
        phase === 'racing' && !isZh ? 'cursor-text' : ''
      }`}
      onClick={phase === 'racing' && !isZh ? focusInput : undefined}
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
        <div className="text-[11px] uppercase tracking-widest text-slate-500">
          {isZh ? '中文 · CPM · AI' : 'English · WPM · AI'}
        </div>
      </header>

      {phase === 'select' && (
        <div
          className="w-full flex flex-col items-center pt-16"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-sm uppercase tracking-widest text-slate-500">
            选择 AI 难度 · Choose Difficulty
          </div>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
            {DIFFICULTY_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleSelectDifficulty(d)}
                className="rounded-2xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-amber-500/60 transition p-6 text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <div className="text-2xl font-semibold text-slate-100">
                  {DIFFICULTY_LABEL[d]}
                </div>
                <div className="mt-2 text-sm text-slate-400 tabular-nums">
                  {AI_SPEEDS[lang][d]} {unit}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {(phase === 'countdown' ||
        phase === 'racing' ||
        phase === 'finished') && (
        <div
          className="w-full flex flex-col items-center pt-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-3xl space-y-3 mb-6">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-sky-400 font-medium">你 · You</span>
                <span className="tabular-nums text-slate-400">
                  {engine.stats.progress}%
                </span>
              </div>
              <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all duration-150"
                  style={{ width: `${engine.stats.progress}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-amber-400 font-medium">
                  AI{difficulty !== null ? ` · ${DIFFICULTY_LABEL[difficulty]}` : ''}
                </span>
                <span className="tabular-nums text-slate-400">
                  {aiProgress}%
                </span>
              </div>
              <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-100"
                  style={{ width: `${aiRacer.progress}%` }}
                />
              </div>
            </div>
          </div>

          {phase === 'racing' && (
            <div className="w-full max-w-3xl flex items-center gap-8 justify-end mb-6 text-slate-300">
              <MiniStat label={unit} value={playerSpeed} />
              <MiniStat label="Acc" value={`${engine.stats.accuracy}%`} />
            </div>
          )}

          {phase !== 'finished' && (
            <div className="max-w-3xl w-full text-2xl md:text-3xl leading-relaxed font-mono tracking-wide select-none break-words">
              {engine.chars.map((c, i) => (
                <span key={i} className={charClass[c.state]}>
                  {renderChar(c.char, c.state)}
                </span>
              ))}
            </div>
          )}

          {phase === 'countdown' && (
            <div className="mt-10 flex flex-col items-center">
              <div
                key={countdown}
                className="text-8xl md:text-9xl font-bold text-sky-400 tabular-nums"
              >
                {countdown > 0 ? countdown : ''}
              </div>
              <div className="mt-2 text-xs uppercase tracking-widest text-slate-500">
                准备开始 · Get ready
              </div>
            </div>
          )}

          {phase === 'racing' && (
            <>
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
                  使用系统中文输入法逐字输入 · 汉字上屏后才会自动比对
                </div>
              ) : (
                <div className="h-6 mt-10 text-sm text-slate-500">
                  {focused
                    ? '直接开始打字'
                    : '点击继续打字 · Click to continue'}
                </div>
              )}
            </>
          )}

          {phase === 'finished' && winner !== null && (
            <div className="flex flex-col items-center pt-6">
              <div
                className={`text-sm uppercase tracking-widest ${
                  winner === 'you' ? 'text-sky-400' : 'text-amber-400'
                }`}
              >
                {winner === 'you' ? '你赢了 · You Win' : 'AI 赢了 · AI Wins'}
              </div>
              <div className="mt-8 grid grid-cols-3 gap-12 md:gap-20">
                <BigStat label={unit} value={playerSpeed} />
                <BigStat
                  label="Accuracy"
                  value={`${engine.stats.accuracy}%`}
                />
                <BigStat
                  label="Time"
                  value={`${(raceTimeMs / 1000).toFixed(1)}s`}
                />
              </div>
              <div className="mt-12 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleRematch}
                  className="rounded-full bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium px-8 py-3 transition"
                >
                  再来一局
                </button>
                <button
                  type="button"
                  onClick={handleChangeDifficulty}
                  className="rounded-full border border-slate-700 hover:bg-slate-800 text-slate-200 font-medium px-8 py-3 transition"
                >
                  换难度
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
          )}
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
