"use client";

import { CalendarCheck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { tap } from "@/lib/motion";
import { notify } from "@/lib/notify";
import { plannedFor, type PlannedItem } from "@/lib/planned";
import { useClock, useStore } from "@/lib/store";
import type { PlanStep } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dueLabel, toggled } from "./StepPlanner";
import { Checkbox } from "./ui";

/** Whether the "planned for today" card is showing. */
const usePlannedCard = create<{ open: boolean }>(() => ({ open: false }));

const SEEN = "alex-planned-seen";
const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

function usePlanned() {
  const plans = useStore((s) => s.plans);
  const goals = useStore((s) => s.goals);
  const missions = useStore((s) => s.missions);
  const skills = useStore((s) => s.skills);
  const today = useClock((s) => s.today);
  return useMemo(() => plannedFor({ plans, goals, missions, skills }, today), [plans, goals, missions, skills, today]);
}

/** Tick a step done from wherever it was planned. */
function complete(item: PlannedItem) {
  const s = useStore.getState();
  const steps = (list: PlanStep[] = []) => list.map((x) => (x.id === item.step.id ? { ...x, ...toggled(x) } : x));
  if (item.kind === "plans") s.updatePlan(item.ownerId, { steps: steps(s.plans.find((p) => p.id === item.ownerId)?.steps) });
  if (item.kind === "goals") s.updateGoal(item.ownerId, { steps: steps(s.goals.find((g) => g.id === item.ownerId)?.steps) });
  if (item.kind === "missions") s.updateMission(item.ownerId, { steps: steps(s.missions.find((m) => m.id === item.ownerId)?.steps) });
  if (item.kind === "skills") s.updateSkill(item.ownerId, { steps: steps(s.skills.find((k) => k.id === item.ownerId)?.steps) });
}

/**
 * Once a day, the first time Alexander is open and something you planned is due: a notification
 * with what to do next, and a card on screen listing it all. Close the card and it stays closed
 * today — the small calendar icon in the top bar brings it back.
 */
export function PlannedToday() {
  const items = usePlanned();
  const open = usePlannedCard((s) => s.open);
  const today = useClock((s) => s.today);

  useEffect(() => {
    if (!today || !items.length || read(SEEN) === today) return;
    write(SEEN, today);
    usePlannedCard.setState({ open: true });
    const next = items[0].step.text;
    void notify(`Planned for today${items.length > 1 ? ` · ${items.length}` : ""}`, `Next: ${next}`, { tag: "alexander-planned", url: items[0].href });
  }, [today, items]);

  if (!open || !items.length) return null;
  const close = () => usePlannedCard.setState({ open: false });
  const [first, ...rest] = items;

  return (
    <aside
      aria-label="Planned for today"
      className="animate-sheet fixed inset-x-3 top-[calc(3.75rem+env(safe-area-inset-top))] z-40 rounded-3xl border border-line-strong bg-surface/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:w-[24rem] lg:right-10"
    >
      <div className="flex items-center gap-2">
        <CalendarCheck className="size-[18px] text-crystal" strokeWidth={1.75} />
        <p className="flex-1 text-[14px] font-semibold">
          Planned for today <span className="font-normal text-faint tabular-nums">· {items.length}</span>
        </p>
        <button onClick={close} aria-label="Close" className="flex size-9 items-center justify-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-fg">
          <X className="size-4" />
        </button>
      </div>

      {/* What's next, large. */}
      <div className="mt-3 flex items-start gap-3 rounded-2xl bg-surface-2 p-3.5">
        <div className="pt-0.5">
          <Checkbox
            checked={false}
            label={first.step.text}
            onChange={() => {
              tap(10);
              complete(first);
            }}
          />
        </div>
        <Link href={first.href} onClick={close} className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-medium tracking-[0.12em] text-faint uppercase">Next</span>
          <span className="mt-0.5 block text-[17px] leading-snug font-semibold break-words">{first.step.text}</span>
          <Meta item={first} today={today} />
        </Link>
      </div>

      {rest.length > 0 && (
        <ul className="mt-2 max-h-[38dvh] space-y-0.5 overflow-y-auto overscroll-contain">
          {rest.map((item) => (
            <li key={item.key} className="flex items-start gap-3 rounded-xl px-3.5 py-2.5">
              <div className="pt-0.5">
                <Checkbox
                  size="sm"
                  checked={false}
                  label={item.step.text}
                  onChange={() => {
                    tap(10);
                    complete(item);
                  }}
                />
              </div>
              <Link href={item.href} onClick={close} className="min-w-0 flex-1">
                <span className="block text-[15px] leading-snug break-words">{item.step.text}</span>
                <Meta item={item} today={today} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function Meta({ item, today }: { item: PlannedItem; today: string }) {
  const due = dueLabel(item.step.due!, today);
  return (
    <span className="mt-0.5 block truncate text-[12.5px] text-faint">
      {due.tone === "late" && <span className="text-danger">{due.text} · </span>}
      {item.from}
    </span>
  );
}

/** The small icon that brings the card back, with how many are waiting. */
export function PlannedButton() {
  const items = usePlanned();
  const open = usePlannedCard((s) => s.open);
  if (!items.length) return null;
  return (
    <button
      onClick={() => usePlannedCard.setState({ open: !open })}
      aria-label={`Planned for today: ${items.length}`}
      aria-expanded={open}
      title="Planned for today"
      className={cn("relative flex size-9 items-center justify-center rounded-xl transition-colors hover:bg-surface-2", open ? "text-fg" : "text-muted")}
    >
      <CalendarCheck className="size-[19px]" strokeWidth={1.75} />
      <span className="absolute top-0.5 right-0.5 flex min-w-4 items-center justify-center rounded-full bg-crystal px-1 text-[10px] leading-4 font-semibold text-black tabular-nums">{items.length}</span>
    </button>
  );
}
