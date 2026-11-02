"use client";

import { useMemo } from "react";
import { Swords } from "lucide-react";
import { celebrate, openRewards, useUnclaimed } from "@/components/Ceremony";
import { Gem, MedalBadge, METAL_COLORS } from "@/components/Treasure";
import { countsOf, describe, GEMS, MEDALS, type GemKind } from "@/lib/achievements";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const GEM_ORDER: GemKind[] = ["sapphire", "emerald", "ruby", "diamond"];

/** Everything you've earned: your gems, your medals (and the ones still ahead), and the latest wins. */
export default function AchievementsPage() {
  // The treasury holds what you've claimed; unclaimed rewards wait in the banner above.
  const all = useStore((s) => s.achievements);
  const achievements = useMemo(() => all.filter((a) => !a.unclaimed), [all]);
  const ids = useMemo(() => new Set(achievements.map((a) => a.id)), [achievements]);
  const counts = useMemo(() => countsOf(ids), [ids]);
  const gems = useMemo(() => {
    const n: Record<GemKind, number> = { sapphire: 0, emerald: 0, ruby: 0, diamond: 0 };
    for (const a of achievements) {
      const d = describe(a.id);
      if (d?.type === "gem") n[d.gem]++;
    }
    return n;
  }, [achievements]);
  const total = GEM_ORDER.reduce((s, g) => s + gems[g], 0);
  const medalsEarned = MEDALS.filter((m) => ids.has(`milestone:${m.id}`)).length;
  const recent = [...achievements].sort((a, b) => b.earnedAt - a.earnedAt).slice(0, 30);
  const unclaimed = useUnclaimed();

  return (
    <div className="mx-auto max-w-2xl">
      {unclaimed.length > 0 && (
        <button
          onClick={openRewards}
          className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-[#e0ac34]/40 px-4 py-3.5 text-left transition-transform active:scale-[0.99]"
          style={{ background: "linear-gradient(90deg, rgb(224 172 52 / 0.14), transparent 80%)" }}
        >
          <Swords className="size-5 text-[#e0ac34]" strokeWidth={1.75} />
          <span className="flex-1 text-[15px] font-semibold">
            {unclaimed.length} {unclaimed.length === 1 ? "reward" : "rewards"} waiting
          </span>
          <span className="victory-claim rounded-full px-4 py-1.5 text-[13px] font-bold text-[#2a1a04]">Claim</span>
        </button>
      )}
      {/* The treasury. */}
      <section className="relative overflow-hidden rounded-[32px] border border-line-strong px-5 pt-7 pb-5 text-center" style={{ background: "radial-gradient(120% 80% at 50% 0%, #10161f 0%, #050505 70%)" }}>
        <p className="text-[12px] font-semibold tracking-[0.3em] text-faint uppercase">Treasury</p>
        <p className="mt-2 text-[56px] leading-none font-semibold tracking-[-0.04em] tabular-nums">{total}</p>
        <p className="mt-2 text-[14px] text-muted">
          {total === 1 ? "gem" : "gems"} · {medalsEarned} of {MEDALS.length} medals
        </p>
        <div className="mt-7 grid grid-cols-4 gap-2">
          {GEM_ORDER.map((g) => (
            <div key={g} className={cn("flex flex-col items-center rounded-2xl px-1 py-3", !gems[g] && "opacity-35 grayscale")}>
              <Gem kind={g} size={52} animated={gems[g] > 0} />
              <p className="mt-2 text-[20px] font-semibold tabular-nums">{gems[g]}</p>
              <p className="text-[12px] font-medium">{GEMS[g].name}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-faint">{GEMS[g].for}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Medals: earned ones shine; the rest wait, grey, with how close you are. */}
      <section className="mt-12">
        <h2 className="mb-5 text-[12px] font-semibold tracking-[0.24em] text-faint uppercase">Medals</h2>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3">
          {MEDALS.map((m) => {
            const earned = achievements.find((a) => a.id === `milestone:${m.id}`);
            const have = Math.min(m.need, m.count(counts));
            return (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={!earned}
                  onClick={() => earned && celebrate(earned)}
                  className="flex w-full flex-col items-center text-center transition-transform enabled:active:scale-95"
                >
                  <MedalBadge metal={m.metal} gem={m.gem} size={96} locked={!earned} />
                  <span className={cn("mt-3 text-[15px] font-semibold", !earned && "text-muted")}>{m.title}</span>
                  <span className="mt-0.5 text-[12.5px] text-faint">{m.description}</span>
                  {earned ? (
                    <span className="mt-1.5 text-[11.5px] font-medium" style={{ color: METAL_COLORS[m.metal].mid }}>
                      {METAL_COLORS[m.metal].name} · {new Date(earned.earnedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  ) : (
                    <span className="mt-2 flex w-24 flex-col items-center gap-1">
                      <span className="h-1 w-full overflow-hidden rounded-full bg-surface-3">
                        <span className="block h-full rounded-full bg-muted" style={{ width: `${(have / m.need) * 100}%` }} />
                      </span>
                      <span className="text-[11.5px] text-faint tabular-nums">
                        {have} / {m.need}
                      </span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* The latest wins — tap one to see its moment again. */}
      <section className="mt-14">
        <h2 className="mb-4 text-[12px] font-semibold tracking-[0.24em] text-faint uppercase">Latest</h2>
        {recent.length === 0 ? (
          <p className="text-[15px] leading-relaxed text-faint">Finish every task in a day, complete a plan, achieve a goal or accomplish a mission — each one leaves a gem here.</p>
        ) : (
          <ul className="space-y-1">
            {recent.map((a) => {
              const d = describe(a.id);
              if (!d) return null;
              return (
                <li key={a.id}>
                  <button onClick={() => celebrate(a)} className="flex w-full items-center gap-4 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-surface active:bg-surface">
                    <span className="flex size-12 shrink-0 items-center justify-center">
                      {d.type === "gem" ? <Gem kind={d.gem} size={40} animated={false} /> : <MedalBadge metal={d.medal.metal} gem={d.medal.gem} size={46} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15.5px] font-semibold">{a.title}</span>
                      {a.detail && <span className="block truncate text-[13px] text-muted">{a.detail}</span>}
                    </span>
                    <span className="shrink-0 text-[12px] text-faint tabular-nums">{new Date(a.earnedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
