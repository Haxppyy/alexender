"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { toast } from "./ui";

/** The progress of the section on screen, shown small in the top bar's corner. */
export const useSectionProgress = create<{ value: number | null; label: string; detail?: string }>(() => ({ value: null, label: "" }));

/**
 * Each section's own progress. It isn't drawn where it's placed: it goes up to the corner of the
 * top bar — a small ring and a number — and tapping it there tells the rest.
 */
export function SectionProgress({ value, label, detail }: { value: number; label: string; detail?: string }) {
  useEffect(() => {
    useSectionProgress.setState({ value: Math.round(value), label, detail });
  }, [value, label, detail]);
  useEffect(() => () => useSectionProgress.setState({ value: null, label: "", detail: undefined }), []);
  return null;
}

/** The corner: a thin ring that fills, and the percentage. */
export function SectionProgressCorner() {
  const { value, label, detail } = useSectionProgress();
  if (value === null) return null;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <button
      type="button"
      onClick={() => toast(`${pct}% ${label}${detail ? ` · ${detail}` : ""}`)}
      title={`${pct}% ${label}${detail ? ` · ${detail}` : ""}`}
      aria-label={`${pct}% ${label}`}
      className="animate-fade flex items-center gap-2 rounded-full py-1 pr-1 pl-2 text-[13px] transition-colors hover:bg-surface-2"
    >
      <span className="font-medium tabular-nums">{pct}%</span>
      <svg viewBox="0 0 20 20" className="size-[22px] -rotate-90" aria-hidden>
        <circle cx="10" cy="10" r="8" fill="none" stroke="var(--surface-3)" strokeWidth="2.2" />
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          stroke="var(--crystal)"
          strokeWidth="2.2"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={100 - pct}
          className="transition-[stroke-dashoffset] duration-700 ease-[var(--ease-out)]"
        />
      </svg>
    </button>
  );
}
