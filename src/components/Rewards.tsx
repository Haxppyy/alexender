"use client";

import { Bed, Check, Clapperboard, Coffee, Gamepad2, Gift, Lock, Plane, ShoppingBag, Sparkles, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { createElement, useState } from "react";
import type { Achievement, PersonalReward } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * The real-life reward you set yourself for a plan, goal or mission: pick one of the usual treats
 * or write your own. It stays locked until the thing is done — then you claim it.
 */

export const REWARD_KINDS: { icon: string; label: string; Icon: LucideIcon }[] = [
  { icon: "meal", label: "A favourite meal", Icon: UtensilsCrossed },
  { icon: "movie", label: "A film night", Icon: Clapperboard },
  { icon: "gift", label: "Something I've wanted", Icon: Gift },
  { icon: "rest", label: "A day of rest", Icon: Bed },
  { icon: "trip", label: "A trip", Icon: Plane },
  { icon: "game", label: "A gaming session", Icon: Gamepad2 },
  { icon: "coffee", label: "Coffee out", Icon: Coffee },
  { icon: "shop", label: "A new outfit", Icon: ShoppingBag },
];

/** The picture that goes with a reward. */
export const RewardIcon = ({ reward, className }: { reward?: PersonalReward; className?: string }) =>
  createElement(REWARD_KINDS.find((k) => k.icon === reward?.icon)?.Icon ?? Sparkles, { className, strokeWidth: 1.6 });

/** Choose a treat, or write your own (the text is yours to change either way). */
export function RewardPicker({ value, onChange }: { value?: PersonalReward; onChange: (r: PersonalReward | undefined) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-[12px] text-faint">Your reward · optional</span>
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {REWARD_KINDS.map((k) => {
          const on = value?.icon === k.icon;
          return (
            <button
              key={k.icon}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? undefined : { text: k.label, icon: k.icon })}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
                on ? "border-[#e0ac34]/60 bg-[#e0ac34]/12 text-[#f2d68a]" : "border-line text-muted hover:text-fg",
              )}
            >
              <k.Icon className="size-3.5" strokeWidth={1.75} />
              {k.label}
            </button>
          );
        })}
      </div>
      <input
        value={value?.text ?? ""}
        onChange={(e) => onChange(e.target.value ? { text: e.target.value, icon: value?.icon ?? "custom" } : undefined)}
        placeholder="…or write your own: Dinner at my favourite place"
        aria-label="Your reward"
        className="mt-2 h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] outline-none placeholder:text-faint focus:border-line-strong"
      />
    </div>
  );
}

/** The reward as a small ticket: locked until it's won, ready to claim, or claimed. */
export function RewardTicket({ reward, state, hint, className, style }: { reward: PersonalReward; state: "locked" | "ready" | "claimed"; hint?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      className={cn("relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-3", state === "locked" ? "border-line bg-surface" : "border-[#e0ac34]/45", className)}
      style={{ ...(state !== "locked" && { background: "linear-gradient(100deg, rgb(224 172 52 / 0.16), rgb(224 172 52 / 0.04) 70%)" }), ...style }}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", state === "locked" ? "bg-surface-2 text-faint" : "bg-[#e0ac34]/18 text-[#f2d68a]")}>
        <RewardIcon reward={reward} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] font-semibold tracking-[0.16em] text-faint uppercase">{state === "claimed" ? "Reward claimed" : state === "ready" ? "Reward ready" : "Your reward"}</span>
        <span className={cn("mt-0.5 block truncate text-[15.5px] font-semibold", state === "locked" && "text-muted")}>{reward.text}</span>
        {hint && <span className="mt-0.5 block text-[12.5px] text-faint">{hint}</span>}
      </span>
      {state === "locked" ? <Lock className="size-4 shrink-0 text-faint" /> : state === "claimed" ? <Check className="size-4 shrink-0 text-[#e0ac34]" /> : null}
    </span>
  );
}

/**
 * A plan's, goal's or mission's reward where you edit it: set one, change it while it's locked,
 * and claim it once the thing is done.
 */
export function RewardSection({ reward, onChange, done, earned, onClaim, what }: { reward?: PersonalReward; onChange: (r: PersonalReward | undefined) => void; done: boolean; earned?: Achievement; onClaim: () => void; what: string }) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <RewardPicker value={reward} onChange={onChange} />
        <div className="flex justify-end">
          <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-full bg-fg px-4 text-[13.5px] font-semibold text-bg">
            Done
          </button>
        </div>
      </div>
    );
  if (!reward)
    return done ? null : (
      <button type="button" onClick={() => setEditing(true)} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-line-strong px-4 py-3.5 text-left text-[14.5px] text-muted transition-colors hover:border-[#e0ac34]/50 hover:text-fg">
        <Gift className="size-5 text-[#e0ac34]" strokeWidth={1.6} />
        Set a reward for finishing this {what}
      </button>
    );
  const state = earned ? (earned.unclaimed ? "ready" : "claimed") : "locked";
  const ticket = (
    <RewardTicket
      reward={earned?.reward ?? reward}
      state={state}
      hint={
        state === "locked"
          ? `Unlocks when this ${what} is ${what === "goal" ? "achieved" : what === "mission" ? "accomplished" : "done"}`
          : state === "ready"
            ? "Tap to claim it"
            : `Claimed · ${new Date(earned!.updatedAt ?? earned!.earnedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
      }
    />
  );
  if (state === "ready")
    return (
      <button type="button" onClick={onClaim} className="block w-full text-left transition-transform active:scale-[0.99]">
        {ticket}
      </button>
    );
  return (
    <div>
      {ticket}
      {state === "locked" && (
        <button type="button" onClick={() => setEditing(true)} className="mt-1.5 px-1 text-[12.5px] text-faint hover:text-fg">
          Change reward
        </button>
      )}
    </div>
  );
}
