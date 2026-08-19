import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  RealtimeChannel,
  RealtimePresenceState,
} from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconUser, IconUsers } from '../components/Icon';
import { getRandomText, type Language } from '../data/texts';
import { getSupabase, hasSupabaseConfig } from '../lib/supabase';
import { useIsMobile } from '../hooks/useIsMobile';
import { useTypingEngine, type CharState } from '../hooks/useTypingEngine';

/* ---------- Types ---------- */

type Role = 'host' | 'guest';
type Phase =
  | 'lobby'
  | 'create-config' // host picks language
  | 'waiting' // in room, waiting for opponent + ready flags
  | 'countdown'
  | 'racing'
  | 'finished';
type EndReason = 'you' | 'opponent' | 'left';

interface PresenceMeta {
  role: Role;
}

/* ---------- Broadcast event payloads ---------- */

type BroadcastEvent =
  | { type: 'sync-request' } // guest asks host for lang+text after joining
  | { type: 'lang'; lang: Language }
  | { type: 'text'; text: string }
  | { type: 'ready'; role: Role; ready: boolean }
  | { type: 'start'; at: number } // ms epoch when race should start (from host)
  | { type: 'progress'; role: Role; progress: number }
  | { type: 'finish'; role: Role; at: number } // ms epoch finish timestamp
  | { type: 'rematch-ready'; role: Role; ready: boolean }
  | { type: 'rematch-start'; text: string; at: number }; // bundled: new sentence + start timestamp

/* ---------- Char rendering (shared with other race pages) ---------- */

const charClass: Record<CharState, string> = {
  correct: 'text-ink',
  incorrect: 'text-err bg-err-tint rounded-sm',
  current: 'text-ink bg-amber-tint rounded-sm',
  untyped: 'text-ink-soft',
};

const inputVisible =
  'mt-6 sm:mt-8 w-full max-w-3xl px-4 py-3 rounded-xl bg-surface border border-line focus:border-amber outline-none text-ink font-mono text-lg tracking-wide shadow-[0_3px_0_var(--color-keycap)] focus:shadow-[0_2px_0_var(--color-keycap)] transition-[box-shadow]';
const inputHidden = 'absolute left-[-9999px] top-0 opacity-0';

function renderChar(target: string, state: CharState): string {
  if (target === ' ' && state === 'incorrect') return '·';
  return target;
}

/* ---------- Small utilities ---------- */

function random4DigitCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/* ---------- Root component ---------- */

export default function Online() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('lobby');
  const [role, setRole] = useState<Role | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [lang, setLang] = useState<Language>('en');
  const [target, setTarget] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string>('');

  const [meReady, setMeReady] = useState<boolean>(false);
  const [oppReady, setOppReady] = useState<boolean>(false);
  const [oppConnected, setOppConnected] = useState<boolean>(false);
  const [oppProgress, setOppProgress] = useState<number>(0);
  const [meRematchReady, setMeRematchReady] = useState<boolean>(false);
  const [oppRematchReady, setOppRematchReady] = useState<boolean>(false);

  const [raceStartAt, setRaceStartAt] = useState<number | null>(null);
  const [raceEndAt, setRaceEndAt] = useState<number | null>(null);
  const [countdownTick, setCountdownTick] = useState<number>(0);
  const [endReason, setEndReason] = useState<EndReason | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const roleRef = useRef<Role | null>(null); // stable inside listener closures
  const lastProgressSentRef = useRef<number>(0);
  const lastProgressAtRef = useRef<number>(0);
  const finishSentRef = useRef<boolean>(false);
  const myFinishAtRef = useRef<number | null>(null);
  const oppFinishAtRef = useRef<number | null>(null);

  // Refs mirroring state so realtime .on() handlers always see the LATEST
  // values (their closures are locked in at attach-time, before setLang /
  // setTarget from handleCreateRoom have settled).
  const langRef = useRef<Language>(lang);
  const targetRef = useRef<string>(target);
  const meReadyRef = useRef<boolean>(false);
  const endReasonRef = useRef<EndReason | null>(null);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);
  useEffect(() => {
    meReadyRef.current = meReady;
  }, [meReady]);
  useEffect(() => {
    endReasonRef.current = endReason;
  }, [endReason]);

  const engine = useTypingEngine(target, lang);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState<boolean>(true);
  const isMobile = useIsMobile();

  const isZh = lang === 'zh';
  const showInput = isZh || isMobile;
  const unit = isZh ? 'CPM' : 'WPM';
  const playerSpeed = isZh ? engine.stats.cpm : engine.stats.wpm;

  /* ---------- Cleanup on unmount ---------- */

  const cleanupChannel = useCallback(() => {
    const ch = channelRef.current;
    if (ch !== null) {
      try {
        void getSupabase().removeChannel(ch);
      } catch {
        // client may not exist if env missing; ignore
      }
      channelRef.current = null;
    }
  }, []);

  useEffect(() => cleanupChannel, [cleanupChannel]);

  /* ---------- Broadcast helper ---------- */

  const send = useCallback((event: BroadcastEvent) => {
    const ch = channelRef.current;
    if (ch === null) return;
    void ch.send({ type: 'broadcast', event: event.type, payload: event });
  }, []);

  /* ---------- Presence-based opponent tracking ---------- */

  const handlePresenceSync = useCallback(() => {
    const ch = channelRef.current;
    if (ch === null) return;
    const state = ch.presenceState() as RealtimePresenceState<PresenceMeta>;
    const roles = new Set<Role>();
    for (const key of Object.keys(state)) {
      for (const meta of state[key]) {
        roles.add(meta.role);
      }
    }
    const myRole = roleRef.current;
    const oppRole: Role | null =
      myRole === 'host' ? 'guest' : myRole === 'guest' ? 'host' : null;
    const nowConnected = oppRole !== null && roles.has(oppRole);
    setOppConnected((prev) => {
      // Guest joined and we're host → resync lang+text to guest.
      // Read the latest values from refs — closure-captured lang/target would
      // still be the useState defaults (en / '') at the moment attachListeners
      // ran inside handleCreateRoom, before setLang/setTarget committed.
      if (!prev && nowConnected && myRole === 'host') {
        window.setTimeout(() => {
          send({ type: 'lang', lang: langRef.current });
          send({ type: 'text', text: targetRef.current });
        }, 100);
      }
      return nowConnected;
    });
  }, [send]);

  /* ---------- Race-time countdown driver ---------- */

  useEffect(() => {
    if (phase !== 'countdown' || raceStartAt === null) return;
    const tick = () => {
      const remaining = Math.ceil((raceStartAt - Date.now()) / 1000);
      if (remaining <= 0) {
        setCountdownTick(0);
        setPhase('racing');
        return;
      }
      setCountdownTick(remaining);
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [phase, raceStartAt]);

  /* ---------- Focus input on entering racing ---------- */

  useEffect(() => {
    if (phase === 'racing') {
      inputRef.current?.focus();
    }
  }, [phase]);

  /* ---------- Broadcast own progress (throttled) ---------- */

  useEffect(() => {
    if (phase !== 'racing') return;
    const myRole = roleRef.current;
    if (myRole === null) return;
    const p = engine.stats.progress;
    const now = Date.now();
    if (
      p !== lastProgressSentRef.current &&
      (p === 100 || now - lastProgressAtRef.current >= 150)
    ) {
      lastProgressSentRef.current = p;
      lastProgressAtRef.current = now;
      send({ type: 'progress', role: myRole, progress: p });
    }
  }, [engine.stats.progress, phase, send]);

  /* ---------- Cross-race reset (used for rematch) ---------- */

  const resetForNewRace = useCallback(() => {
    // Clear every scrap of previous-race state so the next race starts as
    // clean as the very first one. State setters queue; refs are wiped
    // synchronously so any listener callback firing before the next React
    // commit still sees fresh values (endReasonRef in particular gates
    // tryResolveWinner).
    setEndReason(null);
    endReasonRef.current = null;
    setRaceEndAt(null);
    setOppProgress(0);
    setMeRematchReady(false);
    setOppRematchReady(false);
    finishSentRef.current = false;
    myFinishAtRef.current = null;
    oppFinishAtRef.current = null;
    lastProgressSentRef.current = 0;
    lastProgressAtRef.current = 0;
  }, []);

  /* ---------- Winner resolution ---------- */

  const tryResolveWinner = useCallback(() => {
    // Read via ref so the callback is stable across renders — otherwise
    // attachListeners would need to be recreated (and re-attached) every
    // time endReason changes, which we can't do post-subscribe.
    if (endReasonRef.current !== null) return;
    const mine = myFinishAtRef.current;
    const opp = oppFinishAtRef.current;
    if (mine === null && opp === null) return;
    if (mine !== null && opp !== null) {
      const winner: EndReason = mine <= opp ? 'you' : 'opponent';
      setRaceEndAt(mine <= opp ? mine : opp);
      setEndReason(winner);
      setPhase('finished');
      return;
    }
    if (mine !== null && opp === null) {
      setRaceEndAt(mine);
      setEndReason('you');
      setPhase('finished');
      return;
    }
    if (opp !== null && mine === null) {
      setRaceEndAt(opp);
      setEndReason('opponent');
      setPhase('finished');
    }
  }, []);

  /* ---------- Detect own finish ---------- */

  useEffect(() => {
    if (phase !== 'racing') return;
    if (!engine.isComplete) return;
    // Guard against the empty-string edge case: useTypingEngine treats
    // `committedInput === target` as complete, and both are '' before the
    // guest has received `text` from host — that would fire a bogus finish
    // the instant we enter racing. Real races always have a non-empty target.
    if (target.length === 0) return;
    if (finishSentRef.current) return;
    const myRole = roleRef.current;
    if (myRole === null) return;
    finishSentRef.current = true;
    const at = engine.endedAt ?? Date.now();
    myFinishAtRef.current = at;
    // Ensure the last progress=100 is broadcast (finish alone doesn't imply it)
    lastProgressSentRef.current = 100;
    send({ type: 'progress', role: myRole, progress: 100 });
    send({ type: 'finish', role: myRole, at });
    tryResolveWinner();
  }, [
    engine.isComplete,
    phase,
    target,
    engine.endedAt,
    send,
    tryResolveWinner,
  ]);

  /* ---------- Broadcast event dispatcher (single subscription) ---------- */

  const attachListeners = useCallback(
    (ch: RealtimeChannel) => {
      const onEvent = (ev: string, payload: BroadcastEvent) => {
        const myRole = roleRef.current;
        switch (payload.type) {
          case 'sync-request':
            if (myRole === 'host') {
              // Read from refs, not closures: attachListeners captured its
              // deps at the moment handleCreateRoom kicked off, before
              // setLang/setTarget for the chosen language had committed.
              send({ type: 'lang', lang: langRef.current });
              send({ type: 'text', text: targetRef.current });
              if (meReadyRef.current) {
                send({ type: 'ready', role: 'host', ready: true });
              }
            }
            break;
          case 'lang':
            if (myRole === 'guest') setLang(payload.lang);
            break;
          case 'text':
            if (myRole === 'guest' && payload.text.length > 0)
              setTarget(payload.text);
            break;
          case 'ready':
            if (payload.role !== myRole) setOppReady(payload.ready);
            break;
          case 'start':
            setRaceStartAt(payload.at);
            setPhase('countdown');
            break;
          case 'progress':
            if (payload.role !== myRole) setOppProgress(payload.progress);
            break;
          case 'finish':
            if (payload.role !== myRole) {
              oppFinishAtRef.current = payload.at;
              // Freeze opponent bar at 100
              setOppProgress(100);
              tryResolveWinner();
            }
            break;
          case 'rematch-ready':
            if (payload.role !== myRole) setOppRematchReady(payload.ready);
            break;
          case 'rematch-start':
            // Host bundles new target + start timestamp into one message so
            // guest never races into countdown holding the previous target.
            if (myRole === 'guest') {
              resetForNewRace();
              setTarget(payload.text);
              setRaceStartAt(payload.at);
              setPhase('countdown');
            }
            break;
          default:
            break;
        }
        // Referenced to silence "unused ev" — keep for potential debugging
        void ev;
      };

      ch.on('broadcast', { event: 'sync-request' }, ({ payload }) =>
        onEvent('sync-request', payload as BroadcastEvent),
      );
      ch.on('broadcast', { event: 'lang' }, ({ payload }) =>
        onEvent('lang', payload as BroadcastEvent),
      );
      ch.on('broadcast', { event: 'text' }, ({ payload }) =>
        onEvent('text', payload as BroadcastEvent),
      );
      ch.on('broadcast', { event: 'ready' }, ({ payload }) =>
        onEvent('ready', payload as BroadcastEvent),
      );
      ch.on('broadcast', { event: 'start' }, ({ payload }) =>
        onEvent('start', payload as BroadcastEvent),
      );
      ch.on('broadcast', { event: 'progress' }, ({ payload }) =>
        onEvent('progress', payload as BroadcastEvent),
      );
      ch.on('broadcast', { event: 'finish' }, ({ payload }) =>
        onEvent('finish', payload as BroadcastEvent),
      );
      ch.on('broadcast', { event: 'rematch-ready' }, ({ payload }) =>
        onEvent('rematch-ready', payload as BroadcastEvent),
      );
      ch.on('broadcast', { event: 'rematch-start' }, ({ payload }) =>
        onEvent('rematch-start', payload as BroadcastEvent),
      );

      ch.on('presence', { event: 'sync' }, handlePresenceSync);
      ch.on('presence', { event: 'join' }, handlePresenceSync);
      ch.on('presence', { event: 'leave' }, () => {
        handlePresenceSync();
        // If a race is in progress or waiting, treat opponent leaving as a
        // forfeit → we "win" (marked as 'left' for a distinct UI message).
        // Use a slight defer so presenceState reflects the leave.
        window.setTimeout(() => {
          const stillHere = channelRef.current;
          if (stillHere === null) return;
          const state =
            stillHere.presenceState() as RealtimePresenceState<PresenceMeta>;
          const roles = new Set<Role>();
          for (const key of Object.keys(state)) {
            for (const meta of state[key]) {
              roles.add(meta.role);
            }
          }
          const myRole2 = roleRef.current;
          const oppRole =
            myRole2 === 'host' ? 'guest' : myRole2 === 'guest' ? 'host' : null;
          if (oppRole !== null && !roles.has(oppRole)) {
            setOppConnected(false);
            setPhase((p) =>
              p === 'racing' || p === 'countdown' || p === 'waiting'
                ? 'finished'
                : p,
            );
            setEndReason((r) => r ?? 'left');
            setRaceEndAt((prev) => prev ?? Date.now());
          }
        }, 50);
      });
    },
    [handlePresenceSync, send, tryResolveWinner, resetForNewRace],
  );

  /* ---------- Create room ---------- */

  const handleCreateRoom = useCallback(
    async (chosenLang: Language) => {
      if (!hasSupabaseConfig()) {
        setErrorMsg(
          'Supabase 环境变量未配置(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY),请在 .env.local 里填上再刷新。',
        );
        return;
      }
      setErrorMsg('');
      setStatusMsg('正在创建房间…');
      setLang(chosenLang);
      const initialTarget = getRandomText(chosenLang);
      setTarget(initialTarget);

      const supabase = getSupabase();
      let attempts = 0;
      while (attempts < 8) {
        attempts += 1;
        const code = random4DigitCode();
        const channelName = `room-${code}`;
        const probe = supabase.channel(channelName, {
          config: { presence: { key: 'host' } },
        });
        // Supabase requires all .on() listeners to be registered BEFORE
        // subscribe(). Attach here so that if the probe finds the code free
        // it can be promoted straight into the working channel with no
        // second subscribe (attaching after subscribe would throw
        // "cannot add `presence` callbacks after subscribe()"). Listener
        // callbacks are safe to run during the probe window — roleRef is
        // still null so handlePresenceSync short-circuits.
        attachListeners(probe);
        // eslint-disable-next-line no-await-in-loop
        const occupied = await new Promise<boolean>((resolve) => {
          let settled = false;
          const timeout = window.setTimeout(() => {
            if (!settled) {
              settled = true;
              resolve(false); // couldn't confirm → treat as free
            }
          }, 1200);
          probe.subscribe((status) => {
            if (status !== 'SUBSCRIBED') return;
            // Give presence a beat to sync existing peers, then decide
            window.setTimeout(() => {
              if (settled) return;
              const state =
                probe.presenceState() as RealtimePresenceState<PresenceMeta>;
              const peerCount = Object.keys(state).length;
              settled = true;
              window.clearTimeout(timeout);
              resolve(peerCount > 0);
            }, 300);
          });
        });

        if (occupied) {
          // eslint-disable-next-line no-await-in-loop
          await supabase.removeChannel(probe);
          continue;
        }

        // Claim: probe was free — promote it to the working channel.
        // Listeners are already attached; just flip role state + track presence.
        channelRef.current = probe;
        roleRef.current = 'host';
        setRole('host');
        setRoomCode(code);
        // eslint-disable-next-line no-await-in-loop
        await probe.track({ role: 'host' } as PresenceMeta);
        setStatusMsg('');
        setPhase('waiting');
        return;
      }
      setStatusMsg('');
      setErrorMsg('无法分配房间号,请重试。');
    },
    [attachListeners],
  );

  /* ---------- Join room ---------- */

  const handleJoinRoom = useCallback(async () => {
    if (!hasSupabaseConfig()) {
      setErrorMsg(
        'Supabase 环境变量未配置(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY),请在 .env.local 里填上再刷新。',
      );
      return;
    }
    const code = joinCodeInput.trim();
    if (!/^\d{4}$/.test(code)) {
      setErrorMsg('房间号必须是 4 位数字。');
      return;
    }
    setErrorMsg('');
    setStatusMsg('正在加入房间…');
    const supabase = getSupabase();
    const channelName = `room-${code}`;
    const ch = supabase.channel(channelName, {
      config: { presence: { key: 'guest' } },
    });
    channelRef.current = ch;
    roleRef.current = 'guest';
    attachListeners(ch);

    const subscribed = await new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => resolve(false), 5000);
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          window.clearTimeout(timeout);
          resolve(true);
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          window.clearTimeout(timeout);
          resolve(false);
        }
      });
    });
    if (!subscribed) {
      cleanupChannel();
      roleRef.current = null;
      setRole(null);
      setStatusMsg('');
      setErrorMsg('无法连接到该房间,请检查房间号。');
      return;
    }

    // Verify a host is actually present in this room
    await new Promise<void>((r) => window.setTimeout(r, 300));
    const state = ch.presenceState() as RealtimePresenceState<PresenceMeta>;
    let hostPresent = false;
    for (const key of Object.keys(state)) {
      for (const meta of state[key]) {
        if (meta.role === 'host') hostPresent = true;
      }
    }
    if (!hostPresent) {
      cleanupChannel();
      roleRef.current = null;
      setRole(null);
      setStatusMsg('');
      setErrorMsg('房间不存在或房主已离开。');
      return;
    }

    setRole('guest');
    setRoomCode(code);
    await ch.track({ role: 'guest' } as PresenceMeta);
    // Ask host to send us the room's lang + text
    send({ type: 'sync-request' });
    setStatusMsg('');
    setPhase('waiting');
  }, [attachListeners, cleanupChannel, joinCodeInput, send]);

  /* ---------- Ready toggle ---------- */

  const toggleReady = useCallback(() => {
    const myRole = roleRef.current;
    if (myRole === null) return;
    const next = !meReady;
    setMeReady(next);
    send({ type: 'ready', role: myRole, ready: next });
  }, [meReady, send]);

  /* ---------- Host: kick off race when both ready ---------- */

  useEffect(() => {
    if (phase !== 'waiting') return;
    const myRole = roleRef.current;
    if (myRole !== 'host') return;
    if (meReady && oppReady) {
      const startAt = Date.now() + 3500;
      send({ type: 'start', at: startAt });
      setRaceStartAt(startAt);
      setPhase('countdown');
    }
  }, [meReady, oppReady, phase, send]);

  /* ---------- Rematch ---------- */

  const handleRematch = useCallback(() => {
    const myRole = roleRef.current;
    if (myRole === null) return;
    setMeRematchReady(true);
    send({ type: 'rematch-ready', role: myRole, ready: true });
  }, [send]);

  // Host: when both sides have opted into rematch, roll a fresh sentence in
  // the same language, reset all race state, and broadcast rematch-start
  // (which carries text + timestamp together so guest can't race with a
  // stale target). Guarded on oppConnected so a dropped opponent doesn't
  // silently kick off a new race that only we can play.
  useEffect(() => {
    if (phase !== 'finished') return;
    if (roleRef.current !== 'host') return;
    if (!oppConnected) return;
    if (!meRematchReady || !oppRematchReady) return;

    const newText = getRandomText(langRef.current, targetRef.current);
    const startAt = Date.now() + 3500;
    resetForNewRace();
    setTarget(newText);
    send({ type: 'rematch-start', text: newText, at: startAt });
    setRaceStartAt(startAt);
    setPhase('countdown');
  }, [
    phase,
    meRematchReady,
    oppRematchReady,
    oppConnected,
    send,
    resetForNewRace,
  ]);

  /* ---------- Reset when leaving to home ---------- */

  const handleHome = useCallback(() => {
    cleanupChannel();
    navigate('/');
  }, [cleanupChannel, navigate]);

  /* ---------- Render helpers ---------- */

  const raceTimeMs =
    raceStartAt !== null && raceEndAt !== null ? raceEndAt - raceStartAt : 0;

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div
      className={`min-h-dvh bg-canvas text-ink flex flex-col items-center px-4 sm:px-6 ${
        phase === 'racing' && !showInput ? 'cursor-text' : ''
      }`}
      onClick={
        phase === 'racing' && !showInput
          ? () => inputRef.current?.focus()
          : undefined
      }
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
          <IconUsers size={14} className="text-amber" />
          {roomCode
            ? `房间 ${roomCode} · ${isZh ? '中文 · CPM' : 'English · WPM'}`
            : '联机对战'}
        </div>
      </header>

      {errorMsg !== '' && (
        <div
          className="w-full max-w-2xl mt-4 rounded-xl bg-err-tint border border-err/40 text-err text-sm px-4 py-3"
          onClick={(e) => e.stopPropagation()}
        >
          {errorMsg}
        </div>
      )}
      {statusMsg !== '' && (
        <div
          className="w-full max-w-2xl mt-4 text-center text-sm text-ink-soft"
          onClick={(e) => e.stopPropagation()}
        >
          {statusMsg}
        </div>
      )}

      {phase === 'lobby' && (
        <LobbyView
          joinCodeInput={joinCodeInput}
          onJoinCodeChange={setJoinCodeInput}
          onCreate={() => setPhase('create-config')}
          onJoin={handleJoinRoom}
        />
      )}

      {phase === 'create-config' && (
        <CreateConfigView
          onPick={(l) => void handleCreateRoom(l)}
          onBack={() => setPhase('lobby')}
        />
      )}

      {phase === 'waiting' && (
        <WaitingView
          role={role}
          roomCode={roomCode}
          lang={lang}
          oppConnected={oppConnected}
          meReady={meReady}
          oppReady={oppReady}
          hasTarget={target.length > 0}
          onToggleReady={toggleReady}
        />
      )}

      {(phase === 'countdown' ||
        phase === 'racing' ||
        phase === 'finished') && (
        <div
          className="w-full flex flex-col items-center pt-2"
          onClick={(e) => e.stopPropagation()}
        >
          <ProgressBars
            youPct={engine.stats.progress}
            oppPct={oppProgress}
            role={role}
          />

          {phase === 'racing' && (
            <div className="w-full max-w-3xl flex items-center gap-6 sm:gap-8 justify-end mb-6 text-ink">
              <MiniStat label={unit} value={playerSpeed} />
              <MiniStat label="Acc" value={`${engine.stats.accuracy}%`} />
            </div>
          )}

          {phase !== 'finished' && target !== '' && (
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
                key={countdownTick}
                className="text-7xl sm:text-8xl md:text-9xl font-mono font-bold text-amber tabular-nums"
              >
                {countdownTick > 0 ? countdownTick : ''}
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

          {phase === 'finished' && endReason !== null && (
            <FinishedView
              endReason={endReason}
              unit={unit}
              playerSpeed={playerSpeed}
              accuracy={engine.stats.accuracy}
              raceTimeMs={raceTimeMs}
              oppConnected={oppConnected}
              meRematchReady={meRematchReady}
              oppRematchReady={oppRematchReady}
              onRematch={handleRematch}
              onHome={handleHome}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Sub-views ---------- */

function LobbyView({
  joinCodeInput,
  onJoinCodeChange,
  onCreate,
  onJoin,
}: {
  joinCodeInput: string;
  onJoinCodeChange: (v: string) => void;
  onCreate: () => void;
  onJoin: () => void;
}) {
  return (
    <div
      className="w-full max-w-2xl mt-8 sm:mt-16 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onCreate}
        className="rounded-xl border border-line bg-surface hover:border-amber shadow-[0_4px_0_var(--color-keycap)] hover:shadow-[0_2px_0_var(--color-keycap)] hover:translate-y-[2px] active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-keycap)] transition-[transform,box-shadow,border-color] duration-75 p-6 sm:p-8 text-left focus:outline-none focus:ring-2 focus:ring-amber"
      >
        <div className="font-mono text-xl sm:text-2xl font-semibold text-ink">
          创建房间
        </div>
        <div className="mt-2 text-sm text-ink-soft">
          Create · 由你选语言,分享 4 位房间号
        </div>
      </button>
      <div className="rounded-xl border border-line bg-surface shadow-[0_4px_0_var(--color-keycap)] p-6 sm:p-8 flex flex-col gap-3">
        <div className="font-mono text-xl sm:text-2xl font-semibold text-ink">
          加入房间
        </div>
        <div className="text-sm text-ink-soft">Join · 输入 4 位房间号</div>
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          value={joinCodeInput}
          onChange={(e) =>
            onJoinCodeChange(e.target.value.replace(/\D/g, '').slice(0, 4))
          }
          placeholder="0000"
          className="mt-1 w-full text-center text-3xl tabular-nums tracking-widest font-mono px-4 py-3 rounded-xl bg-canvas border border-line focus:border-amber outline-none text-ink placeholder:text-ink-soft"
        />
        <button
          type="button"
          onClick={onJoin}
          disabled={joinCodeInput.length !== 4}
          className="mt-2 rounded-full bg-amber hover:bg-amber-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 shadow-[0_3px_0_var(--color-keycap)] hover:shadow-[0_2px_0_var(--color-keycap)] hover:translate-y-[1px] active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-keycap)] transition-[transform,box-shadow,background-color] duration-75"
        >
          加入
        </button>
      </div>
    </div>
  );
}

function CreateConfigView({
  onPick,
  onBack,
}: {
  onPick: (lang: Language) => void;
  onBack: () => void;
}) {
  return (
    <div
      className="w-full max-w-2xl mt-8 sm:mt-16 flex flex-col items-center"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-sm uppercase tracking-widest text-amber font-mono">
        选择房间语言 · Room language
      </div>
      <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
        <button
          type="button"
          onClick={() => onPick('en')}
          className="rounded-xl border border-line bg-surface hover:border-amber shadow-[0_4px_0_var(--color-keycap)] hover:shadow-[0_2px_0_var(--color-keycap)] hover:translate-y-[2px] active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-keycap)] transition-[transform,box-shadow,border-color] duration-75 p-6 sm:p-8 text-left focus:outline-none focus:ring-2 focus:ring-amber"
        >
          <div className="font-mono text-xl sm:text-2xl font-semibold text-ink">
            英文房间
          </div>
          <div className="mt-2 text-sm text-ink-soft">English · WPM</div>
        </button>
        <button
          type="button"
          onClick={() => onPick('zh')}
          className="rounded-xl border border-line bg-surface hover:border-amber shadow-[0_4px_0_var(--color-keycap)] hover:shadow-[0_2px_0_var(--color-keycap)] hover:translate-y-[2px] active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-keycap)] transition-[transform,box-shadow,border-color] duration-75 p-6 sm:p-8 text-left focus:outline-none focus:ring-2 focus:ring-amber"
        >
          <div className="font-mono text-xl sm:text-2xl font-semibold text-ink">
            中文房间
          </div>
          <div className="mt-2 text-sm text-ink-soft">中文 · CPM · IME</div>
        </button>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="mt-8 text-xs text-ink-soft hover:text-amber underline underline-offset-4 transition"
      >
        返回大厅
      </button>
    </div>
  );
}

function WaitingView({
  role,
  roomCode,
  lang,
  oppConnected,
  meReady,
  oppReady,
  hasTarget,
  onToggleReady,
}: {
  role: Role | null;
  roomCode: string;
  lang: Language;
  oppConnected: boolean;
  meReady: boolean;
  oppReady: boolean;
  hasTarget: boolean;
  onToggleReady: () => void;
}) {
  const isZh = lang === 'zh';
  const canReady = oppConnected && hasTarget;
  return (
    <div
      className="w-full max-w-2xl mt-8 sm:mt-12 flex flex-col items-center"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-xs uppercase tracking-widest text-ink-soft font-mono">
        房间号 · Room Code
      </div>
      <div className="mt-3 inline-block rounded-xl border border-line bg-surface shadow-[0_4px_0_var(--color-keycap)] px-6 sm:px-10 py-4 sm:py-5">
        <div className="font-mono text-5xl sm:text-7xl md:text-8xl font-bold tabular-nums tracking-widest text-amber">
          {roomCode}
        </div>
      </div>
      <div className="mt-4 text-sm text-ink-soft font-mono">
        {isZh ? '中文房间 · CPM' : 'English 房间 · WPM'} ·{' '}
        {role === 'host' ? '你是房主' : '你是访客'}
      </div>

      <div className="mt-8 sm:mt-10 w-full grid grid-cols-2 gap-3 sm:gap-4">
        <PlayerCard
          title={role === 'host' ? '你 (房主)' : '你 (访客)'}
          connected
          ready={meReady}
          highlight="you"
        />
        <PlayerCard
          title={role === 'host' ? '对手 (访客)' : '对手 (房主)'}
          connected={oppConnected}
          ready={oppReady}
          highlight="opp"
        />
      </div>

      <button
        type="button"
        onClick={onToggleReady}
        disabled={!canReady}
        className={`mt-8 sm:mt-10 rounded-full px-10 py-3 font-medium shadow-[0_3px_0_var(--color-keycap)] hover:shadow-[0_2px_0_var(--color-keycap)] hover:translate-y-[1px] active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-keycap)] transition-[transform,box-shadow,background-color] duration-75 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_3px_0_var(--color-keycap)] ${
          meReady
            ? 'bg-surface border border-line text-ink hover:bg-surface-soft'
            : 'bg-amber hover:bg-amber-hover text-white'
        }`}
      >
        {meReady ? '取消准备' : '准备'}
      </button>

      {!oppConnected && (
        <div className="mt-4 text-xs text-ink-soft text-center">
          {role === 'host'
            ? '把房间号发给朋友让 TA 加入…'
            : '等待房主准备好房间…'}
        </div>
      )}
      {oppConnected && !hasTarget && role === 'guest' && (
        <div className="mt-4 text-xs text-ink-soft">
          正在同步房间语言和文本…
        </div>
      )}
      {oppConnected && meReady && oppReady && role === 'guest' && (
        <div className="mt-4 text-xs text-ink-soft">等待房主开始…</div>
      )}
    </div>
  );
}

function PlayerCard({
  title,
  connected,
  ready,
  highlight,
}: {
  title: string;
  connected: boolean;
  ready: boolean;
  highlight: 'you' | 'opp';
}) {
  return (
    <div className="rounded-xl border border-line bg-surface shadow-[0_4px_0_var(--color-keycap)] p-4 sm:p-5 text-center">
      <div
        className={`text-sm font-mono font-medium ${
          highlight === 'you' ? 'text-amber' : 'text-ink-soft'
        }`}
      >
        {title}
      </div>
      <div className="mt-3 text-xs text-ink-soft">
        {connected ? '已连接' : '未连接'}
      </div>
      <div className="mt-1 text-sm font-medium">
        {ready ? (
          <span className="text-amber font-mono">✓ 准备</span>
        ) : (
          <span className="text-ink-soft">未准备</span>
        )}
      </div>
    </div>
  );
}

function ProgressBars({
  youPct,
  oppPct,
  role,
}: {
  youPct: number;
  oppPct: number;
  role: Role | null;
}) {
  return (
    <div className="w-full max-w-3xl space-y-3 mb-6">
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="inline-flex items-center gap-1.5 text-amber font-medium font-mono">
            <IconUser size={14} />
            你 · You
          </span>
          <span className="tabular-nums text-ink-soft font-mono">{youPct}%</span>
        </div>
        <div className="h-3 rounded-full bg-surface-soft overflow-hidden border border-line">
          <div
            className="h-full bg-amber transition-all duration-150"
            style={{ width: `${youPct}%` }}
          />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="inline-flex items-center gap-1.5 text-ink-soft font-medium font-mono">
            <IconUser size={14} />
            对手 · {role === 'host' ? '访客' : '房主'}
          </span>
          <span className="tabular-nums text-ink-soft font-mono">
            {Math.floor(oppPct)}%
          </span>
        </div>
        <div className="h-3 rounded-full bg-surface-soft overflow-hidden border border-line">
          <div
            className="h-full bg-ink-soft transition-all duration-150"
            style={{ width: `${oppPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function FinishedView({
  endReason,
  unit,
  playerSpeed,
  accuracy,
  raceTimeMs,
  oppConnected,
  meRematchReady,
  oppRematchReady,
  onRematch,
  onHome,
}: {
  endReason: EndReason;
  unit: string;
  playerSpeed: number;
  accuracy: number;
  raceTimeMs: number;
  oppConnected: boolean;
  meRematchReady: boolean;
  oppRematchReady: boolean;
  onRematch: () => void;
  onHome: () => void;
}) {
  const title =
    endReason === 'you'
      ? '你赢了 · You Win'
      : endReason === 'opponent'
        ? '你输了 · You Lose'
        : '对方已离开 · Opponent Left';
  const color =
    endReason === 'you'
      ? 'text-amber'
      : endReason === 'opponent'
        ? 'text-ink-soft'
        : 'text-ink-soft';
  const canRematch = oppConnected;
  return (
    <div className="flex flex-col items-center pt-4 sm:pt-6">
      <div
        className={`text-xs sm:text-sm uppercase tracking-widest font-mono ${color}`}
      >
        {title}
      </div>
      <div className="mt-6 sm:mt-8 grid grid-cols-3 gap-3 sm:gap-6">
        <BigStat label={unit} value={playerSpeed} />
        <BigStat label="Accuracy" value={`${accuracy}%`} />
        <BigStat
          label="Time"
          value={raceTimeMs > 0 ? `${(raceTimeMs / 1000).toFixed(1)}s` : '—'}
        />
      </div>

      {canRematch && oppRematchReady && !meRematchReady && (
        <div className="mt-6 sm:mt-8 text-xs text-amber font-mono">
          对方已选择再来一局 · 等你确认
        </div>
      )}
      {!canRematch && endReason !== 'left' && (
        <div className="mt-6 sm:mt-8 text-xs text-ink-soft">
          对方已离开 · 只能回首页
        </div>
      )}

      <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-sm sm:w-auto">
        {canRematch && (
          <button
            type="button"
            onClick={onRematch}
            disabled={meRematchReady}
            className={`rounded-full px-8 py-3 font-medium shadow-[0_3px_0_var(--color-keycap)] hover:shadow-[0_2px_0_var(--color-keycap)] hover:translate-y-[1px] active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-keycap)] transition-[transform,box-shadow,background-color] duration-75 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_3px_0_var(--color-keycap)] ${
              meRematchReady
                ? 'bg-surface border border-line text-ink-soft'
                : 'bg-amber hover:bg-amber-hover text-white'
            }`}
          >
            {meRematchReady ? '等待对方…' : '再来一局'}
          </button>
        )}
        <button
          type="button"
          onClick={onHome}
          className="rounded-full border border-line bg-surface hover:bg-surface-soft text-ink font-medium px-8 py-3 shadow-[0_3px_0_var(--color-keycap)] hover:shadow-[0_2px_0_var(--color-keycap)] hover:translate-y-[1px] active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-keycap)] transition-[transform,box-shadow,background-color] duration-75"
        >
          回首页
        </button>
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
