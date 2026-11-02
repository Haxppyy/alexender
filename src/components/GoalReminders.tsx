"use client";

import { Bell } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { goalReminder } from "@/lib/motivate";
import { tap } from "@/lib/motion";
import { notify } from "@/lib/notify";
import { useClock, useStore } from "@/lib/store";
import { useBackToClose } from "@/lib/useBackToClose";
import { Statue } from "./brand";

/** The goal Alexander is reminding you of right now, if any. */
const useShowing = create<{ id: string | null }>(() => ({ id: null }));
export const showReminder = (id: string) => useShowing.setState({ id });

/** A goal the Goals page should open (from "Open goal"), whether it's showing already or not. */
export const useGoalToOpen = create<{ id: string | null }>(() => ({ id: null }));

const KEY = "alex-reminded";
function readSent(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

/**
 * Once a day per goal, at the time you chose, Alexander reminds you: a notification, and his words
 * on screen. If the app wasn't open at that time, he tells you the next time you open it that day.
 */
export function GoalReminders() {
  const showing = useShowing((s) => s.id);

  useEffect(() => {
    const check = () => {
      const { now, today } = useClock.getState();
      if (!today || useShowing.getState().id) return;
      const sent = readSent();
      for (const g of useStore.getState().goals) {
        if (!g.remind || g.achieved || sent[g.id] === today) continue;
        const [h, m] = g.remind.split(":").map(Number);
        const at = new Date(now);
        at.setHours(h, m, 0, 0);
        if (now < at.getTime()) continue;
        try {
          localStorage.setItem(KEY, JSON.stringify({ ...sent, [g.id]: today }));
        } catch {}
        void notify(`Alexander · ${g.title}`, goalReminder(g, today).text, { tag: `alexander-goal-${g.id}`, url: "/goals" });
        tap(20);
        showReminder(g.id);
        return;
      }
    };
    check();
    return useClock.subscribe(check);
  }, []);

  return showing ? <Reminder key={showing} id={showing} /> : null;
}

function Reminder({ id }: { id: string }) {
  const goal = useStore((s) => s.goals.find((g) => g.id === id));
  const today = useClock((s) => s.today);
  const router = useRouter();
  const pathname = usePathname();
  const [leaving, setLeaving] = useState(false);
  const close = () => useShowing.setState({ id: null });
  useBackToClose(true, close, { lockScroll: true });
  // "Open goal": go to Goals first, then close — closing first would step back and undo the move.
  useEffect(() => {
    if (leaving && pathname === "/goals") useShowing.setState({ id: null });
  }, [leaving, pathname]);
  if (!goal) return null;
  const { text, saying } = goalReminder(goal, today);

  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-end justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center">
      <div aria-hidden onClick={close} className="animate-fade absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div role="dialog" aria-modal="true" aria-label={`Alexander reminds you: ${goal.title}`} className="animate-sheet relative w-full max-w-md overflow-hidden rounded-[28px] border border-line-strong bg-surface">
        <div className="flex items-end gap-4 px-6 pt-6">
          <Statue className="h-28 w-auto shrink-0" />
          <div className="min-w-0 pb-1">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.16em] text-crystal uppercase">
              <Bell className="size-3.5" /> Alexander
            </p>
            <h2 className="mt-1.5 text-[24px] leading-tight font-semibold tracking-tight break-words">{goal.title}</h2>
          </div>
        </div>
        <p className="px-6 pt-5 text-[18px] leading-relaxed">{text}</p>
        <p className="px-6 pt-3 text-[13.5px] leading-relaxed text-faint italic">{saying}</p>
        <div className="mt-6 grid grid-cols-2 gap-2 p-3 pt-0">
          <button onClick={close} className="h-12 rounded-2xl border border-line-strong text-[15px] font-medium text-muted transition-colors hover:text-fg active:scale-[0.98]">
            Got it
          </button>
          <button
            onClick={() => {
              useGoalToOpen.setState({ id: goal.id });
              setLeaving(true);
              router.push("/goals");
            }}
            className="h-12 rounded-2xl bg-fg text-[15px] font-semibold text-bg transition-transform active:scale-[0.98]"
          >
            Open goal
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
