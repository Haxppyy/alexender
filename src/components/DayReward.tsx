"use client";

import { Lock } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { openRewards } from "./Ceremony";
import { Chest, Gem } from "./Treasure";

/**
 * The day's prize, always in sight at the end of the list: a chest with a sapphire, locked until
 * every task is done. At 100% it opens and waits for you to claim it; once claimed, it says so.
 */
export function DayReward({ date }: { date: string }) {
  const log = useStore((s) => s.days[date]);
  const won = useStore((s) => s.achievements.find((a) => a.id === `perfect-day:${date}`));
  const total = log?.total ?? 0;
  const done = log?.done ?? 0;
  const left = total - done;
  const state = won ? (won.unclaimed ? "ready" : "claimed") : "locked";

  const body = (
    <span
      className={cn(
        "relative flex items-center gap-4 overflow-hidden rounded-3xl border px-4 py-4 transition-[border-color,background-color] duration-500",
        state === "ready" ? "day-reward-ready border-[#e0ac34]/60" : state === "claimed" ? "border-line" : "border-line bg-surface",
      )}
      style={state === "ready" ? { background: "radial-gradient(120% 140% at 0% 50%, rgb(224 172 52 / 0.22), rgb(10 8 4) 70%)" } : undefined}
    >
      <span className={cn("relative flex shrink-0 items-center justify-center", state === "locked" && "opacity-60 grayscale")}>
        <Chest size={64} open={state !== "locked"} />
        <span className={cn("absolute top-[2px] transition-[opacity,transform] duration-700", state === "locked" ? "translate-y-3 opacity-0" : "opacity-100")}>
          <Gem kind="sapphire" size={26} animated={state === "ready"} />
        </span>
        {state === "locked" && <Lock className="absolute right-0 bottom-0 size-4 text-faint" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] font-semibold tracking-[0.18em] text-faint uppercase">Today&apos;s reward</span>
        <span className="mt-0.5 block text-[17px] font-semibold">{state === "claimed" ? "Sapphire claimed" : "A sapphire"}</span>
        <span className="mt-0.5 block text-[13px] text-muted">
          {state === "ready"
            ? "Every task done. Claim your reward."
            : state === "claimed"
              ? "It's in your treasury. A perfect day."
              : total === 0
                ? "Plan the day, then finish every task to win it."
                : `Finish every task to claim it · ${left} left`}
        </span>
        {state === "locked" && total > 0 && (
          <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-full bg-[#e0ac34]/70 transition-[width] duration-700" style={{ width: `${(done / total) * 100}%` }} />
          </span>
        )}
      </span>
      {state === "ready" && <span className="victory-claim shrink-0 rounded-full px-4 py-2 text-[14px] font-bold text-[#2a1a04]">Claim</span>}
    </span>
  );

  return state === "ready" ? (
    <button type="button" onClick={openRewards} className="block w-full text-left transition-transform active:scale-[0.99]">
      {body}
    </button>
  ) : (
    body
  );
}
