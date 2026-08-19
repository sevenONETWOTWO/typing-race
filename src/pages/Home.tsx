import { Link } from 'react-router-dom';
import {
  IconKeyboard,
  IconRobot,
  IconUser,
  IconUsers,
} from '../components/Icon';

interface EntryProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

function Entry({ to, icon, title, subtitle }: EntryProps) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-line bg-surface shadow-[0_4px_0_var(--color-keycap)] hover:shadow-[0_2px_0_var(--color-keycap)] hover:translate-y-[2px] active:shadow-[0_1px_0_var(--color-keycap)] active:translate-y-[3px] transition-[transform,box-shadow] duration-75 p-5 md:p-6 focus:outline-none focus:ring-2 focus:ring-amber flex items-center gap-4"
    >
      <div className="shrink-0 rounded-lg bg-amber-tint p-3 text-amber">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-mono text-lg md:text-xl font-semibold text-ink">
          {title}
        </div>
        <div className="mt-1 text-sm text-ink-soft truncate">{subtitle}</div>
      </div>
    </Link>
  );
}

function SectionLabel({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-widest text-ink-soft font-mono">
      <span className="text-amber">{icon}</span>
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-dvh bg-canvas text-ink flex flex-col items-center px-4 sm:px-6 py-12 sm:py-16">
      <div className="rounded-2xl bg-amber-tint p-4 sm:p-5 text-amber">
        <IconKeyboard size={48} />
      </div>
      <h1 className="mt-6 font-mono text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-center text-ink">
        打字竞速
      </h1>
      <p className="mt-2 font-mono text-xs sm:text-sm uppercase tracking-[0.4em] text-amber">
        Typing Race
      </p>
      <p className="mt-4 text-sm sm:text-base text-ink-soft text-center max-w-md">
        Sharpen your typing. Race against yourself, AI, or friends.
      </p>

      <div className="mt-10 sm:mt-12 w-full max-w-2xl flex flex-col gap-8">
        <div>
          <SectionLabel icon={<IconUser size={14} />}>
            单人练习 · Solo
          </SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Entry
              to="/practice?lang=en"
              icon={<IconKeyboard size={22} />}
              title="英文练习"
              subtitle="English · WPM · Live coloring"
            />
            <Entry
              to="/practice?lang=zh"
              icon={<IconKeyboard size={22} />}
              title="中文练习"
              subtitle="中文 · CPM · IME 支持"
            />
          </div>
        </div>
        <div>
          <SectionLabel icon={<IconRobot size={14} />}>
            AI 对战 · AI Race
          </SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Entry
              to="/ai?lang=en"
              icon={<IconRobot size={22} />}
              title="英文 AI 对战"
              subtitle="English · 简单 / 中等 / 困难"
            />
            <Entry
              to="/ai?lang=zh"
              icon={<IconRobot size={22} />}
              title="中文 AI 对战"
              subtitle="中文 · 简单 / 中等 / 困难"
            />
          </div>
        </div>
        <div>
          <SectionLabel icon={<IconUsers size={14} />}>
            联机对战 · Multiplayer
          </SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            <Entry
              to="/online"
              icon={<IconUsers size={22} />}
              title="联机对战"
              subtitle="4 位房间号 · 创建或加入 · 语言房主选"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
