"use client";

import { ChevronRight, Plus, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AsciiStatue } from "@/components/AsciiStatue";
import { Statue } from "@/components/brand";
import { DayRater, ratingOf, VERDICT_COLOR } from "@/components/DayRater";
import { PRIORITIES, TaskList } from "@/components/TaskList";
import { AnimatedNumber, Segmented, toast } from "@/components/ui";
import { addDays, fromKey } from "@/lib/date";
import { tap } from "@/lib/motion";
import { currentStreak } from "@/lib/stats";
import { useClock, useStore } from "@/lib/store";
import type { Priority } from "@/lib/types";
import { cn, parseQuickTask } from "@/lib/utils";
import { alexanderSays, speak, type Tone } from "@/lib/voice";

type Day = "today" | "tomorrow";

const SPARKS = Array.from({ length: 12 }, (_, i) => i * 30);

/**
 * The moment a day is won: sparks around the statue, a small buzz and a word of praise. Fires
 * only when the line is crossed while you're here — not every time the page opens.
 */
function useDayWon(today: string, threshold: number) {
  const [burst, setBurst] = useState(0);
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        const now = s.days[today];
        const before = prev.days[today];
        const won = (l?: { total: number; pct: number }) => !!l && l.total > 0 && l.pct >= threshold;
        if (won(now) && !won(before)) {
          setBurst(Date.now());
          tap(24);
          toast(now!.pct >= 100 ? "Every task done. A perfect day." : "Day won. Well fought.");
        } else if (now?.pct === 100 && (before?.pct ?? 0) < 100) {
          setBurst(Date.now());
          toast("Every task done. A perfect day.");
        }
      }),
    [today, threshold],
  );
  return burst;
}

/**
 * The day's colour, so you feel how it's going before reading a number: red while it's slipping,
 * amber on the way, crystal once won — and your own verdict, used or wasted, over all of it.
 */
function dayTone(total: number, pct: number, threshold: number, verdict?: "used" | "wasted") {
  if (verdict) return VERDICT_COLOR[verdict];
  if (total === 0) return "var(--faint)";
  if (pct >= threshold) return "var(--crystal)";
  if (pct >= threshold / 2) return "var(--hue-amber)";
  return "var(--hue-rose)";
}

const TONE_COLOR: Record<Tone, string> = { scold: "var(--danger)", warn: "var(--hue-amber)", praise: "var(--crystal)" };

export default function TodayPage() {
  const today = useClock((s) => s.today);
  const threshold = useStore((s) => s.settings.winThreshold);
  const days = useStore((s) => s.days);
  const tasks = useStore((s) => s.tasks);
  const ratings = useStore((s) => s.dayRatings);
  const [day, setDay] = useState<Day>("today");
  const burst = useDayWon(today, threshold);
  const ascii = useStore((s) => s.settings.statueStyle === "ascii");
  const updateSettings = useStore((s) => s.updateSettings);

  const date = day === "today" ? today : addDays(today, 1);
  const log = days[date];
  const total = log?.total ?? 0;
  const done = log?.done ?? 0;
  const pct = log?.pct ?? 0;
  const won = total > 0 && pct >= threshold;
  const toWin = Math.max(0, Math.ceil((threshold / 100) * total) - done);
  const dayTasks = tasks.filter((t) => t.date === date);
  const notDone = dayTasks.filter((t) => t.failed).length;
  const open = dayTasks.filter((t) => !t.done && !t.failed).length;
  const verdict = ratingOf(ratings, today)?.verdict;
  const tone = dayTone(total, pct, threshold, verdict);

  // Yesterday, if you were here and haven't judged it yet.
  const yesterday = addDays(today, -1);
  const judgeYesterday = !ratingOf(ratings, yesterday)?.verdict && (days[yesterday]?.total || days[yesterday]?.firstSeen);

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex justify-center">
        <Segmented<Day>
          value={day}
          onChange={setDay}
          options={[
            { value: "today", label: "Today" },
            { value: "tomorrow", label: "Tomorrow" },
          ]}
        />
      </div>

      {day === "today" ? (
        <header className="relative mb-5 overflow-hidden rounded-[28px] border px-5 py-6 transition-[border-color] duration-700 sm:px-7" style={{ borderColor: `color-mix(in oklab, ${tone} 28%, var(--line))` }}>
          {/* The day's light: a soft glow in the day's colour, shifting as the day changes. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 transition-[background-color] duration-1000"
            style={{ backgroundColor: `color-mix(in oklab, ${tone} 22%, transparent)`, maskImage: "radial-gradient(120% 90% at 20% 0%, black, transparent 70%)", WebkitMaskImage: "radial-gradient(120% 90% at 20% 0%, black, transparent 70%)" }}
          />
          <div className="relative flex items-center gap-5 sm:gap-7">
            {/* Alexander, every day — beside the numbers, never over them. */}
            <div className="relative shrink-0">
              {/* Tap the statue to switch between the photo and the statue drawn in characters. */}
              <button
                type="button"
                aria-label={ascii ? "Show the statue as a photo" : "Show the statue in characters"}
                onClick={() => {
                  tap(8);
                  updateSettings({ statueStyle: ascii ? "photo" : "ascii" });
                }}
                className={cn("block transition-transform active:scale-[0.97]", pct >= 100 && "statue-glow")}
              >
                {ascii ? (
                  <span className="flex min-h-[140px] items-center sm:min-h-[160px]">
                    <AsciiStatue size={4.8} />
                  </span>
                ) : (
                  <Statue priority className="h-[140px] w-auto sm:h-[160px]" />
                )}
              </button>
              {burst > 0 && (
                <div key={burst} aria-hidden className="burst pointer-events-none absolute inset-0">
                  {SPARKS.map((a) => (
                    <i key={a} style={{ ["--a" as string]: `${a}deg`, animationDelay: `${(a % 60) * 2}ms` }} />
                  ))}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[54px] leading-none font-semibold tracking-[-0.04em] tabular-nums transition-colors duration-700 sm:text-[60px]" style={{ color: total ? tone : undefined }}>
                <AnimatedNumber value={pct} from={0} />
                <span className="ml-0.5 text-[22px] font-medium text-faint">%</span>
              </p>
              <div className="relative mt-4 h-1.5 w-full max-w-[220px] rounded-full bg-surface-3">
                <div className="h-full rounded-full transition-[width,background-color] duration-700 ease-[var(--ease-out)]" style={{ width: `${pct}%`, background: tone }} />
                {/* The success line. */}
                <span className="absolute -top-[3px] h-[12px] w-[2px] rounded-full bg-fg/70" style={{ left: `${threshold}%` }} />
              </div>
              <p className="mt-3 text-[14.5px] leading-snug text-muted">
                {total === 0 ? (
                  "No tasks yet"
                ) : won ? (
                  <span style={{ color: tone }}>Day won</span>
                ) : (
                  `${done} of ${total} · ${toWin > open ? "can't be won today" : `${toWin} more to win`}`
                )}
                {notDone > 0 && <span className="text-danger/90"> · {notDone} not done</span>}
              </p>
            </div>
          </div>
        </header>
      ) : (
        <p className="mb-6 text-center text-[15px] text-muted">
          {fromKey(date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          {total > 0 && <span className="text-faint"> · {total} planned</span>}
        </p>
      )}

      {day === "today" && <AlexanderSpeaks />}

      <AddTask date={date} />

      <TaskList date={date} emptyText={day === "today" ? "Add the one task that matters most." : "Plan tomorrow tonight."} />

      {day === "today" && (
        <div className="mt-10 space-y-3">
          <DayRater date={today} title="How did you use today?" />
          {judgeYesterday && <DayRater date={yesterday} title="You never judged yesterday. Be honest." />}
        </div>
      )}
    </div>
  );
}

/** Alexander's words for right now. Tap for the next thing he has to say; the speaker reads it aloud. */
function AlexanderSpeaks() {
  const today = useClock((s) => s.today);
  const now = useClock((s) => s.now);
  const days = useStore((s) => s.days);
  const ratings = useStore((s) => s.dayRatings);
  const settings = useStore((s) => s.settings);
  const [index, setIndex] = useState(0);
  // Re-read only when something real changes — the minute ticking by shouldn't reshuffle him.
  const hour = new Date(now).getHours();
  const lines = useMemo(
    () => alexanderSays({ now, today, days, ratings, settings, streak: currentStreak(days, today, settings.winThreshold) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [today, hour, days, ratings, settings],
  );
  const line = lines[index % lines.length];
  if (!line) return null;
  const color = TONE_COLOR[line.tone];

  return (
    <div
      className="mb-6 flex items-stretch gap-1 rounded-3xl border transition-colors duration-500"
      style={{ borderColor: `color-mix(in oklab, ${color} 35%, var(--line))`, background: `color-mix(in oklab, ${color} 8%, transparent)` }}
    >
      <button
        type="button"
        onClick={() => {
          tap(6);
          setIndex((i) => i + 1);
        }}
        className="min-w-0 flex-1 py-4 pl-5 text-left"
        aria-label="Next thing Alexander has to say"
      >
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold tracking-[0.16em] uppercase" style={{ color }}>
          Alexander
          {lines.length > 1 && <ChevronRight className="size-3.5 opacity-70" />}
        </span>
        <Typewriter key={line.text} text={line.text} />
      </button>
      <button
        type="button"
        aria-label="Hear it"
        title="Hear it"
        onClick={() => speak(line.text)}
        className="flex w-14 shrink-0 items-center justify-center rounded-r-3xl text-muted transition-colors hover:text-fg active:scale-95"
      >
        <Volume2 className="size-5" />
      </button>
    </div>
  );
}

/** Words arriving one by one, as if spoken. */
function Typewriter({ text }: { text: string }) {
  const [still] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [shown, setShown] = useState(still ? text.length : 0);
  useEffect(() => {
    if (still) return;
    const id = setInterval(() => setShown((n) => (n >= text.length ? (clearInterval(id), n) : n + 2)), 18);
    return () => clearInterval(id);
  }, [text, still]);
  return (
    <span className="mt-1.5 block text-[17px] leading-snug font-medium text-fg">
      {text.slice(0, shown)}
      <span className="opacity-0">{text.slice(shown)}</span>
    </span>
  );
}

/** Always ready: type, pick how much it matters, Enter. The priority you pick stays for the next one. */
function AddTask({ date }: { date: string }) {
  const addTask = useStore((s) => s.addTask);
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<Priority>("high");
  const color = PRIORITIES.find((p) => p.value === priority)!.color;

  const add = () => {
    const parsed = parseQuickTask(text, date);
    if (!parsed.title) return;
    // A typed "!low" wins over the chips.
    addTask({ ...parsed, priority: /(^|\s)!\w/.test(text) ? parsed.priority : priority });
    tap(8);
    setText("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
      className="mb-7 rounded-3xl border bg-surface p-2 transition-[border-color] duration-200"
      style={{ borderColor: `color-mix(in oklab, ${color} 30%, var(--line))` }}
    >
      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={date === useClock.getState().today ? "What needs doing?" : "What needs doing tomorrow?"}
          aria-label="New task"
          enterKeyHint="done"
          className="h-12 min-w-0 flex-1 bg-transparent px-3 text-[17px] outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          aria-label="Add task"
          disabled={!text.trim()}
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-black transition-[transform,opacity] active:scale-90 disabled:opacity-30"
          style={{ background: color }}
        >
          <Plus className="size-6" strokeWidth={2.4} />
        </button>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1.5 px-1 pb-1" role="radiogroup" aria-label="Priority">
        {PRIORITIES.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={priority === p.value}
            onClick={() => setPriority(p.value)}
            className="h-10 rounded-xl text-[14px] font-semibold transition-[background-color,color] duration-200 active:scale-[0.97]"
            style={priority === p.value ? { color: p.color, background: `color-mix(in oklab, ${p.color} 16%, transparent)` } : { color: "var(--faint)" }}
          >
            {p.short}
          </button>
        ))}
      </div>
    </form>
  );
}
