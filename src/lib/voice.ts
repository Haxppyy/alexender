import { addDays } from "./date";
import { computeLife, expectancyFor } from "./life";
import type { DayLog, DayRating, Settings } from "./types";

/*
 * What Alexander says to you on Today. No AI: written lines, picked by how your day is really
 * going — what's left, the hour, how yesterday ended, how many days you called wasted. Hard when
 * you're slipping, short praise when you've earned it, never soft.
 */

export type Tone = "scold" | "warn" | "praise";
export interface Line {
  text: string;
  tone: Tone;
}

export interface VoiceInput {
  now: number;
  today: string;
  days: Record<string, DayLog>;
  ratings: DayRating[];
  settings: Settings;
  streak: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const clock = (now: number) => new Date(now).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** Everything Alexander could say right now, the most pressing first. */
export function alexanderSays({ now, today, days, ratings, settings, streak }: VoiceInput): Line[] {
  const hour = new Date(now).getHours();
  const threshold = settings.winThreshold;
  const log = days[today];
  const total = log?.total ?? 0;
  const done = log?.done ?? 0;
  const pct = log?.pct ?? 0;
  const open = total - done;
  const won = total > 0 && pct >= threshold;
  const toWin = Math.max(0, Math.ceil((threshold / 100) * total) - done);
  const yesterday = addDays(today, -1);
  const yLog = days[yesterday];
  const rated = new Map(ratings.map((r) => [r.date, r]));
  const yVerdict = rated.get(yesterday)?.verdict;
  const wasted = Array.from({ length: 7 }, (_, i) => addDays(today, -i)).filter((d) => rated.get(d)?.verdict === "wasted").length;
  const life = computeLife(settings.birthDate, expectancyFor(settings.country, settings.lifeExpectancy), now);
  const lines: Line[] = [];
  const say = (tone: Tone, text: string) => lines.push({ tone, text });

  if (total > 0 && done === total) {
    say("praise", "Every task done. This is who you are supposed to be. Now do it again tomorrow.");
    say("praise", "A perfect day. Remember how this feels — and refuse to settle for less.");
  } else if (won) {
    say("praise", `Day won. But ${plural(open, "task")} still open — a conqueror doesn't stop at "enough".`);
    say("warn", "One won day proves nothing. Ten in a row, and I'll start to believe you.");
  }

  if (total > 0 && !won && toWin > open) say("scold", "You can't win today anymore. Remember this feeling tomorrow morning — and never let it come back.");

  if (total === 0) {
    if (hour < 12) say("scold", "The day has started and your list is empty. A man without a plan has already chosen to lose.");
    else say("scold", `It's ${clock(now)} and you haven't written a single task. Is this how you spend one of your ${life.daysLeft.toLocaleString()} days left?`);
    say("scold", "Nothing planned means nothing will happen. Write the first task. Now.");
  }

  if (yVerdict === "wasted") say("scold", "You called yesterday wasted. Your words, not mine. Don't make me read them again tonight.");
  if (yLog && yLog.total > 0 && yLog.pct < threshold) {
    const left = yLog.total - yLog.done;
    say("scold", `Yesterday you left ${left} of ${yLog.total} undone. I haven't forgotten. Have you?`);
  }
  if (wasted >= 2) say("scold", `${plural(wasted, "day")} wasted this week. That's ${wasted === 1 ? "a day" : "days"} you will never get back. Not one.`);

  if (total > 0 && !won) {
    if (hour >= 18) {
      say("warn", `It's ${clock(now)}. ${plural(toWin, "more task")} to win and the light is going. Move.`);
      say("warn", `The day is almost gone and you're at ${pct}%. Every minute now counts double.`);
    } else if (done === 0) {
      say("warn", `${plural(total, "task")} waiting and not one done. Start with the hardest. Stop negotiating with yourself.`);
    } else {
      say("warn", `${done} of ${total}. Good isn't good enough. Finish what you started.`);
    }
    if (streak >= 2) say("warn", `${streak} won days in a row. Break the chain today and you start again from zero.`);
  }

  if (life.toAlexander > 0)
    say("warn", `By 32, Alexander had conquered the known world. You have ${life.toAlexander.toLocaleString()} days to match him. Today is one of them.`);
  say("warn", `About ${life.weeksLeft.toLocaleString()} weeks left in your life. This one won't come back.`);
  return lines;
}

/** Said when you mark a task as not done. */
export const BROKEN_PROMISE = [
  "Another promise to yourself, broken.",
  "Not done. Write down why — and don't let it happen twice.",
  "You decided this mattered. Then you let it go.",
];

/** Said when you rate a day. */
export const VERDICT_REPLY = {
  used: "Good. A day used is a day that's yours forever.",
  wasted: "Wasted. Say it out loud. Then make sure tomorrow is different.",
} as const;

/** Reads a line aloud in a low, steady voice, where the device can speak. */
export function speak(text: string) {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (!synth) return false;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.92;
  u.pitch = 0.7;
  const voice = synth.getVoices().find((v) => /en[-_](GB|US|IN)/i.test(v.lang) && /male|daniel|george|david|guy|ravi/i.test(v.name));
  if (voice) u.voice = voice;
  synth.speak(u);
  return true;
}
