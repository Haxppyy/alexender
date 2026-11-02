import type { Data, Kind } from "./store";
import type { DayLog, Task } from "./types";

/*
 * Merges two copies of the data (this device and the server) record by record, so edits made on
 * different devices are all kept. For each record the newest edit wins; a deletion wins over any
 * edit made before it. Pure and deterministic — the same inputs always give the same output.
 */

type Rec = { id: string; createdAt: number; updatedAt?: number };

const TOMBSTONE_TTL = 120 * 86_400_000; // forget deletions after ~4 months

const edited = (r: { createdAt?: number; updatedAt?: number }) => r.updatedAt ?? r.createdAt ?? 0;

function mergeRecords<T extends Rec>(kind: Kind, a: T[], b: T[], deleted: Record<string, number>): T[] {
  const byId = new Map<string, T>();
  for (const r of [...a, ...b]) {
    const prev = byId.get(r.id);
    if (!prev || edited(r) > edited(prev)) byId.set(r.id, r);
  }
  return [...byId.values()]
    .filter((r) => !(deleted[`${kind}:${r.id}`] >= edited(r)))
    .sort((x, y) => x.createdAt - y.createdAt || x.id.localeCompare(y.id));
}

function mergeDeleted(a: Record<string, number>, b: Record<string, number>, now: number) {
  const out: Record<string, number> = {};
  for (const [key, at] of [...Object.entries(a), ...Object.entries(b)]) {
    if (now - at > TOMBSTONE_TTL) continue;
    out[key] = Math.max(out[key] ?? 0, at);
  }
  return sortKeys(out);
}

/** Day scores are derived from tasks, so they are recomputed; "first opened" keeps the earliest. */
function mergeDays(a: Record<string, DayLog>, b: Record<string, DayLog>, tasks: Task[]) {
  const dates = new Set([...Object.keys(a), ...Object.keys(b), ...tasks.map((t) => t.date)]);
  const out: Record<string, DayLog> = {};
  for (const date of [...dates].sort()) {
    const dayTasks = tasks.filter((t) => t.date === date);
    const done = dayTasks.filter((t) => t.done).length;
    const seen = [a[date]?.firstSeen, b[date]?.firstSeen].filter((n): n is number => !!n);
    const log: DayLog = { date, total: dayTasks.length, done, pct: dayTasks.length ? Math.round((done / dayTasks.length) * 100) : 0 };
    if (seen.length) log.firstSeen = Math.min(...seen);
    out[date] = log;
  }
  return out;
}

export function mergeData(local: Data, remote: Data, now = Date.now()): Data {
  const deleted = mergeDeleted(local.deleted, remote.deleted, now);
  const tasks = mergeRecords("tasks", local.tasks, remote.tasks, deleted);

  // Entries are keyed by id (by date for ones written before a day could hold several).
  const journal: Data["journal"] = {};
  for (const key of [...new Set([...Object.keys(local.journal), ...Object.keys(remote.journal)])].sort()) {
    const l = local.journal[key];
    const r = remote.journal[key];
    const pick = !l ? r : !r ? l : r.updatedAt > l.updatedAt ? r : l;
    if (pick && !(deleted[`journal:${key}`] >= pick.updatedAt)) journal[key] = pick;
  }

  return {
    tasks,
    days: mergeDays(local.days, remote.days, tasks),
    missions: mergeRecords("missions", local.missions, remote.missions, deleted),
    goals: mergeRecords("goals", local.goals, remote.goals, deleted),
    videos: mergeRecords("videos", local.videos, remote.videos, deleted),
    books: mergeRecords("books", local.books, remote.books, deleted),
    bucket: mergeRecords("bucket", local.bucket ?? [], remote.bucket ?? [], deleted),
    donts: mergeRecords("donts", local.donts ?? [], remote.donts ?? [], deleted),
    podcasts: mergeRecords("podcasts", local.podcasts ?? [], remote.podcasts ?? [], deleted),
    plans: mergeRecords("plans", local.plans ?? [], remote.plans ?? [], deleted),
    ideas: mergeRecords("ideas", local.ideas ?? [], remote.ideas ?? [], deleted),
    habits: mergeRecords("habits", local.habits ?? [], remote.habits ?? [], deleted),
    habitChecks: mergeRecords("habitChecks", local.habitChecks ?? [], remote.habitChecks ?? [], deleted),
    timerTasks: mergeRecords("timerTasks", local.timerTasks ?? [], remote.timerTasks ?? [], deleted),
    timerSessions: mergeRecords("timerSessions", local.timerSessions ?? [], remote.timerSessions ?? [], deleted),
    exercises: mergeRecords("exercises", local.exercises ?? [], remote.exercises ?? [], deleted),
    workoutLogs: mergeRecords("workoutLogs", local.workoutLogs ?? [], remote.workoutLogs ?? [], deleted),
    skills: mergeRecords("skills", local.skills ?? [], remote.skills ?? [], deleted),
    learnings: mergeRecords("learnings", local.learnings ?? [], remote.learnings ?? [], deleted),
    questions: mergeRecords("questions", local.questions ?? [], remote.questions ?? [], deleted),
    playlists: mergeRecords("playlists", local.playlists ?? [], remote.playlists ?? [], deleted),
    myStories: mergeRecords("myStories", local.myStories ?? [], remote.myStories ?? [], deleted),
    storiesRead: mergeRecords("storiesRead", local.storiesRead ?? [], remote.storiesRead ?? [], deleted),
    journal,
    dayMarks: mergeRecords("dayMarks", local.dayMarks ?? [], remote.dayMarks ?? [], deleted),
    savings: mergeRecords("savings", local.savings ?? [], remote.savings ?? [], deleted),
    deposits: mergeRecords("deposits", local.deposits ?? [], remote.deposits ?? [], deleted),
    clips: mergeRecords("clips", local.clips ?? [], remote.clips ?? [], deleted),
    settings: pickSettings(local.settings, remote.settings),
    deleted,
  };
}

/**
 * Newest settings win. Settings saved before sync existed have no edit time; then a set-up profile
 * always beats a blank one, so a brand-new device can never wipe your name or passcode.
 */
function pickSettings(a: Data["settings"], b: Data["settings"]) {
  const at = a.updatedAt ?? 0;
  const bt = b.updatedAt ?? 0;
  if (at !== bt) return bt > at ? b : a;
  if (!!a.name !== !!b.name) return a.name ? a : b;
  return stableStringify(a) >= stableStringify(b) ? a : b; // any stable choice keeps merges symmetric
}

function sortKeys<T>(obj: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(obj).sort(([x], [y]) => x.localeCompare(y)));
}

/** JSON with object keys sorted, so two equal datasets always serialise identically. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => x.localeCompare(y))) : v,
  );
}
