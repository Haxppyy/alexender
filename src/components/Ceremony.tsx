"use client";

import { Swords } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { describe, GEMS, newlyEarned, RARITY_NAME, type GemKind, type Rarity } from "@/lib/achievements";
import { BUZZ, collect, victory } from "@/lib/fanfare";
import { useClock, useStore } from "@/lib/store";
import type { Achievement } from "@/lib/types";
import { useBackToClose } from "@/lib/useBackToClose";
import { cn } from "@/lib/utils";
import { GEM_COLORS, Gem, MedalBadge, METAL_COLORS, VictoryEmblem } from "./Treasure";

type Shown = Pick<Achievement, "id" | "title" | "detail">;

/** The victory screen: open with the rewards waiting to be claimed, or replaying one already won. */
const useVictory = create<{ open: boolean; replay: Shown[] | null }>(() => ({ open: false, replay: null }));
/** See an old win's moment again (from the Achievements page). */
export const celebrate = (a: Shown) => useVictory.setState({ open: true, replay: [a] });
/** Bring back the rewards still waiting to be claimed. */
export const openRewards = () => useVictory.setState({ open: true, replay: null });

const RECENT = 10 * 60_000;

/** The rewards won and not yet claimed. */
export function useUnclaimed() {
  const achievements = useStore((s) => s.achievements);
  return useMemo(() => achievements.filter((a) => a.unclaimed), [achievements]);
}

/**
 * Keeps every achievement the moment it's earned. Wins from just now wait to be claimed and open
 * the victory screen; what was earned before (old perfect days, a device catching up) is kept
 * quietly, already in the treasury.
 */
export function AchievementWatcher() {
  const { open, replay } = useVictory();
  const unclaimed = useUnclaimed();

  useEffect(() => {
    let first = true;
    const run = () => {
      const s = useStore.getState();
      const { today } = useClock.getState();
      if (!today) return;
      const fresh = newlyEarned(s, today);
      const quiet = first;
      first = false;
      if (!fresh.length) return;
      const now = Date.now();
      const won = !quiet && fresh.some((a) => !a.id.startsWith("milestone:") && now - a.earnedAt < RECENT);
      // A win from just now waits to be claimed — and so does any medal it brought.
      s.earn(fresh.map((a) => (won && (a.id.startsWith("milestone:") || now - a.earnedAt < RECENT) ? { ...a, unclaimed: true } : a)));
      if (won) useVictory.setState({ open: true, replay: null });
    };
    run();
    const offStore = useStore.subscribe(run);
    const offClock = useClock.subscribe((s, prev) => s.today !== prev.today && run());
    return () => {
      offStore();
      offClock();
    };
  }, []);

  const items = replay ?? unclaimed;
  if (!open || !items.length) return null;
  return <Victory key={items.map((i) => i.id).join()} items={items} claimable={!replay} />;
}

/** The small crossed swords in the top bar while rewards wait. */
export function ClaimButton() {
  const unclaimed = useUnclaimed();
  if (!unclaimed.length) return null;
  return (
    <button
      onClick={openRewards}
      aria-label={`${unclaimed.length} rewards to claim`}
      title="Rewards to claim"
      className="relative flex size-9 items-center justify-center rounded-xl text-[#e0ac34] transition-colors hover:bg-surface-2"
    >
      <Swords className="size-[19px]" strokeWidth={1.75} />
      <span className="absolute top-0.5 right-0.5 flex min-w-4 items-center justify-center rounded-full bg-[#e0ac34] px-1 text-[10px] leading-4 font-semibold text-black tabular-nums">{unclaimed.length}</span>
    </button>
  );
}

const SPARKS = Array.from({ length: 30 }, (_, i) => i);

function rewardOf(a: Shown) {
  const d = describe(a.id);
  if (!d) return null;
  if (d.type === "gem") return { gem: d.gem, rarity: d.rarity, name: GEMS[d.gem].name, sub: `${RARITY_NAME[d.rarity]} gem`, medal: null };
  return { gem: d.medal.gem, rarity: d.rarity, name: a.title, sub: `${METAL_COLORS[d.medal.metal].name} medal · ${RARITY_NAME[d.rarity]}`, medal: d.medal };
}

/**
 * Battle won. The swords and shield come down with the prize in the shield, VICTORY is struck in
 * gold, the spoils are laid out one by one — and Claim drops them into your treasury.
 */
function Victory({ items, claimable }: { items: Shown[]; claimable: boolean }) {
  const [collecting, setCollecting] = useState(false);
  const close = () => useVictory.setState({ open: false, replay: null });
  useBackToClose(true, close, { lockScroll: true });

  // The gems you won first, then the medals they brought, smallest to grandest.
  const rewards = (items.map((a) => ({ a, r: rewardOf(a) })).filter((x) => x.r) as { a: Shown; r: NonNullable<ReturnType<typeof rewardOf>> }[]).sort(
    (x, y) => Number(!!x.r.medal) - Number(!!y.r.medal) || x.r.rarity - y.r.rarity,
  );
  // The battle is the biggest win among them (a medal only leads if it's all there is).
  const lead = [...rewards].sort((x, y) => Number(!!x.r.medal) - Number(!!y.r.medal) || y.r.rarity - x.r.rarity)[0];
  const rarity: Rarity = Math.max(...rewards.map((x) => x.r.rarity)) as Rarity;
  const gem: GemKind = lead?.r.gem ?? "sapphire";
  const color = GEM_COLORS[gem].glow;

  useEffect(() => {
    victory(rarity);
    navigator.vibrate?.(BUZZ[rarity]);
  }, [rarity]);

  if (!lead) return null;
  const claim = () => {
    if (collecting) return;
    setCollecting(true);
    collect(rewards.length);
    navigator.vibrate?.([20, 40, 20, 40, 20]);
    setTimeout(() => {
      useStore.getState().claim(rewards.map((x) => x.a.id));
      close();
    }, 900);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Victory: ${lead.a.title}`}
      className="reveal fixed inset-0 z-[80] flex flex-col items-center overflow-y-auto overscroll-contain px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-center"
      style={{ ["--glow" as string]: color, background: `radial-gradient(circle at 50% 22%, color-mix(in oklab, ${color} 26%, #000) 0%, #000 58%)` }}
    >
      <div aria-hidden className="reveal-rays" style={{ top: "22%" }} />

      {/* The emblem, with the prize set in the shield. */}
      <div className="relative mt-4 shrink-0">
        <div className="reveal-prize">
          <VictoryEmblem gem={gem} size={rarity >= 3 ? 210 : 190} />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {SPARKS.slice(0, 12 + rarity * 4).map((i) => (
            <i key={i} className="reveal-spark" style={{ ["--a" as string]: `${(i * 360) / (12 + rarity * 4)}deg`, ["--d" as string]: `${120 + (i % 4) * 28 + rarity * 10}px`, animationDelay: `${0.5 + (i % 5) * 0.03}s`, background: i % 3 ? color : "#ffe7a3" }} />
          ))}
        </div>
      </div>

      <p className="victory-word mt-6 text-[52px] leading-none font-extrabold tracking-[0.12em] sm:text-[64px]">VICTORY</p>
      <p className="reveal-text mt-3 text-[12.5px] font-semibold tracking-[0.34em] text-[#e9c66a] uppercase" style={{ animationDelay: "0.7s" }}>
        Battle won
      </p>
      <p className="reveal-text mt-4 text-[22px] leading-snug font-semibold" style={{ animationDelay: "0.8s" }}>
        {lead.a.title}
      </p>
      {lead.a.detail && (
        <p className="reveal-text mt-1 max-w-sm text-[15px] text-muted" style={{ animationDelay: "0.85s" }}>
          {lead.a.detail}
        </p>
      )}

      {/* The spoils. */}
      <div className="mt-7 w-full max-w-sm">
        <p className="reveal-text mb-2.5 text-[11.5px] font-semibold tracking-[0.28em] text-faint uppercase" style={{ animationDelay: "0.95s" }}>
          {claimable ? "Rewards" : "Reward"}
        </p>
        <ul className="space-y-2">
          {rewards.map(({ a, r }, i) => (
            <li
              key={a.id}
              className={cn("spoil flex items-center gap-3.5 rounded-2xl border px-3.5 py-2.5 text-left", collecting && "spoil-collect")}
              style={{
                animationDelay: collecting ? `${i * 70}ms` : `${1.05 + i * 0.15}s`,
                borderColor: `color-mix(in oklab, ${r.medal ? METAL_COLORS[r.medal.metal].mid : GEM_COLORS[r.gem].glow} 35%, var(--line))`,
                background: `linear-gradient(90deg, color-mix(in oklab, ${r.medal ? METAL_COLORS[r.medal.metal].mid : GEM_COLORS[r.gem].glow} 12%, transparent), transparent 70%)`,
              }}
            >
              <span className="flex size-12 shrink-0 items-center justify-center">{r.medal ? <MedalBadge metal={r.medal.metal} gem={r.gem} size={48} /> : <Gem kind={r.gem} size={38} />}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold">{r.medal ? r.name : `+1 ${r.name}`}</span>
                <span className="block text-[12.5px] text-muted">{r.sub}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 flex w-full max-w-sm flex-col items-center gap-2">
        {claimable ? (
          <>
            <button
              onClick={claim}
              disabled={collecting}
              className="reveal-text victory-claim h-14 w-full rounded-full text-[17px] font-bold tracking-wide text-[#2a1a04] transition-transform active:scale-[0.97]"
              style={{ animationDelay: `${1.2 + rewards.length * 0.15}s` }}
            >
              {collecting ? "Claimed" : rewards.length > 1 ? "Claim rewards" : "Claim reward"}
            </button>
            {!collecting && (
              <button onClick={close} className="reveal-text h-10 px-4 text-[13px] text-faint hover:text-muted" style={{ animationDelay: `${1.3 + rewards.length * 0.15}s` }}>
                Later
              </button>
            )}
          </>
        ) : (
          <button onClick={close} className="h-12 rounded-full border border-line-strong px-8 text-[15px] font-medium text-muted hover:text-fg">
            Close
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
