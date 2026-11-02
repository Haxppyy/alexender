"use client";

import { Check, Dumbbell, Plus, Trash2, Undo2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart } from "@/components/charts";
import { confirmDialog } from "@/components/dialog";
import { SectionProgress } from "@/components/SectionProgress";
import { SortableList } from "@/components/Sortable";
import { EmptyState, IconButton, ProgressBar, Select, toast } from "@/components/ui";
import { addDays, fromKey, toKey } from "@/lib/date";
import { tap } from "@/lib/motion";
import { byOrder, useClock, useStore } from "@/lib/store";
import type { Exercise, WorkoutLog, WorkoutUnit } from "@/lib/types";
import { useBackToClose } from "@/lib/useBackToClose";
import { formatNumber } from "@/lib/life";
import { cn } from "@/lib/utils";

const UNITS: { value: WorkoutUnit; label: string }[] = [
  { value: "reps", label: "reps" },
  { value: "min", label: "minutes" },
  { value: "km", label: "km" },
  { value: "steps", label: "steps" },
];

/** Quick amounts that make sense for each kind of target. */
const STEPS: Record<WorkoutUnit, number[]> = { reps: [10, 20, 50], min: [5, 10, 30], km: [1, 2, 5], steps: [1000, 2000, 5000] };

const unitWord = (unit: WorkoutUnit, n: number) => (unit === "min" ? "min" : unit === "reps" ? (n === 1 ? "rep" : "reps") : unit);
const fmt = (n: number) => (Number.isInteger(n) ? formatNumber(n) : n.toFixed(1));

/** "Push-ups 100", "Run 5 km", "Plank 10 min" → name, daily target, unit. */
function parseExercise(text: string): { title: string; target: number; unit: WorkoutUnit } | null {
  const m = text.trim().match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*(reps?|min(?:utes?)?|km|steps?)?$/i);
  if (!m || !m[1].trim()) return null;
  const word = (m[3] ?? "reps").toLowerCase();
  const unit: WorkoutUnit = word.startsWith("min") ? "min" : word === "km" ? "km" : word.startsWith("step") ? "steps" : "reps";
  return { title: m[1].trim(), target: Number(m[2]), unit };
}

/** A day counts once its total reaches the target. Today is still open, so it never breaks a streak. */
function streakOf(totals: Map<string, number>, target: number, today: string) {
  let n = 0;
  for (let d = (totals.get(today) ?? 0) >= target ? today : addDays(today, -1); (totals.get(d) ?? 0) >= target; d = addDays(d, -1)) n++;
  return n;
}

/** Workout — exercises with a daily target. Log as you go; a day ends hit or missed. */
export default function WorkoutPage() {
  const today = useClock((s) => s.today);
  const exercises = useStore((s) => s.exercises);
  const logs = useStore((s) => s.workoutLogs);
  const { addExercise, reorder } = useStore.getState();
  const [text, setText] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => [...exercises].sort(byOrder), [exercises]);
  // exercise → day → total
  const totals = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const l of logs) {
      if (!map.has(l.exerciseId)) map.set(l.exerciseId, new Map());
      const days = map.get(l.exerciseId)!;
      days.set(l.date, (days.get(l.date) ?? 0) + l.amount);
    }
    return map;
  }, [logs]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)), [today]);

  const hit = list.filter((e) => (totals.get(e.id)?.get(today) ?? 0) >= e.target).length;
  const avg = list.length ? list.reduce((n, e) => n + Math.min(1, (totals.get(e.id)?.get(today) ?? 0) / e.target), 0) / list.length : 0;
  const parsed = parseExercise(text);
  const current = list.find((e) => e.id === open);

  return (
    <div className="mx-auto max-w-xl">

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!parsed) return;
          addExercise(parsed);
          setText("");
        }}
        className="mb-8"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Push-ups 100 · Run 5 km · Plank 10 min"
          aria-label="New exercise with a daily target"
          enterKeyHint="done"
          className="h-12 w-full border-b border-line bg-transparent text-[16px] outline-none placeholder:text-faint focus:border-line-strong"
        />
        <p className="mt-2 h-4 text-[12px] text-faint">
          {text.trim() ? (parsed ? `${parsed.title} — ${fmt(parsed.target)} ${unitWord(parsed.unit, parsed.target)} a day. Press Enter.` : "Add the daily target after the name, like “Push-ups 100”.") : ""}
        </p>
      </form>

      {list.length > 0 && <SectionProgress value={avg * 100} label="of today's targets" detail={`${hit} of ${list.length} hit`} />}

      {list.length === 0 && <EmptyState icon={<Dumbbell className="size-5" />} title="A target you hit every day" hint="Type it above with a number — 100 push-ups, 5 km, 10 minutes of plank — and log it as you go." />}

      <SortableList items={list} onReorder={(ids) => reorder("exercises", ids)} className="space-y-2">
        {(e, handle) => <ExerciseRow exercise={e} totals={totals.get(e.id) ?? new Map()} today={today} days={days} handle={handle} onOpen={() => setOpen(e.id)} />}
      </SortableList>

      {current && <ExerciseView key={current.id} exercise={current} logs={logs.filter((l) => l.exerciseId === current.id)} totals={totals.get(current.id) ?? new Map()} today={today} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ExerciseRow({ exercise: e, totals, today, days, handle, onOpen }: { exercise: Exercise; totals: Map<string, number>; today: string; days: string[]; handle: React.ReactNode; onOpen: () => void }) {
  const { logWorkout, deleteWorkoutLog } = useStore.getState();
  const [custom, setCustom] = useState("");
  const done = totals.get(today) ?? 0;
  const reached = done >= e.target;
  const start = toKey(new Date(e.createdAt));
  const streak = streakOf(totals, e.target, today);

  const add = (amount: number) => {
    if (!(amount > 0)) return;
    const before = done;
    const id = logWorkout(e.id, amount);
    if (before < e.target && before + amount >= e.target) {
      tap(30);
      toast(`${e.title} — target hit`);
    } else toast(`+${fmt(amount)} ${unitWord(e.unit, amount)}`, { label: "Undo", run: () => deleteWorkoutLog(id) });
  };

  return (
    <div className="group relative -mx-2 rounded-2xl px-2 py-3 transition-colors hover:bg-surface">
      <div className="absolute top-5 -left-7 hidden opacity-0 transition-opacity group-hover:opacity-100 lg:block">{handle}</div>
      <button onClick={onOpen} className="flex w-full items-baseline gap-3 text-left">
        <span className="min-w-0 flex-1 text-[16px] leading-snug font-medium break-words">{e.title}</span>
        <span className={cn("shrink-0 text-[14px] tabular-nums", reached ? "text-crystal" : "text-muted")}>
          {reached && <Check className="mr-1 inline size-3.5 align-[-2px]" strokeWidth={3} />}
          <span className="font-semibold text-fg">{fmt(done)}</span> / {fmt(e.target)} {unitWord(e.unit, e.target)}
        </span>
      </button>
      <ProgressBar value={(done / e.target) * 100} tone={reached ? "crystal" : undefined} className="mt-2.5" />

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {STEPS[e.unit].map((n) => (
          <button
            key={n}
            onClick={() => add(n)}
            className="h-9 rounded-full border border-line-strong px-3.5 text-[13px] font-medium tabular-nums text-muted transition-[color,border-color,transform] hover:border-faint hover:text-fg active:scale-95"
          >
            +{fmt(n)}
          </button>
        ))}
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            add(Number(custom));
            setCustom("");
          }}
          className="flex h-9 items-center rounded-full border border-line pl-3 focus-within:border-line-strong"
        >
          <input
            value={custom}
            onChange={(ev) => setCustom(ev.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            placeholder="Other"
            aria-label={`Add ${e.unit} of ${e.title}`}
            className="w-14 bg-transparent text-[13px] tabular-nums outline-none placeholder:text-faint"
          />
          <button type="submit" aria-label="Add" disabled={!Number(custom)} className="flex size-9 items-center justify-center text-faint transition-colors hover:text-fg disabled:opacity-40">
            <Plus className="size-4" />
          </button>
        </form>
      </div>

      {/* The last seven days: hit, missed, or not started yet. */}
      <div className="mt-3 flex items-center gap-1.5">
        {days.map((d) => {
          const total = totals.get(d) ?? 0;
          const state = d < start ? "none" : total >= e.target ? "hit" : d === today ? "open" : "missed";
          return (
            <span
              key={d}
              title={`${fromKey(d).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })} · ${fmt(total)}`}
              className={cn(
                "size-2.5 rounded-full",
                state === "hit" ? "bg-crystal" : state === "missed" ? "bg-danger/35" : state === "open" ? "border border-faint" : "bg-surface-3",
              )}
            />
          );
        })}
        <span className="ml-1.5 text-[11.5px] text-faint tabular-nums">{streak > 0 ? `${streak}-day streak` : "Last 7 days"}</span>
      </div>
    </div>
  );
}

/** One exercise: rename, change the target, see the last 30 days, fix today's log. */
function ExerciseView({ exercise: e, logs, totals, today, onClose }: { exercise: Exercise; logs: WorkoutLog[]; totals: Map<string, number>; today: string; onClose: () => void }) {
  const { updateExercise, deleteExercise, deleteWorkoutLog } = useStore.getState();
  useBackToClose(true, onClose, { lockScroll: true });
  const start = toKey(new Date(e.createdAt));
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
  const counted = last30.filter((d) => d >= start && d <= today);
  const hitDays = counted.filter((d) => (totals.get(d) ?? 0) >= e.target).length;
  const best = Math.max(0, ...totals.values());
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, -i)).reduce((n, d) => n + (totals.get(d) ?? 0), 0);
  const todays = logs.filter((l) => l.date === today).sort((a, b) => b.createdAt - a.createdAt);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={e.title} className="animate-fade fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg">
      <div className="sticky top-0 z-10 bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-1 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-6">
          <IconButton label="Close" onClick={onClose} className="size-10 text-fg">
            <X className="size-5" />
          </IconButton>
          <span className="flex-1" />
          <IconButton
            label="Delete exercise"
            onClick={async () => {
              if (!(await confirmDialog(`Delete “${e.title}”?`, { detail: "Its whole history goes with it.", danger: true }))) return;
              deleteExercise(e.id);
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
          value={e.title}
          onChange={(ev) => ev.target.value.trim() && updateExercise(e.id, { title: ev.target.value })}
          aria-label="Exercise"
          className="mt-2 w-full bg-transparent text-[26px] leading-tight font-semibold tracking-[-0.02em] outline-none sm:text-[30px]"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <span>Daily target</span>
          <input
            inputMode="decimal"
            value={e.target}
            onChange={(ev) => {
              const n = Number(ev.target.value.replace(/[^\d.]/g, ""));
              if (n > 0) updateExercise(e.id, { target: n });
            }}
            aria-label="Daily target"
            className="h-9 w-20 rounded-lg border border-line bg-surface px-2 text-center text-[14px] text-fg tabular-nums outline-none focus:border-line-strong"
          />
          <Select label="Unit" value={e.unit} onChange={(unit) => updateExercise(e.id, { unit })} options={UNITS} className="h-9 rounded-lg border border-line bg-surface px-3 text-[13px]" />
        </div>

        <div className="mt-8 grid grid-cols-4 gap-2">
          {[
            [streakOf(totals, e.target, today), "Streak"],
            [`${hitDays}/${counted.length || 1}`, "Hit · 30 d"],
            [fmt(week), "This week"],
            [fmt(best), "Best day"],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="text-[20px] font-semibold tabular-nums">{value}</p>
              <p className="mt-0.5 text-[11.5px] text-faint">{label}</p>
            </div>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="mb-3 text-[13px] font-medium text-muted">Last 30 days</h2>
          <BarChart
            height={110}
            max={Math.max(e.target, best)}
            labelEvery={7}
            bars={last30.map((d) => {
              const total = totals.get(d) ?? 0;
              return {
                key: d,
                value: total,
                label: fromKey(d).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
                tip: `${fromKey(d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · ${fmt(total)} / ${fmt(e.target)}`,
                tone: total >= e.target ? "crystal" : "fg",
              };
            })}
          />
        </section>

        {todays.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-2 text-[13px] font-medium text-muted">Today</h2>
            <ul className="text-[13.5px]">
              {todays.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-1.5">
                  <span className="w-20 text-faint tabular-nums">{new Date(l.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                  <span className="flex-1 tabular-nums">
                    +{fmt(l.amount)} {unitWord(e.unit, l.amount)}
                  </span>
                  <IconButton label="Remove this entry" onClick={() => deleteWorkoutLog(l.id)} className="size-8 hover:text-danger">
                    <Undo2 className="size-3.5" />
                  </IconButton>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}
