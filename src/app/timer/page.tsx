"use client";

import { Bell, BellOff, Play, Plus, Square, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { confirmDialog, promptDialog } from "@/components/dialog";
import { toast } from "@/components/ui";
import { tap } from "@/lib/motion";
import { askToNotify, canNotify, notifyAllowed } from "@/lib/notify";
import { byOrder, useClock, useStore } from "@/lib/store";
import { formatClock, isRunning, sessionMinutes, totalsByTask } from "@/lib/timer";
import type { TimerSession } from "@/lib/types";
import { cn, formatMinutes } from "@/lib/utils";

/** The lengths on offer; null counts up until you stop. */
const LENGTHS: (number | null)[] = [15, 25, 45, 60, 90, null];
const SAFETY_STOP = 24 * 3_600_000; // a forgotten stopwatch stops itself after a day

/** Start timing now: for `minutes`, or counting up when there are none. No name needed — it's "Focus". */
function begin(title: string, minutes: number | null) {
  const { addTimerTask, startTimer } = useStore.getState();
  const start = Date.now();
  tap(14);
  // Ask for notifications on the first start, so a finished timer can reach you.
  void askToNotify();
  const id = addTimerTask(title.trim() || "Focus");
  if (minutes === null) startTimer(id, start + SAFETY_STOP, true);
  else startTimer(id, start + minutes * 60_000);
}

const clockTime = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const lengthLabel = (m: number | null) => (m === null ? "∞" : m < 60 ? `${m}` : `${m / 60}h`);

/** The clock every second, only while something is running. */
function useTicking(active: boolean) {
  const base = useClock((s) => s.now);
  const [now, setNow] = useState(base);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return Math.max(now, base);
}

/** Timer — a name if you like, a length, one tap. A big clock while it runs; a ring when it ends. */
export default function TimerPage() {
  const today = useClock((s) => s.today);
  const sessions = useStore((s) => s.timerSessions);
  const hasRunning = sessions.some((s) => !s.endedAt);
  const now = useTicking(hasRunning);
  const running = sessions.find((s) => isRunning(s, now));

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-2 flex justify-end">
        <NotifyToggle />
      </div>
      {running ? <Running session={running} now={now} /> : <Start />}
      <Today sessions={sessions} today={today} now={now} />
    </div>
  );
}

/** A bell: on means a finished timer sends a notification. */
function NotifyToggle() {
  const [allowed, setAllowed] = useState(() => (canNotify() ? notifyAllowed() : null));
  if (allowed === null) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        if (allowed) return toast("Notifications are on");
        const ok = await askToNotify();
        setAllowed(ok);
        toast(ok ? "You'll be notified when a timer ends" : "Notifications are blocked in your browser's settings");
      }}
      aria-label={allowed ? "Notifications on" : "Turn on notifications"}
      title={allowed ? "Notifications on" : "Turn on notifications"}
      className={cn("flex size-10 items-center justify-center rounded-full transition-colors hover:bg-surface-2", allowed ? "text-crystal" : "text-faint")}
    >
      {allowed ? <Bell className="size-[18px]" /> : <BellOff className="size-[18px]" />}
    </button>
  );
}

function Start() {
  const tasks = useStore((s) => s.timerTasks);
  const sessions = useStore((s) => s.timerSessions);
  const [title, setTitle] = useState("");
  const [length, setLength] = useState<number | null>(25);
  // The few things you timed most recently, one tap to reuse.
  const recent = useMemo(() => {
    const last = new Map<string, number>();
    for (const s of sessions) last.set(s.taskId, Math.max(last.get(s.taskId) ?? 0, s.startedAt));
    return [...tasks].sort((a, b) => (last.get(b.id) ?? 0) - (last.get(a.id) ?? 0) || byOrder(b, a)).slice(0, 4);
  }, [tasks, sessions]);
  const same = (t: string) => title.trim().toLowerCase() === t.toLowerCase();

  return (
    <div className="animate-fade flex flex-col items-center">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What are you working on?"
        aria-label="What you're timing"
        enterKeyHint="done"
        className="h-12 w-full bg-transparent text-center text-[19px] outline-none placeholder:text-faint"
      />
      {recent.length > 0 && (
        <div className="mt-1 flex flex-wrap justify-center gap-1.5">
          {recent.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTitle(same(t.title) ? "" : t.title)}
              className={cn("h-8 rounded-full px-3 text-[13px] transition-colors", same(t.title) ? "bg-surface-3 text-fg" : "text-faint hover:text-fg")}
            >
              {t.title}
            </button>
          ))}
        </div>
      )}

      {/* One tap. */}
      <button
        type="button"
        onClick={() => begin(title, length)}
        aria-label="Start"
        className="group relative mt-8 flex aspect-square w-[min(72vw,280px)] flex-col items-center justify-center rounded-full border border-line-strong bg-surface transition-[transform,border-color] duration-200 hover:border-crystal/50 active:scale-[0.97]"
      >
        <span className="text-[64px] leading-none font-semibold tracking-[-0.04em] tabular-nums">{length === null ? "0:00" : `${length}:00`}</span>
        <span className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-medium text-crystal">
          <Play className="size-4" fill="currentColor" /> Start
        </span>
      </button>

      <div className="mt-8 flex flex-wrap justify-center gap-1.5" role="radiogroup" aria-label="Length">
        {LENGTHS.map((m) => (
          <button
            key={String(m)}
            type="button"
            role="radio"
            aria-checked={length === m}
            aria-label={m === null ? "Count up until I stop" : `${m} minutes`}
            onClick={() => setLength(m)}
            className={cn(
              "h-11 min-w-11 rounded-full px-3.5 text-[15px] font-semibold tabular-nums transition-colors",
              length === m ? "bg-fg text-bg" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {lengthLabel(m)}
          </button>
        ))}
        <button
          type="button"
          aria-label="Another length"
          onClick={async () => {
            const raw = await promptDialog("How many minutes?", { inputMode: "numeric" });
            const n = Math.round(Number(raw));
            if (n > 0 && n <= 600) setLength(n);
          }}
          className={cn(
            "flex size-11 items-center justify-center rounded-full transition-colors",
            length !== null && !LENGTHS.includes(length) ? "bg-fg text-bg" : "text-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          {length !== null && !LENGTHS.includes(length) ? <span className="text-[15px] font-semibold tabular-nums">{length}</span> : <Plus className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function Running({ session, now }: { session: TimerSession; now: number }) {
  const stopTimer = useStore((s) => s.stopTimer);
  const extendTimer = useStore((s) => s.extendTimer);
  const total = session.endsAt - session.startedAt;
  const left = session.endsAt - now;
  const elapsed = now - session.startedAt;
  // Counting up: the ring fills once a minute, like a second hand.
  const ring = session.open ? ((elapsed % 60_000) / 60_000) * 100 : Math.max(0, Math.min(100, (left / total) * 100));
  const lastMinute = !session.open && left < 60_000;
  return (
    <section className="animate-fade text-center">
      <div className="relative mx-auto aspect-square w-[min(86vw,380px)]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r="46" fill="none" stroke="var(--surface-3)" strokeWidth="2.5" />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke={lastMinute ? "var(--danger)" : "var(--crystal)"}
            strokeWidth="2.8"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={100 - ring}
            className={cn("ease-linear", (!session.open || ring > 2) && "transition-[stroke-dashoffset] duration-1000")}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8">
          <p className="max-w-full truncate text-[16px] text-muted">{session.title}</p>
          <p className={cn("mt-2 text-[72px] leading-none font-semibold tracking-[-0.045em] tabular-nums sm:text-[84px]", lastMinute && "text-danger")}>
            {formatClock(session.open ? elapsed : left)}
          </p>
          <p className="mt-3 text-[14px] text-faint tabular-nums">{session.open ? `since ${clockTime(session.startedAt)}` : `ends ${clockTime(session.endsAt)}`}</p>
        </div>
      </div>
      <div className="mt-8 flex justify-center gap-3">
        {!session.open && (
          <button
            onClick={() => {
              tap(8);
              extendTimer(session.id, 5 * 60_000);
            }}
            className="inline-flex h-14 items-center gap-2 rounded-full border border-line-strong px-6 text-[16px] font-semibold transition-transform active:scale-95"
          >
            <Plus className="size-4" strokeWidth={2.6} /> 5 min
          </button>
        )}
        <button
          onClick={() => {
            tap(14);
            stopTimer(session.id);
          }}
          className="inline-flex h-14 items-center gap-2.5 rounded-full bg-fg px-8 text-[16px] font-semibold text-bg transition-transform active:scale-95"
        >
          <Square className="size-4" fill="currentColor" /> Stop
        </button>
      </div>
    </section>
  );
}

/** Today in one line, and what it went on. */
function Today({ sessions, today, now }: { sessions: TimerSession[]; today: string; now: number }) {
  const deleteSession = useStore((s) => s.deleteSession);
  const totals = totalsByTask(sessions, today, now);
  const sum = totals.reduce((n, t) => n + t.minutes, 0);
  const todays = sessions.filter((s) => s.date === today).sort((a, b) => b.startedAt - a.startedAt);
  if (!todays.length) return null;
  return (
    <section className="mt-14 border-t border-line pt-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-medium text-muted">Today</h2>
        <p className="text-[22px] font-semibold tabular-nums">{formatMinutes(sum)}</p>
      </div>
      <ul className="mt-3 space-y-0.5">
        {todays.map((s) => (
          <li key={s.id} className="group flex min-h-11 items-center gap-3 text-[15px]">
            <span className="min-w-0 flex-1 truncate">{s.title}</span>
            <span className="text-[13px] text-faint tabular-nums">{clockTime(s.startedAt)}</span>
            <span className="w-14 text-right text-muted tabular-nums">{formatMinutes(sessionMinutes(s, now))}</span>
            <button
              aria-label="Delete this session"
              onClick={async () => (await confirmDialog("Delete this session?", { danger: true })) && deleteSession(s.id)}
              className="flex size-8 items-center justify-center rounded-full text-faint hover:text-danger pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
