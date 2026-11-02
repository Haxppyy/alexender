"use client";

import { CalendarDays, CalendarPlus, Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { daysBetween, formatShort } from "@/lib/date";
import { tap } from "@/lib/motion";
import { useClock, useStore } from "@/lib/store";
import type { PlanStep } from "@/lib/types";
import { cn, uid } from "@/lib/utils";
import { SortableList } from "./Sortable";
import { Checkbox, IconButton, toast } from "./ui";

/** "Today", "Tomorrow", "3 days late", "Due 4 Nov" — and how urgent it is. */
export function dueLabel(due: string, today: string) {
  const d = daysBetween(today, due);
  if (d < 0) return { text: `${-d} day${d === -1 ? "" : "s"} late`, tone: "late" as const };
  if (d === 0) return { text: "Today", tone: "soon" as const };
  if (d === 1) return { text: "Tomorrow", tone: "soon" as const };
  return { text: `Due ${formatShort(due)}`, tone: "later" as const };
}

export function DueChip({ due, today, className }: { due: string; today: string; className?: string }) {
  const { text, tone } = dueLabel(due, today);
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-1.5 py-0.5 text-[11.5px] tabular-nums",
        tone === "late" ? "bg-danger/15 text-danger" : tone === "soon" ? "bg-crystal-soft text-crystal" : "bg-surface-2 text-faint",
        className,
      )}
    >
      {text}
    </span>
  );
}

/** The same, as a quiet line of text under a step. */
function DueText({ due, today }: { due: string; today: string }) {
  const { text, tone } = dueLabel(due, today);
  return (
    <span className={cn("inline-flex items-center gap-1 text-[12.5px] tabular-nums", tone === "late" ? "text-danger" : tone === "soon" ? "text-crystal" : "text-faint")}>
      <CalendarDays className="size-3" strokeWidth={1.75} />
      {text}
    </span>
  );
}

/** A step ticked or unticked, stamped with when it was finished. */
export const toggled = (step: PlanStep): Partial<PlanStep> => ({ done: !step.done, doneAt: step.done ? undefined : Date.now() });

export const stepProgress = (steps: PlanStep[] = []) => {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, pct: steps.length ? Math.round((done / steps.length) * 100) : 0, next: steps.find((s) => !s.done) };
};

/** A thin ring that fills as steps are done. */
function Ring({ pct }: { pct: number }) {
  return (
    <span className="relative flex size-14 shrink-0 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="16" fill="none" stroke="var(--surface-3)" strokeWidth="2.5" />
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="var(--crystal)"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={100 - pct}
          className="transition-[stroke-dashoffset] duration-700 ease-[var(--ease-out)]"
        />
      </svg>
      <span className="text-[13px] font-semibold tabular-nums">{pct}%</span>
    </span>
  );
}

/**
 * The plan behind a mission, goal, skill or plan: its progress, the next step up front, every step
 * as one calm line you can tick, date or put on Today, and an always-ready line to add the next.
 */
export function StepPlanner({ steps = [], onChange, emptyHint = "Break it into steps — the smaller, the better." }: { steps?: PlanStep[]; onChange: (steps: PlanStep[]) => void; emptyHint?: string }) {
  const today = useClock((s) => s.today);
  const addTask = useStore((s) => s.addTask);
  const reorder = (ids: string[]) => onChange([...ids.map((id) => steps.find((s) => s.id === id)!), ...steps.filter((s) => s.done)]);
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const open = steps.filter((s) => !s.done);
  const done = steps.filter((s) => s.done);
  const { pct, next } = stepProgress(steps);
  const late = open.filter((s) => s.due && s.due < today).length;

  const patch = (id: string, change: Partial<PlanStep>) => onChange(steps.map((s) => (s.id === id ? { ...s, ...change } : s)));
  const toggle = (step: PlanStep) => {
    if (!step.done) tap(10);
    patch(step.id, toggled(step));
  };
  const toToday = (step: PlanStep) => {
    addTask({ title: step.text, date: today });
    toast("Added to Today");
  };
  const add = () => {
    if (!text.trim()) return;
    onChange([...open, { id: uid(), text: text.trim(), done: false, ...(due && { due }) }, ...done]);
    setText("");
    setDue("");
  };

  return (
    <div>
      {steps.length > 0 && (
        <div className="mb-5 flex items-center gap-4">
          <Ring pct={pct} />
          <div className="min-w-0">
            <p className="text-[16px] font-semibold tabular-nums">
              {done.length} of {steps.length} steps done
            </p>
            <p className="mt-0.5 text-[13px] text-faint">
              {open.length === 0 ? "Every step is done." : `${open.length} to go${late ? ` · ${late} late` : ""}`}
            </p>
          </div>
        </div>
      )}

      {next && (
        <div className="mb-6 rounded-3xl border border-line-strong bg-surface p-4">
          <p className="text-[12px] font-medium tracking-[0.14em] text-faint uppercase">Next step</p>
          <p className="mt-1.5 text-[18px] leading-snug font-semibold break-words">{next.text}</p>
          {next.due && (
            <p className="mt-1">
              <DueText due={next.due} today={today} />
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => toggle(next)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-fg text-[14.5px] font-semibold text-bg transition-transform active:scale-[0.97]"
            >
              <Check className="size-4" strokeWidth={2.5} /> Done
            </button>
            <button
              onClick={() => toToday(next)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-line-strong text-[14.5px] font-medium text-muted transition-[color,transform] hover:text-fg active:scale-[0.97]"
            >
              <CalendarPlus className="size-4" /> Add to Today
            </button>
          </div>
        </div>
      )}

      {steps.length === 0 && <p className="mb-4 text-[14.5px] leading-relaxed text-faint">{emptyHint}</p>}

      {/* Every open step, one line each, joined by a thin thread. */}
      <SortableList items={open} onReorder={reorder}>
        {(step, handle, index) => (
          <div className="group relative -mx-2 rounded-2xl px-2 transition-colors hover:bg-surface">
            {index < open.length - 1 && <span aria-hidden className="absolute top-10 bottom-0 left-[calc(3rem+11.5px)] w-px bg-line pointer-coarse:left-[calc(0.5rem+11.5px)]" />}
            <div className="flex min-h-[56px] items-start gap-3 py-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center pointer-coarse:hidden pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100">{handle}</div>
              <div className="flex h-7 items-center">
                <Checkbox checked={false} label={step.text} onChange={() => toggle(step)} />
              </div>
              <button onClick={() => setOpenId(openId === step.id ? null : step.id)} className="min-w-0 flex-1 pt-0.5 text-left">
                <span className="block text-[16px] leading-snug break-words">{step.text}</span>
                {step.due && (
                  <span className="mt-1 block">
                    <DueText due={step.due} today={today} />
                  </span>
                )}
              </button>
            </div>
            {openId === step.id && (
              <div className="animate-fade flex flex-wrap items-center gap-2 pb-3 pl-9 pointer-fine:pl-[4.75rem]">
                <input
                  value={step.text}
                  onChange={(e) => patch(step.id, { text: e.target.value })}
                  aria-label="Step"
                  className="h-10 min-w-0 flex-1 basis-full rounded-xl bg-surface-2 px-3 text-[14.5px] outline-none sm:basis-auto"
                />
                <label className="flex h-10 items-center gap-2 rounded-xl border border-line px-3 text-[13px] text-faint">
                  <CalendarDays className="size-4" />
                  <input
                    type="date"
                    value={step.due ?? ""}
                    onChange={(e) => patch(step.id, { due: e.target.value || undefined })}
                    aria-label="Due date"
                    className="bg-transparent text-[13.5px] text-fg outline-none [color-scheme:dark]"
                  />
                </label>
                <span className="flex-1" />
                <IconButton label="Add to Today" onClick={() => toToday(step)}>
                  <CalendarPlus className="size-4" />
                </IconButton>
                <IconButton
                  label="Delete step"
                  onClick={() => {
                    onChange(steps.filter((s) => s.id !== step.id));
                    setOpenId(null);
                  }}
                  className="hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            )}
          </div>
        )}
      </SortableList>

      <form
        className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-surface p-1.5 pl-4 transition-colors focus-within:border-line-strong"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a step"
          aria-label="New step"
          enterKeyHint="done"
          className="h-10 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"
        />
        {/* A date only if you want one: the calendar opens the picker. */}
        <label className="relative flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-2.5 text-faint transition-colors hover:bg-surface-2 hover:text-fg" title="Due date">
          <CalendarDays className="size-[18px]" />
          {due && <DueChip due={due} today={today} />}
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            aria-label="Due date for the new step"
            className="absolute inset-0 cursor-pointer opacity-0 [color-scheme:dark]"
          />
        </label>
        <button type="submit" aria-label="Add step" disabled={!text.trim()} className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-fg text-bg transition-[transform,opacity] active:scale-90 disabled:opacity-25">
          <Plus className="size-5" strokeWidth={2.4} />
        </button>
      </form>

      {done.length > 0 && (
        <div className="mt-5">
          <button onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="flex h-9 items-center gap-1.5 text-[13.5px] text-faint transition-colors hover:text-fg">
            {done.length} done
            <ChevronDown className={cn("size-4 transition-transform", showDone && "rotate-180")} />
          </button>
          {showDone && (
            <ul className="animate-fade mt-1">
              {done.map((step) => (
                <li key={step.id} className="flex min-h-11 items-center gap-3 pointer-fine:pl-10">
                  <Checkbox checked label={step.text} onChange={() => toggle(step)} />
                  <span className="min-w-0 flex-1 text-[15px] text-faint line-through decoration-faint/60">{step.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
