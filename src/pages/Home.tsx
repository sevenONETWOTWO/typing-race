import { Link } from 'react-router-dom';

interface EntryProps {
  to: string;
  title: string;
  subtitle: string;
}

function Entry({ to, title, subtitle }: EntryProps) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-sky-500/60 transition p-6 md:p-7 text-left focus:outline-none focus:ring-2 focus:ring-sky-500"
    >
      <div className="text-xl md:text-2xl font-semibold text-slate-100">
        {title}
      </div>
      <div className="mt-2 text-sm text-slate-400">{subtitle}</div>
    </Link>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-3">
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center px-6 py-16">
      <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-center">
        打字竞速 · Typing Race
      </h1>
      <p className="mt-4 text-base md:text-lg text-slate-400 text-center max-w-lg">
        Sharpen your typing. Race against yourself, AI, or friends.
      </p>

      <div className="mt-12 w-full max-w-2xl flex flex-col gap-8">
        <div>
          <SectionLabel>单人练习 · Solo</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Entry
              to="/practice?lang=en"
              title="英文练习"
              subtitle="English · WPM · Live coloring"
            />
            <Entry
              to="/practice?lang=zh"
              title="中文练习"
              subtitle="中文 · CPM · IME 支持"
            />
          </div>
        </div>
        <div>
          <SectionLabel>AI 对战 · AI Race</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Entry
              to="/ai?lang=en"
              title="英文 AI 对战"
              subtitle="English · 简单 / 中等 / 困难"
            />
            <Entry
              to="/ai?lang=zh"
              title="中文 AI 对战"
              subtitle="中文 · 简单 / 中等 / 困难"
            />
          </div>
        </div>
        <div>
          <SectionLabel>联机对战 · Multiplayer</SectionLabel>
          <div className="grid grid-cols-1 gap-4">
            <Entry
              to="/online"
              title="联机对战"
              subtitle="4 位房间号 · 创建或加入 · 语言房主选"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
