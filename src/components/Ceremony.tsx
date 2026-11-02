"use client";

import { Swords } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { describe, GEMS, newlyEarned, RARITY_NAME, type GemKind, type Rarity } from "@/lib/achievements";
import { BUZZ, ping, victory } from "@/lib/fanfare";
import { useClock, useStore } from "@/lib/store";
import type { Achievement } from "@/lib/types";
import { useBackToClose } from "@/lib/useBackToClose";
import { cn } from "@/lib/utils";
import { RewardIcon, RewardTicket } from "./Rewards";
import { Chest, GEM_COLORS, Gem, MedalBadge, METAL_COLORS, VictoryEmblem } from "./Treasure";

type Shown = Pick<Achievement, "id" | "title" | "detail" | "reward">;

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
 * gold, the spoils are laid out one by one — and Claim sends each one flying into the treasure
 * chest, a note for every landing. If you set yourself a real reward, it comes last, on its own:
 * yours now, go and enjoy it.
 */
function Victory({ items, claimable }: { items: Shown[]; claimable: boolean }) {
  const [phase, setPhase] = useState<"show" | "collect" | "treat" | "closing">("show");
  const [landed, setLanded] = useState(0);
  const chest = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const icons = useRef<(HTMLSpanElement | null)[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const close = () => useVictory.setState({ open: false, replay: null });
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  /** Into the treasury for good, and the screen fades away. */
  const finish = () => {
    setPhase("closing");
    later(() => {
      useStore.getState().claim(items.map((a) => a.id));
      close();
    }, 450);
  };
  // Back closes it — but not halfway through claiming.
  useBackToClose(true, () => (phase === "show" ? close() : phase === "treat" ? finish() : undefined), { lockScroll: true });
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const owned = useStore((s) => s.achievements.filter((a) => !a.unclaimed && !a.id.startsWith("milestone:")).length);

  // The gems you won first, then the medals they brought, smallest to grandest.
  const rewards = (items.map((a) => ({ a, r: rewardOf(a) })).filter((x) => x.r) as { a: Shown; r: NonNullable<ReturnType<typeof rewardOf>> }[]).sort(
    (x, y) => Number(!!x.r.medal) - Number(!!y.r.medal) || x.r.rarity - y.r.rarity,
  );
  // The battle is the biggest win among them (a medal only leads if it's all there is).
  const lead = [...rewards].sort((x, y) => Number(!!x.r.medal) - Number(!!y.r.medal) || y.r.rarity - x.r.rarity)[0];
  const rarity: Rarity = Math.max(...rewards.map((x) => x.r.rarity)) as Rarity;
  const gem: GemKind = lead?.r.gem ?? "sapphire";
  const color = GEM_COLORS[gem].glow;
  const gemsWon = rewards.filter((x) => !x.r.medal).length;
  const gemsIn = Math.min(landed, gemsWon);
  // The real rewards you promised yourself, saved for the end.
  const treats = items.filter((a) => a.reward?.text.trim());

  useEffect(() => {
    victory(rarity);
    navigator.vibrate?.(BUZZ[rarity]);
  }, [rarity]);

  if (!lead) return null;

  const claim = () => {
    if (phase !== "show") return;
    setPhase("collect");
    // Bring the chest into view before anything flies to it.
    sheet.current?.scrollTo({ top: 0, behavior: "smooth" });
    const STEP = 240;
    const FLIGHT = 720;
    rewards.forEach((_, i) => {
      later(() => {
        const el = icons.current[i];
        const target = chest.current?.getBoundingClientRect();
        if (!el || !target) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--dx", `${target.left + target.width / 2 - (r.left + r.width / 2)}px`);
        el.style.setProperty("--dy", `${target.top + target.height * 0.35 - (r.top + r.height / 2)}px`);
        el.classList.add("spoil-fly");
      }, 450 + i * STEP);
      later(() => {
        ping(i);
        navigator.vibrate?.(18);
        setLanded((n) => n + 1);
      }, 450 + i * STEP + FLIGHT);
    });
    const done = 450 + (rewards.length - 1) * STEP + FLIGHT + 1000;
    if (treats.length)
      later(() => {
        setPhase("treat");
        ping(5);
        later(() => ping(6), 140);
        navigator.vibrate?.([30, 50, 60]);
      }, done - 250);
    else later(finish, done);
  };

  return createPortal(
    <div
      ref={sheet}
      role="dialog"
      aria-modal="true"
      aria-label={`Victory: ${lead.a.title}`}
      className={cn(
        "reveal fixed inset-0 z-[80] flex flex-col items-center overflow-x-hidden overflow-y-auto overscroll-contain px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-center transition-opacity duration-[450ms]",
        phase === "closing" && "opacity-0",
      )}
      style={{ ["--glow" as string]: color, background: `radial-gradient(circle at 50% 22%, color-mix(in oklab, ${color} 26%, #000) 0%, #000 58%)` }}
    >
      <div aria-hidden className="reveal-rays" style={{ top: "22%" }} />
      {/* Gold dust drifting down. */}
      <div aria-hidden className="gold-dust">
        {SPARKS.slice(0, 16).map((i) => (
          <i key={i} style={{ left: `${(i * 37 + 7) % 100}%`, animationDelay: `${0.9 + (i % 8) * 0.55}s`, animationDuration: `${6 + (i % 4)}s` }} />
        ))}
      </div>

      {/* The emblem — and, when you claim, the treasure chest it all goes into. */}
      <div className="relative mt-2 flex h-[220px] w-full shrink-0 items-center justify-center">
        <div className={cn("transition-[opacity,transform] duration-500 ease-[var(--ease-out)]", phase !== "show" && "-translate-y-4 scale-75 opacity-0")}>
          <div className="reveal-prize">
            <VictoryEmblem gem={gem} size={rarity >= 3 ? 210 : 190} />
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {SPARKS.slice(0, 12 + rarity * 4).map((i) => (
            <i key={i} className="reveal-spark" style={{ ["--a" as string]: `${(i * 360) / (12 + rarity * 4)}deg`, ["--d" as string]: `${120 + (i % 4) * 28 + rarity * 10}px`, animationDelay: `${0.55 + (i % 5) * 0.03}s`, background: i % 3 ? color : "#ffe7a3" }} />
          ))}
        </div>
        <div
          ref={chest}
          className={cn(
            "absolute flex flex-col items-center transition-[opacity,transform] duration-500 ease-[var(--ease-spring)]",
            phase === "show" ? "pointer-events-none translate-y-8 scale-75 opacity-0" : "opacity-100",
          )}
        >
          <div key={landed} className={cn(landed > 0 && "chest-bump")}>
            <Chest size={130} open={landed > 0} />
          </div>
          <p className="mt-1 text-[12px] font-semibold tracking-[0.28em] text-[#e9c66a] uppercase">Treasury</p>
          <p className="mt-0.5 text-[28px] leading-none font-semibold tabular-nums">
            {owned + gemsIn}
            {gemsIn > 0 && (
              <span key={gemsIn} className="chest-plus ml-2 inline-block text-[16px] text-[#e9c66a]">
                +{gemsIn}
              </span>
            )}
          </p>
        </div>
      </div>

      <p className="victory-word mt-5 text-[52px] leading-none font-extrabold tracking-[0.12em] sm:text-[64px]">VICTORY</p>
      <p className="reveal-text mt-3 text-[12.5px] font-semibold tracking-[0.34em] text-[#e9c66a] uppercase" style={{ animationDelay: "0.8s" }}>
        Battle won
      </p>
      <p className="reveal-text mt-4 text-[22px] leading-snug font-semibold" style={{ animationDelay: "0.9s" }}>
        {lead.a.title}
      </p>
      {lead.a.detail && (
        <p className="reveal-text mt-1 max-w-sm text-[15px] text-muted" style={{ animationDelay: "0.95s" }}>
          {lead.a.detail}
        </p>
      )}

      {/* The spoils. */}
      <div className="mt-7 w-full max-w-sm">
        <p className="reveal-text mb-2.5 text-[11.5px] font-semibold tracking-[0.28em] text-faint uppercase" style={{ animationDelay: "1.05s" }}>
          {claimable ? "Rewards" : "Reward"}
        </p>
        <ul className="space-y-2">
          {rewards.map(({ a, r }, i) => {
            const tint = r.medal ? METAL_COLORS[r.medal.metal].mid : GEM_COLORS[r.gem].glow;
            return (
              <li
                key={a.id}
                className={cn("spoil flex items-center gap-3.5 rounded-2xl border px-3.5 py-2.5 text-left transition-opacity duration-500", i < landed && "opacity-35")}
                style={{ animationDelay: `${1.15 + i * 0.18}s`, borderColor: `color-mix(in oklab, ${tint} 35%, var(--line))`, background: `linear-gradient(90deg, color-mix(in oklab, ${tint} 12%, transparent), transparent 70%)` }}
              >
                <span ref={(el) => void (icons.current[i] = el)} className="relative z-10 flex size-12 shrink-0 items-center justify-center">
                  {r.medal ? <MedalBadge metal={r.medal.metal} gem={r.gem} size={48} /> : <Gem kind={r.gem} size={38} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold">{r.medal ? r.name : `+1 ${r.name}`}</span>
                  <span className="block text-[12.5px] text-muted">{r.sub}</span>
                </span>
              </li>
            );
          })}
        </ul>
        {treats.map((a, i) => (
          <RewardTicket
            key={a.id}
            reward={a.reward!}
            state={claimable ? "ready" : "claimed"}
            hint={claimable ? "Yours when you claim" : a.detail}
            className="spoil mt-2"
            style={{ animationDelay: `${1.15 + (rewards.length + i) * 0.18}s` }}
          />
        ))}
      </div>

      {/* The finale: the reward you promised yourself. */}
      {phase === "treat" && (
        <div className="treat-in fixed inset-0 z-10 flex flex-col items-center justify-center bg-black/75 px-8 text-center backdrop-blur-md">
          {treats.map((a) => (
            <div key={a.id} className="mb-8 flex flex-col items-center last:mb-0">
              <span className="treat-medallion flex size-28 items-center justify-center rounded-full text-[#3a2604]">
                <RewardIcon reward={a.reward} className="size-12" />
              </span>
              <p className="mt-6 text-[12px] font-semibold tracking-[0.32em] text-[#e9c66a] uppercase">Your reward</p>
              <p className="mt-2 text-[30px] leading-tight font-semibold tracking-tight">{a.reward!.text}</p>
              {a.detail && <p className="mt-2 text-[14px] text-muted">for {a.detail}</p>}
            </div>
          ))}
          <p className="mt-6 max-w-xs text-[16px] leading-relaxed text-fg/85">You earned it. Go and enjoy it — fully, without guilt.</p>
          <button onClick={finish} className="victory-claim mt-8 h-14 w-full max-w-xs rounded-full text-[17px] font-bold text-[#2a1a04] transition-transform active:scale-[0.97]">
            I&apos;ll enjoy it
          </button>
        </div>
      )}

      <div className="mt-8 flex w-full max-w-sm flex-col items-center gap-2">
        {claimable ? (
          <>
            <button
              onClick={claim}
              disabled={phase !== "show"}
              className="reveal-text victory-claim h-14 w-full rounded-full text-[17px] font-bold tracking-wide text-[#2a1a04] transition-[transform,opacity] active:scale-[0.97] disabled:opacity-70"
              style={{ animationDelay: `${1.3 + (rewards.length + treats.length) * 0.18}s` }}
            >
              {phase === "show" ? (rewards.length > 1 ? "Claim rewards" : "Claim reward") : "Into the treasury…"}
            </button>
            {phase === "show" && (
              <button onClick={close} className="reveal-text h-10 px-4 text-[13px] text-faint hover:text-muted" style={{ animationDelay: `${1.4 + (rewards.length + treats.length) * 0.18}s` }}>
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
