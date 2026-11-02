"use client";

import { Flame, Star, Trash2 } from "lucide-react";
import { tap } from "@/lib/motion";
import { useStore } from "@/lib/store";
import type { DayRating } from "@/lib/types";
import { cn } from "@/lib/utils";
import { VERDICT_REPLY } from "@/lib/voice";
import { toast } from "./ui";

/** Green for a day used, red for a day wasted — the same everywhere a day is shown. */
export const VERDICT_COLOR = { used: "var(--success)", wasted: "var(--danger)" } as const;

export const ratingOf = (ratings: DayRating[], date: string) => ratings.find((r) => r.date === date);

/** Your honest verdict on a day: used or wasted, and 1–5 overall. */
export function DayRater({ date, title = "Rate this day" }: { date: string; title?: string }) {
  const rating = useStore((s) => ratingOf(s.dayRatings, date));
  const rateDay = useStore((s) => s.rateDay);

  const verdict = (v: "used" | "wasted") => {
    tap(v === "used" ? 12 : 30);
    if (rating?.verdict !== v) toast(VERDICT_REPLY[v]);
    rateDay(date, { verdict: v });
  };

  return (
    <section
      className="rounded-3xl border border-line p-4 transition-colors duration-500 sm:p-5"
      style={rating?.verdict ? { borderColor: `color-mix(in oklab, ${VERDICT_COLOR[rating.verdict]} 40%, var(--line))`, background: `color-mix(in oklab, ${VERDICT_COLOR[rating.verdict]} 7%, transparent)` } : undefined}
    >
      <p className="text-[13px] font-medium text-muted">{title}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["used", "wasted"] as const).map((v) => {
          const on = rating?.verdict === v;
          const Icon = v === "used" ? Flame : Trash2;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => verdict(v)}
              className={cn(
                "flex h-14 items-center justify-center gap-2 rounded-2xl border text-[16px] font-semibold transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.97]",
                on ? "text-black" : "border-line-strong text-muted hover:text-fg",
              )}
              style={on ? { background: VERDICT_COLOR[v], borderColor: VERDICT_COLOR[v] } : undefined}
            >
              <Icon className="size-5" />
              {v === "used" ? "Used" : "Wasted"}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[13px] text-faint">Overall</span>
        <div className="flex gap-1" role="radiogroup" aria-label="Overall, 1 to 5">
          {[1, 2, 3, 4, 5].map((n) => {
            const on = (rating?.stars ?? 0) >= n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating?.stars === n}
                aria-label={`${n} of 5`}
                onClick={() => {
                  tap(8);
                  rateDay(date, { stars: n });
                }}
                className="flex size-11 items-center justify-center rounded-xl transition-transform active:scale-90"
              >
                <Star className={cn("size-7 transition-colors duration-200", on ? "fill-[var(--hue-amber)] text-[var(--hue-amber)]" : "text-line-strong")} />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
