"use client";

import { ChevronRight, Swords } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { celebrate, openRewards, useUnclaimed } from "@/components/Ceremony";
import { DayReward } from "@/components/DayReward";
import { RewardTicket } from "@/components/Rewards";
import { stepProgress } from "@/components/StepPlanner";
import { Gem, MedalBadge, METAL_COLORS } from "@/components/Treasure";
import { ProgressBar, Segmented } from "@/components/ui";
import { countsOf, describe, GEMS, MEDALS, type GemKind } from "@/lib/achievements";
import { fromKey } from "@/lib/date";
import { useClock, useStore } from "@/lib/store";
import type { Achievement, PersonalReward } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "days" | "plans" | "goals" | "missions" | "medals";
const TAB_GEM: Record<Exclude<Tab, "medals">, GemKind> = { days: "sapphire", plans: "emerald", goals: "ruby", missions: "diamond" };

const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Everything you've won, by kind: your days, your plans, goals and missions, and your medals. */
export default function AchievementsPage() {
  const all = useStore((s) => s.achievements);
  const unclaimed = useUnclaimed();
  // The treasury holds what you've claimed; rewards still waiting sit in the banner above it.
  const claimed = useMemo(() => all.filter((a) => !a.unclaimed), [all]);
  const [tab, setTab] = useState<Tab>("days");

  const gems = useMemo(() => {
    const n: Record<GemKind, number> = { sapphire: 0, emerald: 0, ruby: 0, diamond: 0 };
    for (const a of claimed) {
      const d = describe(a.id);
      if (d?.type === "gem") n[d.gem]++;
    }
    return n;
  }, [claimed]);
  const medals = MEDALS.filter((m) => claimed.some((a) => a.id === `milestone:${m.id}`)).length;

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

      {/* The treasury: what you hold, by stone. */}
      <section className="rounded-[28px] border border-line-strong px-4 pt-5 pb-4" style={{ background: "radial-gradient(120% 90% at 50% 0%, #121820 0%, #050505 70%)" }}>
        <div className="flex items-baseline justify-between px-1">
          <p className="text-[12px] font-semibold tracking-[0.28em] text-faint uppercase">Treasury</p>
          <p className="text-[13px] text-muted tabular-nums">
            {medals} of {MEDALS.length} medals
          </p>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-1">
          {(Object.keys(GEMS) as GemKind[]).map((g) => (
            <div key={g} className={cn("flex flex-col items-center py-1", !gems[g] && "opacity-35 grayscale")}>
              <Gem kind={g} size={44} animated={gems[g] > 0} />
              <p className="mt-1.5 text-[19px] font-semibold tabular-nums">{gems[g]}</p>
              <p className="text-[11.5px] text-faint">{GEMS[g].name}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="no-scrollbar -mx-4 mt-6 mb-6 overflow-x-auto px-4">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "days", label: "Days" },
            { value: "plans", label: "Plans" },
            { value: "goals", label: "Goals" },
            { value: "missions", label: "Missions" },
            { value: "medals", label: "Medals" },
          ]}
        />
      </div>

      <div key={tab} className="animate-fade">
        {tab === "days" && <Days achievements={all} />}
        {tab === "plans" && <Wins kind="plans" achievements={all} />}
        {tab === "goals" && <Wins kind="goals" achievements={all} />}
        {tab === "missions" && <Wins kind="missions" achievements={all} />}
        {tab === "medals" && <Medals achievements={claimed} />}
      </div>
    </div>
  );
}

function Heading({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="mt-8 mb-3 flex items-baseline justify-between gap-3 first:mt-0">
      <h2 className="text-[12px] font-semibold tracking-[0.24em] text-faint uppercase">{children}</h2>
      {note && <p className="text-[12.5px] text-faint">{note}</p>}
    </div>
  );
}

/** Today's prize, and every perfect day you've had — a sapphire each. */
function Days({ achievements }: { achievements: Achievement[] }) {
  const today = useClock((s) => s.today);
  const days = achievements.filter((a) => a.id.startsWith("perfect-day:")).sort((a, b) => b.id.localeCompare(a.id));
  return (
    <>
      <Heading>Today</Heading>
      <DayReward date={today} />
      <Heading note={`${days.length} ${days.length === 1 ? "sapphire" : "sapphires"}`}>Perfect days</Heading>
      {days.length === 0 ? (
        <p className="text-[14.5px] leading-relaxed text-faint">Finish every task in a day and its sapphire is yours.</p>
      ) : (
        <ul className="space-y-1">
          {days.map((a) => (
            <WonRow key={a.id} a={a} gem="sapphire" title={fromKey(a.id.slice(12)).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} sub={a.id.slice(12, 16)} />
          ))}
        </ul>
      )}
    </>
  );
}

/** Won, and still to win: each with the reward you set yourself. */
function Wins({ kind, achievements }: { kind: "plans" | "goals" | "missions"; achievements: Achievement[] }) {
  const plans = useStore((s) => s.plans);
  const goals = useStore((s) => s.goals);
  const missions = useStore((s) => s.missions);
  const gem = TAB_GEM[kind];
  const prefix = kind === "plans" ? "plan:" : kind === "goals" ? "goal:" : "mission:";
  const won = achievements.filter((a) => a.id.startsWith(prefix)).sort((a, b) => b.earnedAt - a.earnedAt);
  const wonIds = new Set(won.map((a) => a.id.slice(prefix.length)));
  const href = kind === "plans" ? "/plans" : kind === "goals" ? "/goals" : "/mission";
  const verb = kind === "plans" ? "complete" : kind === "goals" ? "achieve" : "accomplish";
  const stone = GEMS[gem].name.toLowerCase();

  const ahead: { id: string; title: string; pct: number; reward?: PersonalReward }[] =
    kind === "plans"
      ? plans.filter((p) => p.status !== "done" && !wonIds.has(p.id)).map((p) => ({ id: p.id, title: p.title, pct: stepProgress(p.steps).pct, reward: p.reward }))
      : kind === "goals"
        ? goals.filter((g) => !g.achieved && !wonIds.has(g.id)).map((g) => ({ id: g.id, title: g.title, pct: stepProgress(g.steps).pct, reward: g.reward }))
        : missions.filter((m) => !m.accomplished && !wonIds.has(m.id)).map((m) => ({ id: m.id, title: m.text, pct: stepProgress(m.steps).pct, reward: m.reward }));

  return (
    <>
      <Heading note={`${won.length} ${won.length === 1 ? stone : `${stone}s`}`}>Won</Heading>
      {won.length === 0 ? (
        <p className="text-[14.5px] leading-relaxed text-faint">
          {verb[0].toUpperCase() + verb.slice(1)} one and its {stone} — and the reward you set yourself — are yours to claim.
        </p>
      ) : (
        <ul className="space-y-1">
          {won.map((a) => (
            <WonRow key={a.id} a={a} gem={gem} title={a.detail ?? a.title} sub={shortDate(a.earnedAt)} />
          ))}
        </ul>
      )}

      <Heading>Still to win</Heading>
      {ahead.length === 0 ? (
        <p className="text-[14.5px] text-faint">Nothing in progress.</p>
      ) : (
        <ul className="space-y-3">
          {ahead.map((x) => (
            <li key={x.id}>
              <Link href={href} className="block rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-line-strong">
                <span className="flex items-center gap-3">
                  <span className="opacity-40 grayscale">
                    <Gem kind={gem} size={30} animated={false} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-semibold">{x.title}</span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <ProgressBar value={x.pct} tone="crystal" className="h-[3px] flex-1" />
                      <span className="text-[12px] text-faint tabular-nums">{x.pct}%</span>
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-faint" />
                </span>
                {x.reward ? (
                  <RewardTicket reward={x.reward} state="locked" hint={`Unlocks when you ${verb} it`} className="mt-3" />
                ) : (
                  <span className="mt-2 block text-[12.5px] text-faint">No reward set — open it to choose one.</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** One win: its stone, what it was for, the reward you set — tap to see its moment again. */
function WonRow({ a, gem, title, sub }: { a: Achievement; gem: GemKind; title: string; sub: string }) {
  return (
    <li>
      <button onClick={() => (a.unclaimed ? openRewards() : celebrate(a))} className="w-full rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-surface active:bg-surface">
        <span className="flex items-center gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center">
            <Gem kind={gem} size={36} animated={false} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15.5px] font-semibold">{title}</span>
            <span className="block text-[12.5px] text-faint">{a.unclaimed ? <span className="text-[#e9c66a]">Ready to claim</span> : sub}</span>
          </span>
        </span>
        {a.reward && <RewardTicket reward={a.reward} state={a.unclaimed ? "ready" : "claimed"} className="mt-2 ml-[3.6rem]" />}
      </button>
    </li>
  );
}

/** Medals: earned ones shine; the rest wait, grey, with how close you are. */
function Medals({ achievements }: { achievements: Achievement[] }) {
  const ids = useMemo(() => new Set(achievements.map((a) => a.id)), [achievements]);
  const counts = useMemo(() => countsOf(ids), [ids]);
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3">
      {MEDALS.map((m) => {
        const earned = achievements.find((a) => a.id === `milestone:${m.id}`);
        const have = Math.min(m.need, m.count(counts));
        return (
          <li key={m.id}>
            <button type="button" disabled={!earned} onClick={() => earned && celebrate(earned)} className="flex w-full flex-col items-center text-center transition-transform enabled:active:scale-95">
              <MedalBadge metal={m.metal} gem={m.gem} size={96} locked={!earned} />
              <span className={cn("mt-3 text-[15px] font-semibold", !earned && "text-muted")}>{m.title}</span>
              <span className="mt-0.5 text-[12.5px] text-faint">{m.description}</span>
              {earned ? (
                <span className="mt-1.5 text-[11.5px] font-medium" style={{ color: METAL_COLORS[m.metal].mid }}>
                  {METAL_COLORS[m.metal].name} · {shortDate(earned.earnedAt)}
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
  );
}
