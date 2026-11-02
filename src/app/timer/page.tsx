"use client";

import { Bell, BellOff, Infinity as Endless, Plus, Square, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { confirmDialog } from "@/components/dialog";
import { ProgressBar, toast } from "@/components/ui";
import { addDays, fromKey } from "@/lib/date";
import { tap } from "@/lib/motion";
import { askToNotify, canNotify, notifyAllowed } from "@/lib/notify";
import { byOrder, useClock, useStore } from "@/lib/store";
import { formatClock, isRunning, sessionMinutes, totalsByTask } from "@/lib/timer";
import type { TimerSession } from "@/lib/types";
import { cn, formatMinutes } from "@/lib/utils";

const PRESETS = [5, 15, 25, 45, 60, 90];
const SAFETY_STOP = 24 * 3_600_000; // a forgotten stopwatch stops itself after a day

/**
 * Start timing now. With no end it counts up until you stop it. "Until" wins when set: today at
 * that time, or tomorrow if it has passed. No name needed — it's "Focus" unless you say otherwise.
 */
function begin(title: string, minutes: number, until: string, open: boolean) {
  const { addTimerTask, startTimer } = useStore.getState();
  const name = title.trim() || "Focus";
  const start = Date.now();
  tap(14);
  // Ask for notifications on the first start, so a finished timer can reach you.
  void askToNotify();
  if (open) return startTimer(addTimerTask(name), start + SAFETY_STOP, true);
  let end = start + minutes * 60_000;
  if (until) {
    const [h, m] = until.split(":").map(Number);
    const at = new Date(start);
    at.setHours(h, m, 0, 0);
    if (at.getTime() <= start) at.setDate(at.getDate() + 1);
    end = at.getTime();
  }
  startTimer(addTimerTask(name), end);
}

const clockTime = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

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

/** Timer — one tap to start, a big clock while it runs, and a notification when it ends. */
export default function TimerPage() {
  const today = useClock((s) => s.today);
  const sessions = useStore((s) => s.timerSessions);
  const hasRunning = sessions.some((s) => !s.endedAt);
  const now = useTicking(hasRunning);
  const running = sessions.find((s) => isRunning(s, now));

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex justify-end">
        <NotifyToggle />
      </div>

      {running ? <Running session={running} now={now} /> : <StartForm />}

      <Today sessions={sessions} today={today} now={now} />
      <LastWeek sessions={sessions} today={today} now={now} />
    </div>
  );
}

/** Whether a finished timer may send a notification. */
function NotifyToggle() {
  const [allowed, setAllowed] = useState(() => (canNotify() ? notifyAllowed() : null));
  if (allowed === null) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        if (allowed) return toast("Notifications are on. Turn them off in your browser's site settings.");
        const ok = await askToNotify();
        setAllowed(ok);
        toast(ok ? "You'll be notified when a timer ends" : "Notifications are blocked — allow them in your browser's site settings");
      }}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13.5px] font-medium transition-colors",
        allowed ? "border-crystal/50 text-crystal" : "border-line-strong text-muted hover:text-fg",
      )}
    >
      {allowed ? <Bell className="size-4" /> : <BellOff className="size-4" />}
      {allowed ? "Notify on" : "Notify me"}
    </button>
  );
}

function Running({ session, now }: { session: TimerSession; now: number }) {
  const stopTimer = useStore((s) => s.stopTimer);
  const extendTimer = useStore((s) => s.extendTimer);
  const total = session.endsAt - session.startedAt;
  const left = session.endsAt - now;
  const elapsed = now - session.startedAt;
  // Counting up: the ring fills once a minute, like a second hand — a quiet sign it's running.
  const ring = session.open ? ((elapsed % 60_000) / 60_000) * 100 : Math.max(0, Math.min(100, (left / total) * 100));
  const lastMinute = !session.open && left < 60_000;
  return (
    <section className="animate-fade text-center">
      {/* The ring empties as time runs out; it breathes while you work, and turns red in the last minute. */}
      <div className="relative mx-auto aspect-square w-[min(86vw,400px)]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r="46" fill="none" stroke="var(--surface-3)" strokeWidth="3" />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke={lastMinute ? "var(--danger)" : "var(--crystal)"}
            strokeWidth="3.4"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={100 - ring}
            className={cn("breathe ease-linear", (!session.open || ring > 2) && "transition-[stroke-dashoffset] duration-1000")}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8">
          <p className="max-w-full truncate text-[16px] font-medium text-muted">{session.title}</p>
          <p className={cn("mt-2 text-[72px] leading-none font-semibold tracking-[-0.045em] tabular-nums sm:text-[88px]", lastMinute && "text-danger")}>
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
            className="inline-flex h-14 items-center gap-2 rounded-full border border-line-strong px-6 text-[16px] font-semibold text-fg transition-[transform,border-color] hover:border-faint active:scale-95"
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
          <Square className="size-4" fill="currentColor" /> {session.open ? "Stop — I'm done" : "Stop"}
        </button>
      </div>
    </section>
  );
}

function StartForm() {
  const tasks = useStore((s) => s.timerTasks);
  const deleteTimerTask = useStore((s) => s.deleteTimerTask);
  const [title, setTitle] = useState("");
  const [until, setUntil] = useState("");
  const [custom, setCustom] = useState("");
  const list = useMemo(() => [...tasks].sort(byOrder), [tasks]);
  const picked = (t: string) => title.trim().toLowerCase() === t.toLowerCase();

  return (
    <div className="animate-fade">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What are you working on?"
        aria-label="Task"
        enterKeyHint="done"
        className="h-14 w-full rounded-2xl border border-line bg-surface px-4 text-[18px] outline-none placeholder:text-faint focus:border-line-strong"
      />
      {list.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {list.map((t) => (
            <span
              key={t.id}
              className={cn(
                "group inline-flex h-10 items-center rounded-full border text-[14px] transition-colors",
                picked(t.title) ? "border-crystal/60 bg-crystal-soft text-fg" : "border-line text-muted hover:border-line-strong",
              )}
            >
              <button type="button" onClick={() => setTitle(picked(t.title) ? "" : t.title)} className="h-full pr-1 pl-4">
                {t.title}
              </button>
              <button
                type="button"
                aria-label={`Remove ${t.title}`}
                onClick={async () => (await confirmDialog(`Remove “${t.title}” from your tasks?`, { detail: "Time already recorded stays.", danger: true, confirmLabel: "Remove" })) && deleteTimerTask(t.id)}
                className="flex h-full w-8 items-center justify-center text-faint opacity-60 hover:text-danger hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* One tap starts it. */}
      <p className="mt-8 mb-3 text-[14px] font-medium text-muted">Tap to start</p>
      <div className="grid grid-cols-3 gap-2.5">
        {PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => begin(title, m, "", false)}
            className="flex h-24 flex-col items-center justify-center rounded-3xl border border-line bg-surface transition-[transform,border-color,background-color] hover:border-crystal/50 active:scale-95 active:bg-crystal-soft"
          >
            <span className="text-[30px] leading-none font-semibold tracking-tight tabular-nums">{m < 60 ? m : m / 60}</span>
            <span className="mt-1.5 text-[13px] text-faint">{m < 60 ? "minutes" : m === 60 ? "hour" : "hours"}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => begin(title, 0, "", true)}
        className="mt-2.5 flex h-16 w-full items-center justify-center gap-2.5 rounded-3xl border border-line bg-surface text-[16px] font-semibold transition-[transform,border-color] hover:border-crystal/50 active:scale-[0.98]"
      >
        <Endless className="size-5 text-crystal" /> Stopwatch — until I stop
      </button>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const m = Number(custom);
            if (m > 0) begin(title, m, "", false);
          }}
          className="inline-flex h-12 items-center gap-2 rounded-full border border-line pr-1.5 pl-4 text-[14px] text-muted focus-within:border-line-strong"
        >
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 3))}
            inputMode="numeric"
            placeholder="Other"
            aria-label="Minutes"
            className="w-14 bg-transparent text-[16px] text-fg outline-none placeholder:text-faint"
          />
          min
          <button type="submit" disabled={!Number(custom)} className="h-9 rounded-full bg-fg px-4 text-[13.5px] font-semibold text-bg disabled:opacity-30">
            Start
          </button>
        </form>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (until) begin(title, 0, until, false);
          }}
          className="inline-flex h-12 items-center gap-2 rounded-full border border-line pr-1.5 pl-4 text-[14px] text-muted focus-within:border-line-strong"
        >
          Until
          <input type="time" value={until} onChange={(e) => setUntil(e.target.value)} aria-label="End at" className="h-full bg-transparent text-[15px] text-fg outline-none [color-scheme:dark]" />
          <button type="submit" disabled={!until} className="h-9 rounded-full bg-fg px-4 text-[13.5px] font-semibold text-bg disabled:opacity-30">
            Start
          </button>
        </form>
      </div>
      <p className="mt-4 text-[12.5px] leading-relaxed text-faint">When time&apos;s up it rings, buzzes and sends a notification — as long as Alexander is open, even in the background.</p>
    </div>
  );
}

function Today({ sessions, today, now }: { sessions: TimerSession[]; today: string; now: number }) {
  const deleteSession = useStore((s) => s.deleteSession);
  const totals = totalsByTask(sessions, today, now);
  const sum = totals.reduce((n, t) => n + t.minutes, 0);
  const todays = sessions.filter((s) => s.date === today).sort((a, b) => b.startedAt - a.startedAt);
  if (!todays.length) return null;
  return (
    <section className="mt-14">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[13px] font-medium text-muted">Today</h2>
        <p className="text-[15px] font-semibold tabular-nums">{formatMinutes(sum)}</p>
      </div>
      <ul className="space-y-3">
        {totals.map((t) => (
          <li key={t.title}>
            <div className="mb-1.5 flex justify-between text-[14px]">
              <span className="min-w-0 break-words">{t.title}</span>
              <span className="text-muted tabular-nums">{formatMinutes(t.minutes)}</span>
            </div>
            <ProgressBar value={sum ? (t.minutes / sum) * 100 : 0} />
          </li>
        ))}
      </ul>

      <ul className="mt-6 space-y-0.5 text-[12.5px] text-faint">
        {todays.map((s) => (
          <li key={s.id} className="group flex items-center gap-3 tabular-nums">
            <span className="w-32 shrink-0">
              {clockTime(s.startedAt)} – {s.endedAt || now >= s.endsAt ? clockTime(s.endedAt ?? s.endsAt) : "now"}
            </span>
            <span className="min-w-0 flex-1 break-words text-muted">{s.title}</span>
            <span>{formatMinutes(sessionMinutes(s, now))}</span>
            <button
              aria-label="Delete this session"
              onClick={async () => (await confirmDialog("Delete this session?", { danger: true })) && deleteSession(s.id)}
              className="flex size-7 items-center justify-center rounded-full opacity-60 hover:text-danger hover:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The last seven days: how long, and on what. */
function LastWeek({ sessions, today, now }: { sessions: TimerSession[]; today: string; now: number }) {
  const days = Array.from({ length: 6 }, (_, i) => addDays(today, -(i + 1)));
  const rows = days.map((date) => {
    const totals = totalsByTask(sessions, date, now);
    return { date, totals, sum: totals.reduce((n, t) => n + t.minutes, 0) };
  });
  const max = Math.max(1, ...rows.map((r) => r.sum));
  if (!rows.some((r) => r.sum > 0)) return null;
  return (
    <section className="mt-14">
      <h2 className="mb-4 text-[13px] font-medium text-muted">Earlier this week</h2>
      <ul className="space-y-4">
        {rows.map((r) => (
          <li key={r.date}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-muted">{fromKey(r.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</span>
              <span className="font-medium tabular-nums">{r.sum ? formatMinutes(r.sum) : "—"}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-fg/60" style={{ width: `${(r.sum / max) * 100}%` }} />
            </div>
            {r.totals.length > 0 && (
              <p className="mt-1.5 text-[12px] leading-relaxed text-faint">{r.totals.map((t) => `${t.title} ${formatMinutes(t.minutes)}`).join(" · ")}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
