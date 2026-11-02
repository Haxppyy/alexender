import { daysBetween } from "./date";
import type { Goal } from "./types";

/*
 * What Alexander says when he reminds you of a goal. No AI: lines built from the goal itself —
 * why you want it, how many days are left, the next step — and words Alexander was known for.
 * Encouraging, never scolding. The same line all day, a different one tomorrow.
 */

const SAYINGS = [
  "“There is nothing impossible to him who will try.” — Alexander",
  "“I am not afraid of an army of lions led by a sheep; I am afraid of an army of sheep led by a lion.” — Alexander",
  "“Upon the conduct of each depends the fate of all.” — Alexander",
  "“Through every generation of the human race there has been a constant war, a war with fear.” — Alexander",
];

const pick = <T,>(list: T[], seed: string) => list[[...seed].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 100_003, 7) % list.length];

/** Alexander's words for a goal today. */
export function goalReminder(goal: Goal, today: string) {
  const lines: string[] = [];
  const steps = goal.steps ?? [];
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  const left = goal.deadline ? daysBetween(today, goal.deadline) : null;

  const why = goal.why?.trim();
  if (why) lines.push(`Remember why you started: ${/[.!?]$/.test(why) ? why : `${why}.`} That reason is still true today.`);
  if (next) lines.push(`Your next step is “${next.text}”. Do only that today — one step is how every great march began.`);
  if (left !== null && left > 0) lines.push(`${left} ${left === 1 ? "day" : "days"} until ${goal.title}. Each one you use well brings it closer; today can be one of them.`);
  if (left !== null && left <= 0) lines.push(`The date for ${goal.title} has come. Finish strong — or set a new date and go again. Kings fall and rise.`);
  if (steps.length && done) lines.push(`${done} of ${steps.length} steps already done. You've come further than it feels. Keep marching.`);
  if (!lines.length) lines.push(`${goal.title} is waiting for you. Give it one real hour today and see how far it moves.`);

  return { text: pick(lines, `${goal.id}${today}`), saying: pick(SAYINGS, `${today}${goal.id}`) };
}
