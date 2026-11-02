"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { notify } from "@/lib/notify";
import { formatClock } from "@/lib/timer";
import { toast } from "./ui";

/** Three rising notes, played three times — clear enough to hear from across the room. */
function chime() {
  try {
    const ctx = new AudioContext();
    [0, 1.3, 2.6].flatMap((start) => [660, 880, 1100].map((freq, i) => [freq, start + i * 0.22] as const)).forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + delay;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.32, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.65);
    });
    setTimeout(() => ctx.close(), 4500);
  } catch {}
}

/**
 * Ends the running timer at its chosen time on whatever page is open, with a chime, and shows
 * the countdown in the tab title. A timer that ran out while the app was closed is ended quietly.
 */
export function TimerWatcher() {
  const open = useStore((s) => s.timerSessions.find((x) => !x.endedAt));

  useEffect(() => {
    if (!open) return;
    const finish = (whileAway: boolean) => {
      useStore.getState().stopTimer(open.id);
      if (open.open) return toast(`${open.title} stopped after 24 hours`);
      if (whileAway) return;
      chime();
      navigator.vibrate?.([300, 120, 300, 120, 300]);
      toast(`Time's up · ${open.title}`);
      void notify("Time's up", `${open.title} — ${Math.round((open.endsAt - open.startedAt) / 60_000)} minutes done. What's next?`);
    };
    const wait = open.endsAt - Date.now();
    if (wait <= 0) {
      finish(wait < -60_000);
      return;
    }
    const title = document.title;
    const show = () => (document.title = `${formatClock(open.open ? Date.now() - open.startedAt : open.endsAt - Date.now())} · ${open.title}`);
    show();
    const tick = setInterval(show, 1000);
    const done = setTimeout(() => finish(false), wait);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
      document.title = title;
    };
  }, [open]);

  return null;
}
