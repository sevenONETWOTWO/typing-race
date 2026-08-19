# 打字竞速 · Typing Race

一款支持中英文、单人 / AI / 联机三种模式的打字竞速网页游戏 —— 看谁打得又快又准。

## 在线体验

[https://typing-race-pearl.vercel.app/](https://typing-race-pearl.vercel.app/)

## 功能特性

- **三种模式**
  - **单人练习**:自己刷句库、看实时数据
  - **AI 对战**:三档难度(简单 / 中等 / 困难),进度条实时赛跑,先到 100% 者胜
  - **实时联机对战**:1v1 房间号邀请制,自带"再来一局"握手,同一房间不用换人
- **中英文支持**:英文按 **WPM**(words per minute)统计,中文按 **CPM**(characters per minute)统计,支持系统输入法逐字比对(IME 合成结束后才判定,拼音中间态不判红)
- **实时统计**:WPM / CPM、准确率、进度条,每次按键即时更新;打错的字符实时标红
- **严格纠错**:进度只认从头开始连续正确的字符,打错必须先改对才能继续推进
- **联机基于 Supabase Realtime**:纯 broadcast + presence,不建数据库表;4 位房间号邀请对手;presence 掉线检测,对方断线立即结束
- **机械键盘主题**:米白暖色 + 琥珀黄点缀,键帽立体阴影,支持浅色 / 深色手动切换,选择记入 localStorage
- **响应式**:手机竖屏单列、桌面多列;移动端英文输入自动切换为可见输入 bar,保证虚拟键盘正常弹起

## 技术栈

- **前端**:[Vite](https://vitejs.dev/) + [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Tailwind CSS v4](https://tailwindcss.com/)
- **联机**:[Supabase Realtime](https://supabase.com/docs/guides/realtime)(broadcast + presence,不使用数据库表)
- **路由**:[React Router](https://reactrouter.com/)
- **Lint**:[oxlint](https://oxc.rs/)
- **部署**:[Vercel](https://vercel.com/)

## 本地运行

**前提**:Node.js 18+

```bash
# 克隆
git clone https://github.com/sevenONETWOTWO/typing-race.git
cd typing-race

# 安装依赖
npm install

# 配置环境变量(联机模式需要,详见下方 "环境变量" 章节)
# 在项目根目录创建 .env.local,填入下面两个变量
cp .env.example .env.local  # 若无 .env.example 则手动新建

# 启动开发服务器
npm run dev

# 构建生产产物
npm run build

# 代码检查
npm run lint
```

## 环境变量

联机对战依赖 Supabase Realtime,需要以下两个变量。在项目根目录的 `.env.local` 里配置(该文件已被 `.gitignore` 忽略,不会入库):

| 变量名 | 用途 |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase 项目的 **Project URL** |
| `VITE_SUPABASE_ANON_KEY` | Supabase 项目的 **anon public key**(前端公开使用) |

**获取方式**:登录 [Supabase](https://supabase.com/) 控制台 → 打开对应 project → **Settings** → **API**,在 "Project URL" 和 "Project API keys → anon public" 两栏复制。

> 💡 不配置这两个变量时,**单人练习** 和 **AI 对战** 仍可正常使用,只有 **联机对战** 页面会提示配置缺失。

`.env.local` 示例(不要在此文件中提交真实值):

```bash
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-public-key>
```

## 部署

项目部署在 Vercel 上,配置方式:

1. 在 Vercel 上 **Import** 该 GitHub 仓库,框架预设选 **Vite**
2. 在 **Settings → Environment Variables** 里配置上面两个环境变量(Production / Preview / Development 三个环境都要加,或按需)
3. 推送到 `main` 分支即自动触发生产部署;PR 分支自动创建预览环境

## 项目结构

```
typing-race/
├── public/
│   └── favicon.svg              # 键盘图标 favicon
├── src/
│   ├── pages/
│   │   ├── Home.tsx             # 首页 · 三种模式入口
│   │   ├── Practice.tsx         # 单人练习(?lang=en|zh)
│   │   ├── AIRace.tsx           # AI 对战(?lang=en|zh)
│   │   └── Online.tsx           # 联机对战 · 大厅 / 房间 / 结算
│   ├── hooks/
│   │   ├── useTypingEngine.ts   # 核心打字引擎(标色、WPM/CPM、严格纠错、IME 合成处理)
│   │   ├── useAIRacer.ts        # AI 对手推进 hook(定时器 + 匀速)
│   │   └── useIsMobile.ts       # 响应式检测
│   ├── components/
│   │   ├── Icon.tsx             # 内联 SVG 图标集
│   │   └── ThemeToggle.tsx      # 浅色 / 深色主题切换按钮
│   ├── lib/
│   │   └── supabase.ts          # Supabase 懒加载客户端
│   ├── data/
│   │   ├── texts.ts             # 中英文句库 + 随机取句
│   │   └── aiSpeeds.ts          # AI 难度速度配置(easy/medium/hard)
│   ├── App.tsx                  # 路由配置 + 主题切换按钮挂载
│   ├── main.tsx                 # 入口
│   └── index.css                # Tailwind + 主题 CSS 变量
├── index.html                   # 无闪主题初始化脚本
├── vite.config.ts
└── tsconfig*.json
```

**核心逻辑集中在 `src/hooks/useTypingEngine.ts`** —— 三种模式(单人 / AI / 联机)都复用同一个打字引擎,包括字符状态计算、WPM / CPM 统计、严格纠错逻辑和中文 IME 合成事件处理。修改打字体验相关的行为改这一个文件即可。

## 许可

个人项目,仅供学习和自用。
