"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { describe, GEMS, newlyEarned, RARITY_NAME, type GemKind } from "@/lib/achievements";
import { BUZZ, fanfare } from "@/lib/fanfare";
import { useClock, useStore } from "@/lib/store";
import type { Achievement } from "@/lib/types";
import { useBackToClose } from "@/lib/useBackToClose";
import { GEM_COLORS, Gem, MedalBadge, METAL_COLORS } from "./Treasure";

type Shown = Pick<Achievement, "id" | "title" | "detail">;

/** Achievements waiting to be revealed, one at a time. */
const useCeremony = create<{ queue: Shown[] }>(() => ({ queue: [] }));
/** Reveal an achievement again (from the Achievements page). */
export const celebrate = (a: Shown) => useCeremony.setState((s) => ({ queue: [...s.queue, a] }));

const RECENT = 10 * 60_000;

/**
 * Keeps every achievement the moment it's earned, and reveals the ones earned just now. What was
 * earned before (old perfect days, or this device catching up) is kept quietly, without a show.
 */
export function AchievementWatcher() {
  const queue = useCeremony((s) => s.queue);

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
      s.earn(fresh);
      if (quiet) return;
      const now = Date.now();
      const wins = fresh.filter((a) => !a.id.startsWith("milestone:") && now - a.earnedAt < RECENT);
      if (!wins.length) return;
      // The win first, then any medal it brought — smallest to grandest.
      const medals = fresh.filter((a) => a.id.startsWith("milestone:"));
      useCeremony.setState((q) => ({ queue: [...q.queue, ...wins, ...medals.sort((a, b) => (describe(a.id)?.rarity ?? 0) - (describe(b.id)?.rarity ?? 0))] }));
    };
    run();
    const offStore = useStore.subscribe(run);
    const offClock = useClock.subscribe((s, prev) => s.today !== prev.today && run());
    return () => {
      offStore();
      offClock();
    };
  }, []);

  return queue[0] ? <Reveal key={queue[0].id} item={queue[0]} /> : null;
}

const SPARKS = Array.from({ length: 28 }, (_, i) => i);

/** The moment: light, sparks, the gem rising in, a chord — and a button to claim it. */
function Reveal({ item }: { item: Shown }) {
  const info = describe(item.id);
  const claim = () => useCeremony.setState((s) => ({ queue: s.queue.slice(1) }));
  useBackToClose(true, claim, { lockScroll: true });
  const rarity = info?.rarity ?? 1;

  useEffect(() => {
    fanfare(rarity);
    navigator.vibrate?.(BUZZ[rarity]);
  }, [rarity]);

  if (!info) return null;
  const gem: GemKind = info.type === "gem" ? info.gem : info.medal.gem;
  const color = info.type === "gem" ? GEM_COLORS[gem].glow : METAL_COLORS[info.medal.metal].mid;
  const label = info.type === "gem" ? `${RARITY_NAME[rarity]} · ${GEMS[gem].name}` : `${RARITY_NAME[rarity]} · ${METAL_COLORS[info.medal.metal].name} medal`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Achievement unlocked: ${item.title}`}
      className="reveal fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden px-6 text-center"
      style={{ ["--glow" as string]: color, background: `radial-gradient(circle at 50% 38%, color-mix(in oklab, ${color} 30%, #000) 0%, #000 62%)` }}
      onClick={claim}
    >
      {/* Rays of light turning slowly behind the prize. */}
      <div aria-hidden className="reveal-rays" />
      <div aria-hidden className="reveal-halo" />

      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <div className="reveal-prize relative flex items-center justify-center" style={{ width: 210, height: 210 }}>
          {info.type === "gem" ? <Gem kind={gem} size={rarity >= 3 ? 200 : 180} /> : <MedalBadge metal={info.medal.metal} gem={gem} size={210} />}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {SPARKS.slice(0, 10 + rarity * 5).map((i) => (
              <i key={i} className="reveal-spark" style={{ ["--a" as string]: `${(i * 360) / (10 + rarity * 5)}deg`, ["--d" as string]: `${110 + (i % 4) * 30 + rarity * 12}px`, animationDelay: `${0.35 + (i % 5) * 0.03}s`, background: i % 3 ? color : "#fff" }} />
            ))}
          </div>
        </div>
      </div>

      <p className="reveal-text mt-10 text-[12px] font-semibold tracking-[0.32em] uppercase" style={{ color: `color-mix(in oklab, ${color} 70%, #fff)`, animationDelay: "0.45s" }}>
        Achievement unlocked
      </p>
      <h2 className="reveal-text mt-3 text-[34px] leading-tight font-semibold tracking-[-0.02em] sm:text-[40px]" style={{ animationDelay: "0.6s" }}>
        {item.title}
      </h2>
      {item.detail && (
        <p className="reveal-text mt-2 max-w-sm text-[16px] leading-relaxed text-muted" style={{ animationDelay: "0.72s" }}>
          {item.detail}
        </p>
      )}
      <p className="reveal-text mt-3 text-[13px] text-faint" style={{ animationDelay: "0.82s" }}>
        {label}
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          claim();
        }}
        className="reveal-text reveal-claim mt-10 h-14 rounded-full px-12 text-[16px] font-semibold text-black transition-transform active:scale-95"
        style={{ animationDelay: "1s", background: `linear-gradient(135deg, #fff, color-mix(in oklab, ${color} 55%, #fff) 50%, color-mix(in oklab, ${color} 80%, #000))` }}
      >
        Claim
      </button>
    </div>,
    document.body,
  );
}
