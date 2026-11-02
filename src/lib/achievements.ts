import { addDays, fromKey } from "./date";
import type { Data } from "./store";
import type { Achievement } from "./types";

/*
 * What can be earned. Every win leaves a gem — a perfect day a sapphire, a finished plan an emerald,
 * an achieved goal a ruby, an accomplished mission a diamond — and the gems add up to medals.
 * Everything here is worked out from your own data; once earned, it's kept for good.
 */

export type GemKind = "sapphire" | "emerald" | "ruby" | "diamond";
export type Metal = "bronze" | "silver" | "gold" | "platinum";
/** 1 common · 2 rare · 3 epic · 4 legendary — how big the moment is. */
export type Rarity = 1 | 2 | 3 | 4;

export const GEMS: Record<GemKind, { name: string; for: string; rarity: Rarity }> = {
  sapphire: { name: "Sapphire", for: "a perfect day", rarity: 1 },
  emerald: { name: "Emerald", for: "a plan completed", rarity: 2 },
  ruby: { name: "Ruby", for: "a goal achieved", rarity: 3 },
  diamond: { name: "Diamond", for: "a mission accomplished", rarity: 4 },
};

export const RARITY_NAME: Record<Rarity, string> = { 1: "Common", 2: "Rare", 3: "Epic", 4: "Legendary" };
const METAL_RARITY: Record<Metal, Rarity> = { bronze: 1, silver: 2, gold: 3, platinum: 4 };

type Counts = { perfect: number; streak: number; plans: number; goals: number; missions: number };

export interface Medal {
  id: string;
  title: string;
  description: string;
  metal: Metal;
  gem: GemKind;
  need: number;
  count: (c: Counts) => number;
}

export const MEDALS: Medal[] = [
  { id: "perfect-1", title: "First Victory", description: "Your first perfect day", metal: "bronze", gem: "sapphire", need: 1, count: (c) => c.perfect },
  { id: "streak-3", title: "Unbroken", description: "3 perfect days in a row", metal: "silver", gem: "sapphire", need: 3, count: (c) => c.streak },
  { id: "perfect-7", title: "Seven Victories", description: "7 perfect days", metal: "silver", gem: "sapphire", need: 7, count: (c) => c.perfect },
  { id: "streak-7", title: "Iron Week", description: "7 perfect days in a row", metal: "gold", gem: "sapphire", need: 7, count: (c) => c.streak },
  { id: "perfect-30", title: "Month of Glory", description: "30 perfect days", metal: "gold", gem: "sapphire", need: 30, count: (c) => c.perfect },
  { id: "perfect-100", title: "Centurion", description: "100 perfect days", metal: "platinum", gem: "sapphire", need: 100, count: (c) => c.perfect },
  { id: "plans-1", title: "Strategist", description: "Your first plan completed", metal: "bronze", gem: "emerald", need: 1, count: (c) => c.plans },
  { id: "plans-5", title: "Grand Strategist", description: "5 plans completed", metal: "silver", gem: "emerald", need: 5, count: (c) => c.plans },
  { id: "plans-20", title: "Architect of Empires", description: "20 plans completed", metal: "gold", gem: "emerald", need: 20, count: (c) => c.plans },
  { id: "goals-1", title: "Goal Taker", description: "Your first goal achieved", metal: "silver", gem: "ruby", need: 1, count: (c) => c.goals },
  { id: "goals-5", title: "Conqueror", description: "5 goals achieved", metal: "gold", gem: "ruby", need: 5, count: (c) => c.goals },
  { id: "goals-20", title: "Undefeated", description: "20 goals achieved", metal: "platinum", gem: "ruby", need: 20, count: (c) => c.goals },
  { id: "missions-1", title: "Legend", description: "Your first mission accomplished", metal: "gold", gem: "diamond", need: 1, count: (c) => c.missions },
  { id: "missions-3", title: "Heir of Alexander", description: "3 missions accomplished", metal: "platinum", gem: "diamond", need: 3, count: (c) => c.missions },
];

/** What an achievement is, from its id: a gem for one win, or a medal. */
export function describe(id: string): { type: "gem"; gem: GemKind; rarity: Rarity } | { type: "medal"; medal: Medal; rarity: Rarity } | null {
  const [kind, rest] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
  const gem: GemKind | null = kind === "perfect-day" ? "sapphire" : kind === "plan" ? "emerald" : kind === "goal" ? "ruby" : kind === "mission" ? "diamond" : null;
  if (gem) return { type: "gem", gem, rarity: GEMS[gem].rarity };
  const medal = kind === "milestone" ? MEDALS.find((m) => m.id === rest) : undefined;
  return medal ? { type: "medal", medal, rarity: METAL_RARITY[medal.metal] } : null;
}

export const rarityOf = (id: string): Rarity => describe(id)?.rarity ?? 1;

/** Counts behind the medals, from what has been kept (and what's about to be). */
export function countsOf(ids: Iterable<string>): Counts {
  const c: Counts = { perfect: 0, streak: 0, plans: 0, goals: 0, missions: 0 };
  const days = new Set<string>();
  for (const id of ids) {
    if (id.startsWith("perfect-day:")) days.add(id.slice(12));
    else if (id.startsWith("plan:")) c.plans++;
    else if (id.startsWith("goal:")) c.goals++;
    else if (id.startsWith("mission:")) c.missions++;
  }
  c.perfect = days.size;
  for (const d of days) {
    if (days.has(addDays(d, -1))) continue; // count each run from its first day
    let n = 1;
    while (days.has(addDays(d, n))) n++;
    c.streak = Math.max(c.streak, n);
  }
  return c;
}

const longDate = (date: string) => fromKey(date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

type Earnable = Omit<Achievement, "createdAt" | "updatedAt">;

/** Everything earned by the data as it stands, not yet kept. */
export function newlyEarned(s: Pick<Data, "days" | "tasks" | "plans" | "goals" | "missions" | "achievements">, today: string, now = Date.now()): Earnable[] {
  const have = new Set(s.achievements.map((a) => a.id));
  const out: Earnable[] = [];
  const add = (a: Earnable) => !have.has(a.id) && out.push(a);

  for (const [date, log] of Object.entries(s.days)) {
    if (date > today || !log.total || log.pct < 100 || have.has(`perfect-day:${date}`)) continue;
    const last = Math.max(0, ...s.tasks.filter((t) => t.date === date).map((t) => t.completedAt ?? 0));
    add({ id: `perfect-day:${date}`, title: "Perfect day", detail: longDate(date), earnedAt: date === today ? now : last || fromKey(date).getTime() + 18 * 3_600_000 });
  }
  for (const p of s.plans) if (p.status === "done") add({ id: `plan:${p.id}`, title: "Plan complete", detail: p.title, earnedAt: p.updatedAt ?? now });
  for (const g of s.goals) if (g.achieved) add({ id: `goal:${g.id}`, title: "Goal achieved", detail: g.title, earnedAt: g.achievedAt ?? now });
  for (const m of s.missions) if (m.accomplished) add({ id: `mission:${m.id}`, title: "Mission accomplished", detail: m.text, earnedAt: m.accomplishedAt ?? now });

  const counts = countsOf([...have, ...out.map((a) => a.id)]);
  for (const m of MEDALS) if (m.count(counts) >= m.need) add({ id: `milestone:${m.id}`, title: m.title, detail: m.description, earnedAt: now });
  return out;
}
