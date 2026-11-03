"use client";

import { Check, Repeat, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { confirmDialog } from "@/components/dialog";
import { SectionProgress } from "@/components/SectionProgress";
import { SortableList } from "@/components/Sortable";
import { AddBar, EmptyState, IconButton } from "@/components/ui";
import { addDays, fromKey, toKey } from "@/lib/date";
import { tap } from "@/lib/motion";
import { byOrder, useClock, useStore } from "@/lib/store";
import type { Habit } from "@/lib/types";
import { useBackToClose } from "@/lib/useBackToClose";
import { cn } from "@/lib/utils";

/** The day a habit was added: days before it are neither done nor missed. */
const startKey = (h: Habit) => toKey(new Date(h.createdAt));

/** Days in a row up to today. Today still counts as open, so an unchecked today doesn't break it. */
function streakOf(done: Set<string>, today: string) {
  let n = 0;
  for (let d = done.has(today) ? today : addDays(today, -1); done.has(d); d = addDays(d, -1)) n++;
  return n;
}

function bestStreakOf(done: Set<string>) {
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of [...done].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Habits — check each one off the day you do it. A day left unchecked counts as not done. */
export default function HabitsPage() {
  const today = useClock((s) => s.today);
  const habits = useStore((s) => s.habits);
  const checks = useStore((s) => s.habitChecks);
  const { addHabit, toggleHabit, reorder } = useStore.getState();
  const [text, setText] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => [...habits].sort(byOrder), [habits]);
  const doneBy = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const c of checks) {
      if (!map.has(c.habitId)) map.set(c.habitId, new Set());
      map.get(c.habitId)!.add(c.date);
    }
    return map;
  }, [checks]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)), [today]);

  const doneToday = list.filter((h) => doneBy.get(h.id)?.has(today)).length;
  // This week: checks out of the days each habit existed in the last 7.
  let weekDone = 0;
  let weekTotal = 0;
  for (const h of list)
    for (const d of days)
      if (d >= startKey(h)) {
        weekTotal++;
        if (doneBy.get(h.id)?.has(d)) weekDone++;
      }
  const current = list.find((h) => h.id === open);

  return (
    <div className="mx-auto max-w-2xl">

      <AddBar
        value={text}
        onChange={setText}
        onSubmit={() => {
          addHabit(text.trim());
          setText("");
        }}
        placeholder="Add a habit"
        label="Add habit"
        className="mb-8"
      />

      {list.length > 0 && (
        <SectionProgress
          value={(doneToday / list.length) * 100}
          label="done today"
          detail={`${doneToday} of ${list.length} · ${weekTotal ? Math.round((weekDone / weekTotal) * 100) : 0}% this week`}
        />
      )}

      {list.length === 0 && <EmptyState icon={<Repeat className="size-5" />} title="Small things, every day" hint="Add a habit above. Tick it the day you do it — a day left unticked counts as missed." />}

      {list.length > 0 && (
        <>
          {/* Day labels, lined up with the columns below. The last column is today. */}
          <div className="mb-1 flex items-end justify-end gap-1 pr-0.5 text-[10.5px] text-faint">
            {days.map((d, i) => (
              <span key={d} className={cn("w-8 text-center", i < 2 && "max-sm:hidden", d === today && "font-medium text-fg")}>
                {fromKey(d).toLocaleDateString(undefined, { weekday: "narrow" })}
                <span className="block tabular-nums">{fromKey(d).getDate()}</span>
              </span>
            ))}
          </div>

          <SortableList items={list} onReorder={(ids) => reorder("habits", ids)} className="space-y-1">
            {(h, handle) => {
              const done = doneBy.get(h.id) ?? new Set<string>();
              const streak = streakOf(done, today);
              const start = startKey(h);
              return (
                <div className="group relative -mx-2 flex items-center gap-2 rounded-2xl px-2 py-2 transition-colors hover:bg-surface">
                  <div className="absolute top-1/2 -left-7 hidden -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 lg:block">{handle}</div>
                  <button onClick={() => setOpen(h.id)} className="min-w-0 flex-1 text-left">
                    <span className="block text-[15px] leading-snug break-words">{h.title}</span>
                    <span key={streak} className={cn("block text-[11.5px] tabular-nums", streak > 0 ? "animate-rise text-crystal/90" : "text-faint")}>{streak > 0 ? `${streak}-day streak` : "No streak yet"}</span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {days.map((d, i) => {
                      const isDone = done.has(d);
                      const isToday = d === today;
                      const before = d < start;
                      return (
                        <span key={d} className={cn("flex w-8 justify-center", i < 2 && "max-sm:hidden")}>
                          {isToday ? (
                            <button
                              role="checkbox"
                              aria-checked={isDone}
                              aria-label={`${h.title} today`}
                              onClick={() => {
                                if (!isDone) tap();
                                toggleHabit(h.id, today);
                              }}
                              className={cn(
                                "flex size-8 items-center justify-center rounded-full border-[1.5px] transition-[background-color,border-color,transform] duration-200 active:scale-90",
                                isDone ? "border-crystal bg-crystal text-bg" : "border-line-strong hover:border-faint",
                              )}
                            >
                              {isDone && <Check className="size-4" strokeWidth={2.5} />}
                            </button>
                          ) : (
                            <DayMark state={before ? "none" : isDone ? "done" : "missed"} label={`${h.title}, ${d}`} />
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            }}
          </SortableList>
          <p className="mt-6 text-[12px] text-faint">Only today can be ticked. A day you didn’t tick stays not done.</p>
        </>
      )}

      {current && <HabitView key={current.id} habit={current} done={doneBy.get(current.id) ?? new Set()} today={today} onClose={() => setOpen(null)} />}
    </div>
  );
}

function DayMark({ state, label }: { state: "done" | "missed" | "none"; label: string }) {
  if (state === "none") return <span aria-hidden className="size-1 rounded-full bg-surface-3" />;
  return (
    <span
      role="img"
      aria-label={`${label}: ${state === "done" ? "done" : "not done"}`}
      className={cn("flex size-6 items-center justify-center rounded-full", state === "done" ? "bg-crystal/85 text-bg" : "bg-surface-2 text-faint")}
    >
      {state === "done" ? <Check className="size-3" strokeWidth={3} /> : <X className="size-2.5" strokeWidth={2.5} />}
    </span>
  );
}

const WEEKS = 26;

/** One habit's full record: streaks, rate, and the last six months day by day. */
function HabitView({ habit, done, today, onClose }: { habit: Habit; done: Set<string>; today: string; onClose: () => void }) {
  const { updateHabit, deleteHabit } = useStore.getState();
  const start = startKey(habit);
  useBackToClose(true, onClose, { lockScroll: true });


  // Days since it was added, today included; today only counts once it's done.
  const tracked = Math.max(1, Math.round((fromKey(today).getTime() - fromKey(start).getTime()) / 86_400_000) + (done.has(today) ? 1 : 0));
  const total = [...done].filter((d) => d >= start && d <= today).length;
  const rate = Math.min(100, Math.round((total / tracked) * 100));

  // Columns are weeks (Monday first), ending with this week.
  const weekday = (fromKey(today).getDay() + 6) % 7;
  const firstDay = addDays(today, -weekday - (WEEKS - 1) * 7);
  const columns = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(firstDay, w * 7 + d)));

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={habit.title} className="animate-fade fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg">
      <div className="sticky top-0 z-10 bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-1 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-6">
          <IconButton label="Close" onClick={onClose} className="size-10 text-fg">
            <X className="size-5" />
          </IconButton>
          <span className="flex-1" />
          <IconButton
            label="Delete habit"
            onClick={async () => {
              if (!(await confirmDialog(`Delete “${habit.title}”?`, { detail: "Its whole record goes with it.", danger: true }))) return;
              deleteHabit(habit.id);
              onClose();
            }}
            className="size-10 hover:text-danger"
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-[max(4rem,env(safe-area-inset-bottom))] sm:px-6">
        <input
          value={habit.title}
          onChange={(e) => e.target.value.trim() && updateHabit(habit.id, { title: e.target.value })}
          aria-label="Habit"
          className="mt-2 w-full bg-transparent text-[26px] leading-tight font-semibold tracking-[-0.02em] outline-none sm:text-[30px]"
        />
        <p className="mt-1 text-[12.5px] text-faint">Since {fromKey(start).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</p>

        <div className="mt-8 grid grid-cols-4 gap-2">
          {[
            [streakOf(done, today), "Streak"],
            [bestStreakOf(done), "Best"],
            [total, "Days done"],
            [`${rate}%`, "Done rate"],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="text-[22px] font-semibold tabular-nums">{value}</p>
              <p className="mt-0.5 text-[11.5px] text-faint">{label}</p>
            </div>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="mb-3 text-[13px] font-medium text-muted">Last six months</h2>
          <div className="no-scrollbar overflow-x-auto">
            <div className="flex w-max gap-[3px]">
              {columns.map((week) => (
                <div key={week[0]} className="flex flex-col gap-[3px]">
                  {week.map((d) => (
                    <span
                      key={d}
                      title={`${fromKey(d).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · ${d < start || d > today ? "—" : done.has(d) ? "done" : "not done"}`}
                      className={cn(
                        "size-[11px] rounded-[3px]",
                        d > today || d < start ? "bg-transparent" : done.has(d) ? "bg-crystal" : "bg-surface-3",
                        d === today && "ring-1 ring-fg/60",
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 text-[11px] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-crystal" /> Done
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-surface-3" /> Not done
            </span>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
