import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center px-6">
      <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-center">
        打字竞速 · Typing Race
      </h1>
      <p className="mt-4 text-base md:text-lg text-slate-400 text-center max-w-lg">
        Sharpen your typing. Race against yourself, AI, or friends.
      </p>

      <div className="mt-12 w-full max-w-2xl flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/practice?lang=en"
            className="rounded-2xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-sky-500/60 transition p-8 text-left focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <div className="text-2xl font-semibold text-slate-100">
              英文练习
            </div>
            <div className="mt-2 text-sm text-slate-400">
              English · WPM · Live coloring
            </div>
          </Link>
          <Link
            to="/practice?lang=zh"
            className="rounded-2xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-sky-500/60 transition p-8 text-left focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <div className="text-2xl font-semibold text-slate-100">
              中文练习
            </div>
            <div className="mt-2 text-sm text-slate-400">
              中文 · CPM · IME 支持
            </div>
          </Link>
        </div>
        <div
          className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 opacity-50 cursor-not-allowed select-none"
          aria-disabled="true"
        >
          <div className="text-2xl font-semibold text-slate-500">更多模式</div>
          <div className="mt-2 text-sm text-slate-500">
            AI 对战 · 联机 · 即将开放
          </div>
        </div>
      </div>
    </div>
  );
}
