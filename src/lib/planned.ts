import type { Data } from "./store";
import type { PlanStep } from "./types";

/*
 * Every step with a date that has come — today's, and late ones — gathered from all the places
 * you plan: Planning, Goals, Missions and Skills. The soonest first, so the first is what's next.
 */

export type StepOwner = "plans" | "goals" | "missions" | "skills";

export interface PlannedItem {
  key: string;
  kind: StepOwner;
  ownerId: string;
  /** Where it comes from, e.g. "Planning · Trip to Japan". */
  from: string;
  step: PlanStep;
  href: string;
}

const SECTION: Record<StepOwner, { label: string; href: string }> = {
  plans: { label: "Planning", href: "/plans" },
  goals: { label: "Goal", href: "/goals" },
  missions: { label: "Mission", href: "/mission" },
  skills: { label: "Skill", href: "/skills" },
};

export function plannedFor(data: Pick<Data, "plans" | "goals" | "missions" | "skills">, today: string): PlannedItem[] {
  const owners: { kind: StepOwner; id: string; title: string; steps?: PlanStep[] }[] = [
    ...data.plans.filter((p) => p.status !== "done").map((p) => ({ kind: "plans" as const, id: p.id, title: p.title, steps: p.steps })),
    ...data.goals.filter((g) => !g.achieved).map((g) => ({ kind: "goals" as const, id: g.id, title: g.title, steps: g.steps })),
    ...data.missions.map((m) => ({ kind: "missions" as const, id: m.id, title: m.text, steps: m.steps })),
    ...data.skills.map((k) => ({ kind: "skills" as const, id: k.id, title: k.title, steps: k.steps })),
  ];
  return owners
    .flatMap((o) =>
      (o.steps ?? [])
        .filter((s) => !s.done && s.due && s.due <= today)
        .map((step) => ({ key: `${o.kind}:${o.id}:${step.id}`, kind: o.kind, ownerId: o.id, from: `${SECTION[o.kind].label} · ${o.title}`, step, href: SECTION[o.kind].href })),
    )
    .sort((a, b) => a.step.due!.localeCompare(b.step.due!));
}
