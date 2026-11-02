"use client";

import { Gem, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AsciiStatue } from "@/components/AsciiStatue";
import { Statue } from "@/components/brand";
import { TaskList } from "@/components/TaskList";
import { AnimatedNumber, Segmented, toast } from "@/components/ui";
import { addDays, fromKey } from "@/lib/date";
import { tap } from "@/lib/motion";
import { useClock, useStore } from "@/lib/store";
import { cn, parseQuickTask } from "@/lib/utils";

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
        // A perfect day gets its own moment (the sapphire); crossing the line gets a word.
        if (won(now) && !won(before)) {
          setBurst(Date.now());
          tap(24);
          if (now!.pct < 100) toast("Day won. Well fought.");
        } else if (now?.pct === 100 && (before?.pct ?? 0) < 100) {
          setBurst(Date.now());
        }
      }),
    [today, threshold],
  );
  return burst;
}

export default function TodayPage() {
  const today = useClock((s) => s.today);
  const threshold = useStore((s) => s.settings.winThreshold);
  const days = useStore((s) => s.days);
  const tasks = useStore((s) => s.tasks);
  const [day, setDay] = useState<Day>("today");
  const burst = useDayWon(today, threshold);
  const ascii = useStore((s) => s.settings.statueStyle === "ascii");
  const updateSettings = useStore((s) => s.updateSettings);
  const gems = useStore((s) => s.achievements.filter((a) => !a.unclaimed && !a.id.startsWith("milestone:")).length);

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

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8 flex justify-center">
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
        <header className="mx-auto mb-8 flex max-w-sm items-center gap-5 sm:gap-7">
          {/* Alexander, every day — small, beside the numbers, never over them. */}
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
            <p className={cn("text-[52px] leading-none font-semibold tracking-[-0.04em] tabular-nums transition-colors duration-500 sm:text-[58px]", won && "text-crystal")}>
              <AnimatedNumber value={pct} from={0} />
              <span className="ml-0.5 text-[22px] font-medium text-faint">%</span>
            </p>
            <div className="relative mt-4 h-1 w-full max-w-[220px] rounded-full bg-surface-3">
              <div
                className={cn("h-full rounded-full transition-[width,background-color] duration-700 ease-[var(--ease-out)]", won ? "bg-crystal" : "bg-fg")}
                style={{ width: `${pct}%` }}
              />
              {/* The success line. */}
              <span className="absolute -top-[3px] h-[10px] w-px bg-crystal/80" style={{ left: `${threshold}%` }} />
            </div>
            <p className="mt-3 text-[14.5px] leading-snug text-muted">
              {total === 0 ? (
                "No tasks yet"
              ) : won ? (
                <span className="text-crystal">Day won</span>
              ) : (
                `${done} of ${total} · ${toWin > open ? "can't be won today" : `${toWin} more to win`}`
              )}
              {notDone > 0 && <span className="text-danger/80"> · {notDone} not done</span>}
            </p>
            <Link href="/achievements" className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-faint transition-colors hover:text-fg">
              <Gem className="size-3.5" strokeWidth={1.75} />
              {gems ? `${gems} ${gems === 1 ? "gem" : "gems"}` : "Finish every task for a sapphire"}
            </Link>
          </div>
        </header>
      ) : (
        <p className="mb-8 text-center text-[15px] text-muted">
          {fromKey(date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          {total > 0 && <span className="text-faint"> · {total} planned</span>}
        </p>
      )}

      <AddTask date={date} placeholder={day === "today" ? "What needs doing?" : "What needs doing tomorrow?"} />

      <TaskList date={date} emptyText={day === "today" ? "Add the one task that matters most." : "Plan tomorrow tonight."} />
    </div>
  );
}

/** Always ready: type and press Enter. Stays focused, so several tasks go in one after another. */
function AddTask({ date, placeholder }: { date: string; placeholder: string }) {
  const addTask = useStore((s) => s.addTask);
  const [text, setText] = useState("");

  const add = () => {
    const parsed = parseQuickTask(text, date);
    if (!parsed.title) return;
    addTask({ title: parsed.title, date: parsed.date });
    tap(8);
    setText("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
      className="mb-6 flex items-center gap-2 rounded-2xl border border-line bg-surface p-1.5 pl-4 transition-colors focus-within:border-line-strong"
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label="New task"
        enterKeyHint="done"
        className="h-11 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-faint"
      />
      <button
        type="submit"
        aria-label="Add task"
        disabled={!text.trim()}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-fg text-bg transition-[transform,opacity] active:scale-90 disabled:opacity-25"
      >
        <Plus className="size-5" strokeWidth={2.4} />
      </button>
    </form>
  );
}
