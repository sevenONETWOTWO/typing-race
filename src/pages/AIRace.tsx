import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IconArrowLeft, IconRobot, IconUser } from '../components/Icon';
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

type Phase = 'select' | 'countdown' | 'racing' | 'finished';
type Winner = 'you' | 'ai';

const inputVisible =
  'mt-6 sm:mt-8 w-full max-w-3xl px-4 py-3 rounded-xl bg-surface border border-line focus:border-amber outline-none text-ink font-mono text-lg tracking-wide shadow-[0_3px_0_var(--color-keycap)] focus:shadow-[0_2px_0_var(--color-keycap)] transition-[box-shadow]';
const inputHidden = 'absolute left-[-9999px] top-0 opacity-0';

export default function AIRace() {
  const [searchParams] = useSearchParams();
  const lang = resolveLang(searchParams.get('lang'));
  return <AIRaceInner key={lang} lang={lang} />;
}

function AIRaceInner({ lang }: { lang: Language }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isZh = lang === 'zh';
  const unit = speedUnit(lang);
  const showInput = isZh || isMobile;

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

  useEffect(() => {
    if (phase === 'racing') {
      inputRef.current?.focus();
    }
  }, [phase, target]);

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
      startCountdown(difficulty, getRandomText(lang, 'medium', target));
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
      className={`min-h-dvh bg-canvas text-ink flex flex-col items-center px-4 sm:px-6 ${
        phase === 'racing' && !showInput ? 'cursor-text' : ''
      }`}
      onClick={phase === 'racing' && !showInput ? focusInput : undefined}
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
        <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-ink-soft font-mono">
          <IconRobot size={14} className="text-amber" />
          {isZh ? '中文 · CPM · AI' : 'English · WPM · AI'}
        </div>
      </header>

      {phase === 'select' && (
        <div
          className="w-full flex flex-col items-center pt-8 sm:pt-16"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs sm:text-sm uppercase tracking-widest text-amber font-mono">
            选择 AI 难度 · Choose Difficulty
          </div>
          <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-2xl">
            {DIFFICULTY_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleSelectDifficulty(d)}
                className="rounded-xl border border-line bg-surface hover:border-amber shadow-[0_4px_0_var(--color-keycap)] hover:shadow-[0_2px_0_var(--color-keycap)] hover:translate-y-[2px] active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-keycap)] transition-[transform,box-shadow,border-color] duration-75 p-5 sm:p-6 text-center focus:outline-none focus:ring-2 focus:ring-amber"
              >
                <div className="text-xl sm:text-2xl font-mono font-semibold text-ink">
                  {DIFFICULTY_LABEL[d]}
                </div>
                <div className="mt-2 text-sm text-ink-soft font-mono tabular-nums">
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
          className="w-full flex flex-col items-center pt-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-3xl space-y-3 mb-6">
            <ProgressRow
              label="你 · You"
              icon={<IconUser size={14} />}
              pct={engine.stats.progress}
              color="amber"
            />
            <ProgressRow
              label={`AI${difficulty !== null ? ` · ${DIFFICULTY_LABEL[difficulty]}` : ''}`}
              icon={<IconRobot size={14} />}
              pct={aiProgress}
              color="opp"
            />
          </div>

          {phase === 'racing' && (
            <div className="w-full max-w-3xl flex items-center gap-6 sm:gap-8 justify-end mb-6 text-ink">
              <MiniStat label={unit} value={playerSpeed} />
              <MiniStat label="Acc" value={`${engine.stats.accuracy}%`} />
            </div>
          )}

          {phase !== 'finished' && (
            <div className="max-w-3xl w-full text-xl sm:text-2xl md:text-3xl leading-relaxed font-mono tracking-wide select-none break-words">
              {engine.chars.map((c, i) => (
                <span key={i} className={charClass[c.state]}>
                  {renderChar(c.char, c.state)}
                </span>
              ))}
            </div>
          )}

          {phase === 'countdown' && (
            <div className="mt-8 sm:mt-10 flex flex-col items-center">
              <div
                key={countdown}
                className="text-7xl sm:text-8xl md:text-9xl font-mono font-bold text-amber tabular-nums"
              >
                {countdown > 0 ? countdown : ''}
              </div>
              <div className="mt-2 text-xs uppercase tracking-widest text-ink-soft font-mono">
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
                className={showInput ? inputVisible : inputHidden}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                aria-label="typing input"
                placeholder={
                  isZh
                    ? '用中文输入法在这里打字…'
                    : isMobile
                      ? '在这里打字…'
                      : undefined
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
                  {focused
                    ? '直接开始打字'
                    : '点击继续打字 · Click to continue'}
                </div>
              )}
            </>
          )}

          {phase === 'finished' && winner !== null && (
            <div className="flex flex-col items-center pt-4 sm:pt-6">
              <div
                className={`text-xs sm:text-sm uppercase tracking-widest font-mono ${
                  winner === 'you' ? 'text-amber' : 'text-ink-soft'
                }`}
              >
                {winner === 'you' ? '你赢了 · You Win' : 'AI 赢了 · AI Wins'}
              </div>
              <div className="mt-6 sm:mt-8 grid grid-cols-3 gap-3 sm:gap-6">
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
              <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row gap-3 w-full max-w-md sm:w-auto">
                <PrimaryButton onClick={handleRematch}>再来一局</PrimaryButton>
                <SecondaryButton onClick={handleChangeDifficulty}>
                  换难度
                </SecondaryButton>
                <SecondaryButton onClick={handleHome}>回首页</SecondaryButton>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProgressRow({
  label,
  icon,
  pct,
  color,
}: {
  label: string;
  icon: React.ReactNode;
  pct: number;
  color: 'amber' | 'opp';
}) {
  const barColor = color === 'amber' ? 'bg-amber' : 'bg-ink-soft';
  const textColor = color === 'amber' ? 'text-amber' : 'text-ink-soft';
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span
          className={`inline-flex items-center gap-1.5 font-medium font-mono ${textColor}`}
        >
          {icon}
          {label}
        </span>
        <span className="tabular-nums text-ink-soft font-mono">{pct}%</span>
      </div>
      <div className="h-3 rounded-full bg-surface-soft overflow-hidden border border-line">
        <div
          className={`h-full ${barColor} transition-all duration-100`}
          style={{ width: `${pct}%` }}
        />
      </div>
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
