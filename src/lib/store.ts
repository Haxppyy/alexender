"use client";

import { del, get, set } from "idb-keyval";
import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import { todayKey } from "./date";
import { deleteImages, deleteImagesLater, keepImages } from "./images";
import type { Achievement, Book, BucketItem, Clip, DayLog, DayMark, Deposit, Exercise, Goal, Habit, HabitCheck, Idea, Playlist, Question, Learning, Skill, WorkoutLog, WorkoutUnit, JournalCategory, JournalEntry, ListItem, Mission, MyStory, Plan, Priority, SavingsGoal, Settings, StoryRead, Task, TimerSession, TimerTask, Video } from "./types";
import { pct, uid } from "./utils";

/*
 * Saves to IndexedDB in batches: a burst of edits (typing a note) becomes one write a moment
 * after the last keystroke, instead of re-saving everything on every key. Anything pending is
 * written at once when the app is hidden or closed.
 */
let pendingSave: { name: string; value: StorageValue<Data> } | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function flushSave() {
  clearTimeout(saveTimer);
  if (!pendingSave) return;
  const { name, value } = pendingSave;
  pendingSave = null;
  set(name, JSON.stringify(value)).catch(() => {});
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushSave);
  document.addEventListener("visibilitychange", () => document.hidden && flushSave());
}

const idbStorage: PersistStorage<Data> = {
  getItem: async (name) => {
    const raw = await get<string | StorageValue<Data>>(name);
    return raw == null ? null : typeof raw === "string" ? JSON.parse(raw) : raw;
  },
  setItem: (name, value) => {
    pendingSave = { name: name, value };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 400);
  },
  removeItem: async (name) => {
    pendingSave = null;
    clearTimeout(saveTimer);
    await del(name);
  },
};

/** Collections whose records sync individually. Tombstone keys are `${kind}:${id}`. */
export type Kind = "tasks" | "missions" | "goals" | "videos" | "books" | "bucket" | "donts" | "podcasts" | "plans" | "ideas" | "habits" | "habitChecks" | "timerTasks" | "timerSessions" | "exercises" | "workoutLogs" | "skills" | "learnings" | "questions" | "playlists" | "myStories" | "storiesRead" | "journal" | "dayMarks" | "achievements" | "savings" | "deposits" | "clips";

/** Collections that can be reordered by dragging. */
export type OrderedKind = "tasks" | "missions" | "goals" | "videos" | "books" | "bucket" | "donts" | "podcasts" | "plans" | "ideas" | "habits" | "timerTasks" | "exercises" | "skills" | "learnings" | "questions" | "playlists" | "savings" | "clips";

/** The simple lists that share one shape (ListItem). */
export type ListKind = "donts" | "podcasts";

export interface Data {
  tasks: Task[];
  days: Record<string, DayLog>;
  missions: Mission[];
  goals: Goal[];
  videos: Video[];
  books: Book[];
  bucket: BucketItem[];
  donts: ListItem[];
  podcasts: ListItem[];
  plans: Plan[];
  ideas: Idea[];
  habits: Habit[];
  habitChecks: HabitCheck[];
  timerTasks: TimerTask[];
  timerSessions: TimerSession[];
  exercises: Exercise[];
  workoutLogs: WorkoutLog[];
  skills: Skill[];
  learnings: Learning[];
  questions: Question[];
  playlists: Playlist[];
  myStories: MyStory[];
  storiesRead: StoryRead[];
  /** Keyed by entry id (by date for entries written before a day could hold several). */
  journal: Record<string, JournalEntry>;
  dayMarks: DayMark[];
  achievements: Achievement[];
  savings: SavingsGoal[];
  deposits: Deposit[];
  clips: Clip[];
  settings: Settings;
  /** When each record was deleted, so a delete on one device removes it everywhere. */
  deleted: Record<string, number>;
}

export const DATA_KEYS = ["tasks", "days", "missions", "goals", "videos", "books", "bucket", "donts", "podcasts", "plans", "ideas", "habits", "habitChecks", "timerTasks", "timerSessions", "exercises", "workoutLogs", "skills", "learnings", "questions", "playlists", "myStories", "storiesRead", "journal", "dayMarks", "achievements", "savings", "deposits", "clips", "settings", "deleted"] as const;

const defaultSettings: Settings = {
  name: "",
  winThreshold: 70,
  birthDate: "2003-06-10",
  country: "India",
};

const initialData: Data = {
  tasks: [],
  days: {},
  missions: [],
  goals: [],
  videos: [],
  books: [],
  bucket: [],
  donts: [],
  podcasts: [],
  plans: [],
  ideas: [],
  habits: [],
  habitChecks: [],
  timerTasks: [],
  timerSessions: [],
  exercises: [],
  workoutLogs: [],
  skills: [],
  learnings: [],
  questions: [],
  playlists: [],
  myStories: [],
  storiesRead: [],
  journal: {},
  dayMarks: [],
  achievements: [],
  savings: [],
  deposits: [],
  clips: [],
  settings: defaultSettings,
  deleted: {},
};

interface Actions {
  addTask: (t: { title: string; date: string; priority?: Priority }) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  /** Mark a task as not done (or take that back). */
  toggleNotDone: (id: string) => void;
  deleteTask: (id: string) => void;
  /** Copy a day's unfinished tasks to another day. The originals stay, marked not done. */
  carryOver: (from: string, to: string) => number;
  carryTask: (id: string, to: string) => void;
  markDayStart: (date: string) => void;

  /** Adds a mission; there can be at most MAX_MISSIONS. Returns its id, or null when full. */
  addMission: (text: string, extra?: { description?: string; iconId?: string }) => string | null;
  updateMission: (id: string, patch: Partial<Mission>) => void;
  deleteMission: (id: string) => void;

  addGoal: (g: { title: string; why?: string; deadline?: string }) => string;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;

  addVideo: (v: { url: string; youtubeId: string; title: string }) => string;
  updateVideo: (id: string, patch: Partial<Video>) => void;
  completeVideo: (id: string) => void;
  reopenVideo: (id: string) => void;
  deleteVideo: (id: string) => void;

  addBook: (b: { title: string; author: string; totalPages?: number }) => string;
  updateBook: (id: string, patch: Partial<Book>) => void;
  completeBook: (id: string, action?: string) => void;
  reopenBook: (id: string) => void;
  deleteBook: (id: string) => void;

  addBucket: (title: string) => string;
  updateBucket: (id: string, patch: Partial<BucketItem>) => void;
  toggleBucket: (id: string) => void;
  deleteBucket: (id: string) => void;

  addItem: (kind: ListKind, fields: { title: string; url?: string; note?: string }) => string;
  updateItem: (kind: ListKind, id: string, patch: Partial<ListItem>) => void;
  toggleItem: (kind: ListKind, id: string) => void;
  deleteItem: (kind: ListKind, id: string) => void;

  addPlan: (title: string) => string;
  updatePlan: (id: string, patch: Partial<Plan>) => void;
  deletePlan: (id: string) => void;

  addMyStory: (story: Omit<MyStory, "id" | "createdAt" | "updatedAt">) => string;
  updateMyStory: (id: string, patch: Partial<MyStory>) => void;
  deleteMyStory: (id: string) => void;
  addIdea: (title: string) => string;
  updateIdea: (id: string, patch: Partial<Idea>) => void;
  deleteIdea: (id: string) => void;

  /** Remember that a story has been read. */
  markStoryRead: (id: string) => void;

  addHabit: (title: string) => void;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  /** Done or not done on a day. */
  toggleHabit: (habitId: string, date: string) => void;

  /** Returns the task's id (an existing one when the name matches). */
  addTimerTask: (title: string) => string;
  deleteTimerTask: (id: string) => void;
  /** Start timing a task until `endsAt`; any running timer stops first. */
  startTimer: (taskId: string, endsAt: number, open?: boolean) => void;
  /** End a session now (or at its planned end, if that has passed). */
  stopTimer: (id: string) => void;
  /** Give a running countdown more time. */
  extendTimer: (id: string, ms: number) => void;
  deleteSession: (id: string) => void;

  addExercise: (e: { title: string; target: number; unit: WorkoutUnit }) => string;
  updateExercise: (id: string, patch: Partial<Exercise>) => void;
  deleteExercise: (id: string) => void;
  /** Add a burst to today's total. Returns the log's id (for undo). */
  logWorkout: (exerciseId: string, amount: number) => string;
  deleteWorkoutLog: (id: string) => void;

  addSkill: (title: string) => string;
  updateSkill: (id: string, patch: Partial<Skill>) => void;
  deleteSkill: (id: string) => void;
  addLearning: (skillId: string | undefined, text: string, source?: string) => void;
  deleteLearning: (id: string) => void;

  addPlaylist: (p: { url: string; listId: string; title: string }) => string;
  updatePlaylist: (id: string, patch: Partial<Playlist>) => void;
  /** Finished, or back on the list. */
  togglePlaylist: (id: string) => void;
  deletePlaylist: (id: string) => void;

  addQuestion: (text: string, topic?: string) => string;
  updateQuestion: (id: string, patch: Partial<Question>) => void;
  deleteQuestion: (id: string) => void;

  /** Save a new manual order: `ids` in their new sequence. */
  reorder: (kind: OrderedKind, ids: string[]) => void;
  /** Put a just-deleted record back (undo). */
  restore: (kind: OrderedKind, record: { id: string }) => void;

  /** A new, empty entry on a day. Returns its key. */
  addJournal: (date: string, category: JournalCategory) => string;
  /** Change an entry's text or category. */
  updateJournal: (key: string, patch: { text?: string; category?: JournalCategory }) => void;
  deleteJournal: (key: string) => void;

  /** Keep newly earned achievements (ones already kept are left as they are). */
  earn: (list: Omit<Achievement, "createdAt" | "updatedAt">[]) => void;
  /** Collect rewards that were waiting. */
  claim: (ids: string[]) => void;

  /** Mark a day used or wasted; no mark clears it. */
  markDay: (date: string, mark?: "used" | "wasted") => void;

  addSavingsGoal: (g: { title: string; target: number; deadline?: string }) => string;
  updateSavingsGoal: (id: string, patch: Partial<SavingsGoal>) => void;
  deleteSavingsGoal: (id: string) => void;
  /** Money in (positive) or out (negative). Returns the deposit's id (for undo). */
  addDeposit: (goalId: string, amount: number, note?: string) => string;
  deleteDeposit: (id: string) => void;

  addClip: (c: Omit<Clip, "id" | "createdAt" | "updatedAt" | "order">) => string;
  updateClip: (id: string, patch: Partial<Clip>) => void;
  deleteClip: (id: string) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  /** Replace everything (import, erase). */
  replaceAll: (data: Partial<Data>) => void;
  /** Apply data merged from another device. Records keep their own timestamps. */
  applySynced: (data: Data) => void;
}

export type Store = Data & Actions;

/** Recompute and store the completion score for a day — this is the persisted daily record. */
export function withScore(days: Record<string, DayLog>, tasks: Task[], date: string): Record<string, DayLog> {
  const dayTasks = tasks.filter((t) => t.date === date);
  const done = dayTasks.filter((t) => t.done).length;
  const prev = days[date] ?? { date, total: 0, done: 0, pct: 0 };
  return { ...days, [date]: { ...prev, total: dayTasks.length, done, pct: pct(done, dayTasks.length) } };
}

const tombstone = (deleted: Record<string, number>, kind: Kind, id: string) => ({ ...deleted, [`${kind}:${id}`]: Date.now() });

/** Patch one record by id and stamp it as just edited. */
function patchById<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  const now = Date.now();
  return list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now } : x));
}

/** Fills defaults and upgrades data saved by older versions. */
export function normalize(p: Partial<Data>): Data {
  const { mission, ...settings } = { ...defaultSettings, ...p.settings };
  const missions = p.missions ?? (mission?.trim() ? [{ id: uid(), text: mission.trim(), images: [], createdAt: Date.now() }] : []);
  return {
    tasks: p.tasks ?? [],
    days: p.days ?? {},
    missions,
    goals: p.goals ?? [],
    videos: p.videos ?? [],
    books: p.books ?? [],
    bucket: p.bucket ?? [],
    donts: p.donts ?? [],
    podcasts: p.podcasts ?? [],
    plans: p.plans ?? [],
    ideas: p.ideas ?? [],
    habits: p.habits ?? [],
    habitChecks: p.habitChecks ?? [],
    timerTasks: p.timerTasks ?? [],
    timerSessions: p.timerSessions ?? [],
    exercises: p.exercises ?? [],
    workoutLogs: p.workoutLogs ?? [],
    skills: p.skills ?? [],
    learnings: p.learnings ?? [],
    questions: p.questions ?? [],
    playlists: p.playlists ?? [],
    myStories: p.myStories ?? [],
    storiesRead: p.storiesRead ?? [],
    journal: p.journal ?? {},
    dayMarks: p.dayMarks ?? [],
    achievements: p.achievements ?? [],
    savings: p.savings ?? [],
    deposits: p.deposits ?? [],
    clips: p.clips ?? [],
    settings,
    deleted: p.deleted ?? {},
  };
}

/** Focus: no more than three missions at once. */
export const MAX_MISSIONS = 3;

const nextOrder = (list: { order: number }[]) => list.reduce((m, x) => Math.max(m, x.order), 0) + 1;

export const useStore = create<Store>()(
  persist(
    (setState, getState) => ({
      ...initialData,

      addTask: ({ title, date, priority = "med" }) =>
        setState((s) => {
          const now = Date.now();
          const order = nextOrder(s.tasks.filter((t) => t.date === date).map((t) => ({ order: t.order ?? 0 })));
          const tasks = [...s.tasks, { id: uid(), title, date, priority, done: false, createdAt: now, updatedAt: now, order }];
          return { tasks, days: withScore(s.days, tasks, date) };
        }),

      updateTask: (id, patch) =>
        setState((s) => {
          const old = s.tasks.find((t) => t.id === id);
          if (!old) return s;
          const tasks = patchById(s.tasks, id, patch);
          let days = withScore(s.days, tasks, old.date);
          if (patch.date && patch.date !== old.date) days = withScore(days, tasks, patch.date);
          return { tasks, days };
        }),

      toggleTask: (id) =>
        setState((s) => {
          const task = s.tasks.find((t) => t.id === id);
          if (!task) return s;
          const now = Date.now();
          const patch: Partial<Task> = task.done ? { done: false, completedAt: undefined } : { done: true, completedAt: now, failed: undefined };
          const tasks = patchById(s.tasks, id, patch);
          return { tasks, days: withScore(s.days, tasks, task.date) };
        }),

      deleteTask: (id) =>
        setState((s) => {
          const task = s.tasks.find((t) => t.id === id);
          if (!task) return s;
          const tasks = s.tasks.filter((t) => t.id !== id);
          return { tasks, days: withScore(s.days, tasks, task.date), deleted: tombstone(s.deleted, "tasks", id) };
        }),

      toggleNotDone: (id) =>
        setState((s) => {
          const task = s.tasks.find((t) => t.id === id);
          if (!task) return s;
          const tasks = patchById(s.tasks, id, task.failed ? { failed: undefined } : { failed: true, done: false, completedAt: undefined });
          return { tasks, days: withScore(s.days, tasks, task.date) };
        }),

      // A day's record never changes after the fact: an unfinished task stays not done on its day,
      // and a fresh copy starts on the new day.
      carryOver: (from, to) => {
        const pending = getState().tasks.filter((t) => t.date === from && !t.done && !t.carriedTo);
        pending.forEach((t) => getState().carryTask(t.id, to));
        return pending.length;
      },
      carryTask: (id, to) =>
        setState((s) => {
          const task = s.tasks.find((t) => t.id === id);
          if (!task || task.done || task.carriedTo) return s;
          const now = Date.now();
          const order = nextOrder(s.tasks.filter((t) => t.date === to).map((t) => ({ order: t.order ?? 0 })));
          const copy: Task = { id: uid(), title: task.title, date: to, priority: task.priority, done: false, createdAt: now, updatedAt: now, order, ...(task.note && { note: task.note }) };
          const tasks = [...s.tasks.map((t) => (t.id === id ? { ...t, carriedTo: to, updatedAt: now } : t)), copy];
          return { tasks, days: withScore(s.days, tasks, to) };
        }),

      markDayStart: (date) =>
        setState((s) =>
          s.days[date]?.firstSeen
            ? s
            : { days: { ...s.days, [date]: { ...(s.days[date] ?? { date, total: 0, done: 0, pct: 0 }), firstSeen: Date.now() } } },
        ),

      addMission: (text, extra) => {
        if (getState().missions.length >= MAX_MISSIONS) return null;
        const id = uid();
        const now = Date.now();
        setState((s) => ({
          missions: [
            ...s.missions,
            { id, text, ...extra, images: [], steps: [], createdAt: now, updatedAt: now, order: nextOrder(s.missions.map((m) => ({ order: m.order ?? 0 }))) },
          ],
        }));
        return id;
      },
      updateMission: (id, patch) => setState((s) => ({ missions: patchById(s.missions, id, patch) })),
      deleteMission: (id) => {
        const mission = getState().missions.find((m) => m.id === id);
        if (mission) deleteImages([...mission.images, ...(mission.iconId ? [mission.iconId] : [])]);
        setState((s) => ({ missions: s.missions.filter((m) => m.id !== id), deleted: tombstone(s.deleted, "missions", id) }));
      },

      addGoal: ({ title, why = "", deadline }) => {
        const id = uid();
        const now = Date.now();
        setState((s) => ({
          goals: [
            ...s.goals,
            { id, title, why, deadline, images: [], achieved: false, createdAt: now, updatedAt: now, order: nextOrder(s.goals.map((g) => ({ order: g.order ?? 0 }))) },
          ],
        }));
        return id;
      },
      updateGoal: (id, patch) => setState((s) => ({ goals: patchById(s.goals, id, patch) })),
      deleteGoal: (id) => {
        const goal = getState().goals.find((g) => g.id === id);
        if (goal) deleteImages([...goal.images, ...(goal.iconId ? [goal.iconId] : [])]);
        setState((s) => ({ goals: s.goals.filter((g) => g.id !== id), deleted: tombstone(s.deleted, "goals", id) }));
      },

      addVideo: (v) => {
        const id = uid();
        const now = Date.now();
        setState((s) => ({ videos: [...s.videos, { ...v, id, done: false, createdAt: now, updatedAt: now, order: nextOrder(s.videos) }] }));
        return id;
      },
      updateVideo: (id, patch) => setState((s) => ({ videos: patchById(s.videos, id, patch) })),
      completeVideo: (id) => setState((s) => ({ videos: patchById(s.videos, id, { done: true, completedAt: Date.now() }) })),
      reopenVideo: (id) =>
        setState((s) => ({ videos: patchById(s.videos, id, { done: false, completedAt: undefined, order: nextOrder(s.videos) }) })),
      deleteVideo: (id) => setState((s) => ({ videos: s.videos.filter((v) => v.id !== id), deleted: tombstone(s.deleted, "videos", id) })),

      addBook: (b) => {
        const id = uid();
        const now = Date.now();
        setState((s) => ({ books: [...s.books, { ...b, id, done: false, createdAt: now, updatedAt: now, order: nextOrder(s.books) }] }));
        return id;
      },
      updateBook: (id, patch) => setState((s) => ({ books: patchById(s.books, id, patch) })),
      completeBook: (id, action) =>
        setState((s) => {
          const book = s.books.find((b) => b.id === id);
          return {
            books: patchById(s.books, id, {
              done: true,
              reading: false,
              completedAt: Date.now(),
              currentPage: book?.totalPages ?? book?.currentPage,
              ...(action?.trim() && { action: action.trim() }),
            }),
          };
        }),
      reopenBook: (id) =>
        setState((s) => ({ books: patchById(s.books, id, { done: false, completedAt: undefined, order: nextOrder(s.books) }) })),
      deleteBook: (id) => {
        const book = getState().books.find((b) => b.id === id);
        if (book?.coverId) deleteImages([book.coverId]);
        setState((s) => ({ books: s.books.filter((b) => b.id !== id), deleted: tombstone(s.deleted, "books", id) }));
      },

      addBucket: (title) => {
        const id = uid();
        const now = Date.now();
        setState((s) => ({ bucket: [...s.bucket, { id, title, done: false, createdAt: now, updatedAt: now, order: nextOrder(s.bucket) }] }));
        return id;
      },
      updateBucket: (id, patch) => setState((s) => ({ bucket: patchById(s.bucket, id, patch) })),
      toggleBucket: (id) =>
        setState((s) => {
          const item = s.bucket.find((b) => b.id === id);
          return item ? { bucket: patchById(s.bucket, id, { done: !item.done, doneAt: item.done ? undefined : Date.now() }) } : s;
        }),
      deleteBucket: (id) => {
        const item = getState().bucket.find((b) => b.id === id);
        if (item?.imageId) deleteImagesLater([item.imageId]); // Undo can still bring it back
        setState((s) => ({ bucket: s.bucket.filter((b) => b.id !== id), deleted: tombstone(s.deleted, "bucket", id) }));
      },

      addItem: (kind, { title, url, note }) => {
        const id = uid();
        const now = Date.now();
        setState((s) => ({
          [kind]: [...s[kind], { id, title, ...(url && { url }), ...(note && { note }), done: false, createdAt: now, updatedAt: now, order: nextOrder(s[kind]) }],
        }));
        return id;
      },
      updateItem: (kind, id, patch) => setState((s) => ({ [kind]: patchById(s[kind], id, patch) })),
      toggleItem: (kind, id) =>
        setState((s) => {
          const item = s[kind].find((x) => x.id === id);
          return item ? { [kind]: patchById(s[kind], id, { done: !item.done, doneAt: item.done ? undefined : Date.now() }) } : s;
        }),
      deleteItem: (kind, id) => setState((s) => ({ [kind]: s[kind].filter((x) => x.id !== id), deleted: tombstone(s.deleted, kind, id) })),

      addPlan: (title) => {
        const id = uid();
        const now = Date.now();
        setState((s) => ({ plans: [...s.plans, { id, title, steps: [], createdAt: now, updatedAt: now, order: nextOrder(s.plans) }] }));
        return id;
      },
      updatePlan: (id, patch) => setState((s) => ({ plans: patchById(s.plans, id, patch) })),
      deletePlan: (id) => setState((s) => ({ plans: s.plans.filter((p) => p.id !== id), deleted: tombstone(s.deleted, "plans", id) })),

      addMyStory: (story) => {
        const id = uid();
        const now = Date.now();
        setState((s) => ({ myStories: [...s.myStories, { ...story, id, createdAt: now, updatedAt: now }] }));
        return id;
      },
      updateMyStory: (id, patch) => setState((s) => ({ myStories: patchById(s.myStories, id, patch) })),
      addIdea: (title) => {
        const id = uid();
        const now = Date.now();
        setState((s) => ({ ideas: [...s.ideas, { id, title, status: "new", createdAt: now, updatedAt: now }] }));
        return id;
      },
      updateIdea: (id, patch) => setState((s) => ({ ideas: patchById(s.ideas, id, patch) })),
      deleteIdea: (id) => setState((s) => ({ ideas: s.ideas.filter((x) => x.id !== id), deleted: tombstone(s.deleted, "ideas", id) })),

      addHabit: (title) => {
        const now = Date.now();
        setState((s) => ({ habits: [...s.habits, { id: uid(), title, createdAt: now, updatedAt: now, order: nextOrder(s.habits.map((h) => ({ order: h.order ?? 0 }))) }] }));
      },
      updateHabit: (id, patch) => setState((s) => ({ habits: patchById(s.habits, id, patch) })),
      deleteHabit: (id) =>
        setState((s) => {
          let deleted = tombstone(s.deleted, "habits", id);
          for (const c of s.habitChecks) if (c.habitId === id) deleted = tombstone(deleted, "habitChecks", c.id);
          return { habits: s.habits.filter((h) => h.id !== id), habitChecks: s.habitChecks.filter((c) => c.habitId !== id), deleted };
        }),
      toggleHabit: (habitId, date) =>
        setState((s) => {
          const id = `${habitId}:${date}`;
          if (s.habitChecks.some((c) => c.id === id)) {
            return { habitChecks: s.habitChecks.filter((c) => c.id !== id), deleted: tombstone(s.deleted, "habitChecks", id) };
          }
          const now = Date.now();
          const deleted = { ...s.deleted };
          delete deleted[`habitChecks:${id}`];
          return { habitChecks: [...s.habitChecks, { id, habitId, date, createdAt: now, updatedAt: now }], deleted };
        }),

      addTimerTask: (title) => {
        const existing = getState().timerTasks.find((t) => t.title.toLowerCase() === title.toLowerCase());
        if (existing) return existing.id;
        const id = uid();
        const now = Date.now();
        setState((s) => ({ timerTasks: [...s.timerTasks, { id, title, createdAt: now, updatedAt: now, order: nextOrder(s.timerTasks.map((t) => ({ order: t.order ?? 0 }))) }] }));
        return id;
      },
      deleteTimerTask: (id) => setState((s) => ({ timerTasks: s.timerTasks.filter((t) => t.id !== id), deleted: tombstone(s.deleted, "timerTasks", id) })),
      startTimer: (taskId, endsAt, open) =>
        setState((s) => {
          const task = s.timerTasks.find((t) => t.id === taskId);
          if (!task) return s;
          const now = Date.now();
          const sessions = s.timerSessions.map((x) => (x.endedAt ? x : { ...x, endedAt: Math.min(now, x.endsAt), updatedAt: now }));
          return {
            timerSessions: [...sessions, { id: uid(), taskId, title: task.title, date: todayKey(), startedAt: now, endsAt, createdAt: now, updatedAt: now, ...(open && { open: true }) }],
          };
        }),
      stopTimer: (id) =>
        setState((s) => {
          const now = Date.now();
          return { timerSessions: s.timerSessions.map((x) => (x.id === id && !x.endedAt ? { ...x, endedAt: Math.min(now, x.endsAt), updatedAt: now } : x)) };
        }),
      extendTimer: (id, ms) =>
        setState((s) => ({ timerSessions: s.timerSessions.map((x) => (x.id === id && !x.endedAt ? { ...x, endsAt: Math.max(x.endsAt, Date.now()) + ms, updatedAt: Date.now() } : x)) })),
      addExercise: ({ title, target, unit }) => {
        const id = uid();
        const now = Date.now();
        setState((s) => ({ exercises: [...s.exercises, { id, title, target, unit, createdAt: now, updatedAt: now, order: nextOrder(s.exercises.map((e) => ({ order: e.order ?? 0 }))) }] }));
        return id;
      },
      updateExercise: (id, patch) => setState((s) => ({ exercises: patchById(s.exercises, id, patch) })),
      deleteExercise: (id) =>
        setState((s) => {
          let deleted = tombstone(s.deleted, "exercises", id);
          for (const l of s.workoutLogs) if (l.exerciseId === id) deleted = tombstone(deleted, "workoutLogs", l.id);
          return { exercises: s.exercises.filter((e) => e.id !== id), workoutLogs: s.workoutLogs.filter((l) => l.exerciseId !== id), deleted };
        }),
      logWorkout: (exerciseId, amount) => {
        const id = uid();
        const now = Date.now();
        setState((s) => ({ workoutLogs: [...s.workoutLogs, { id, exerciseId, amount, date: todayKey(), createdAt: now, updatedAt: now }] }));
        return id;
      },
      deleteWorkoutLog: (id) => setState((s) => ({ workoutLogs: s.workoutLogs.filter((l) => l.id !== id), deleted: tombstone(s.deleted, "workoutLogs", id) })),

      addSkill: (title) => {
        const id = uid();
        const now = Date.now();
        setState((s) => ({ skills: [...s.skills, { id, title, steps: [], createdAt: now, updatedAt: now, order: nextOrder(s.skills.map((k) => ({ order: k.order ?? 0 }))) }] }));
        return id;
      },
      updateSkill: (id, patch) => setState((s) => ({ skills: patchById(s.skills, id, patch) })),
      deleteSkill: (id) =>
        setState((s) => {
          let deleted = tombstone(s.deleted, "skills", id);
          for (const l of s.learnings) if (l.skillId === id) deleted = tombstone(deleted, "learnings", l.id);
          return { skills: s.skills.filter((k) => k.id !== id), learnings: s.learnings.filter((l) => l.skillId !== id), deleted };
        }),
      addLearning: (skillId, text, source) => {
        const now = Date.now();
        setState((s) => ({
          learnings: [...s.learnings, { id: uid(), text, date: todayKey(), createdAt: now, updatedAt: now, ...(skillId && { skillId }), ...(source?.trim() && { source: source.trim() }) }],
        }));
      },
      addPlaylist: (p) => {
        const id = uid();
        const now = Date.now();
        setState((s) => ({ playlists: [...s.playlists, { ...p, id, done: false, createdAt: now, updatedAt: now, order: nextOrder(s.playlists) }] }));
        return id;
      },
      updatePlaylist: (id, patch) => setState((s) => ({ playlists: patchById(s.playlists, id, patch) })),
      togglePlaylist: (id) =>
        setState((s) => {
          const p = s.playlists.find((x) => x.id === id);
          if (!p) return s;
          return { playlists: patchById(s.playlists, id, p.done ? { done: false, completedAt: undefined, order: nextOrder(s.playlists) } : { done: true, completedAt: Date.now() }) };
        }),
      deletePlaylist: (id) => setState((s) => ({ playlists: s.playlists.filter((x) => x.id !== id), deleted: tombstone(s.deleted, "playlists", id) })),

      addQuestion: (text, topic) => {
        const id = uid();
        const now = Date.now();
        setState((s) => ({ questions: [...s.questions, { id, text, answered: false, createdAt: now, updatedAt: now, ...(topic?.trim() && { topic: topic.trim() }) }] }));
        return id;
      },
      updateQuestion: (id, patch) => setState((s) => ({ questions: patchById(s.questions, id, patch) })),
      deleteQuestion: (id) => setState((s) => ({ questions: s.questions.filter((q) => q.id !== id), deleted: tombstone(s.deleted, "questions", id) })),

      deleteLearning: (id) => setState((s) => ({ learnings: s.learnings.filter((l) => l.id !== id), deleted: tombstone(s.deleted, "learnings", id) })),

      deleteSession: (id) => setState((s) => ({ timerSessions: s.timerSessions.filter((x) => x.id !== id), deleted: tombstone(s.deleted, "timerSessions", id) })),

      markStoryRead: (id) =>
        setState((s) => (s.storiesRead.some((r) => r.id === id) ? s : { storiesRead: [...s.storiesRead, { id, createdAt: Date.now() }] })),

      deleteMyStory: (id) => {
        const story = getState().myStories.find((x) => x.id === id);
        if (story?.imageId) deleteImages([story.imageId]);
        setState((s) => ({ myStories: s.myStories.filter((x) => x.id !== id), deleted: tombstone(s.deleted, "myStories", id) }));
      },

      restore: (kind, record) =>
        setState((s) => {
          const photo = (record as { imageId?: string; coverId?: string }).imageId ?? (record as { coverId?: string }).coverId;
          if (photo) keepImages([photo]);
          const deleted = { ...s.deleted };
          delete deleted[`${kind}:${record.id}`];
          const list = (s[kind] as { id: string }[]).filter((x) => x.id !== record.id);
          const next = [...list, { ...record, updatedAt: Date.now() }];
          const patch = { [kind]: next, deleted } as Partial<Data>;
          if (kind === "tasks") patch.days = withScore(s.days, next as Task[], (record as Task).date);
          return patch;
        }),

      reorder: (kind, ids) =>
        setState((s) => {
          const position = new Map(ids.map((id, i) => [id, i + 1]));
          const now = Date.now();
          const list = s[kind] as { id: string; order?: number }[];
          const next = list.map((x) => {
            const order = position.get(x.id);
            return order !== undefined && order !== x.order ? { ...x, order, updatedAt: now } : x;
          });
          return { [kind]: next } as Partial<Data>;
        }),

      addJournal: (date, category) => {
        const id = uid();
        const now = Date.now();
        setState((s) => ({ journal: { ...s.journal, [id]: { id, date, category, text: "", createdAt: now, updatedAt: now } } }));
        return id;
      },
      updateJournal: (key, patch) =>
        setState((s) => {
          const entry = s.journal[key];
          if (!entry) return s;
          return { journal: { ...s.journal, [key]: { ...entry, ...patch, updatedAt: Date.now() } } };
        }),
      deleteJournal: (key) =>
        setState((s) => {
          if (!s.journal[key]) return s;
          const journal = { ...s.journal };
          delete journal[key];
          return { journal, deleted: tombstone(s.deleted, "journal", key) };
        }),

      earn: (list) =>
        setState((s) => {
          const have = new Set(s.achievements.map((a) => a.id));
          const fresh = list.filter((a) => !have.has(a.id)).map((a) => ({ ...a, createdAt: a.earnedAt, updatedAt: a.earnedAt }));
          return fresh.length ? { achievements: [...s.achievements, ...fresh] } : s;
        }),
      claim: (ids) =>
        setState((s) => {
          const set = new Set(ids);
          const now = Date.now();
          return { achievements: s.achievements.map((a) => (set.has(a.id) && a.unclaimed ? { ...a, unclaimed: undefined, updatedAt: now } : a)) };
        }),

      markDay: (date, mark) =>
        setState((s) => {
          const others = s.dayMarks.filter((d) => d.id !== date);
          if (!mark) return { dayMarks: others, deleted: tombstone(s.deleted, "dayMarks", date) };
          const now = Date.now();
          const old = s.dayMarks.find((d) => d.id === date);
          const deleted = { ...s.deleted };
          delete deleted[`dayMarks:${date}`];
          return { dayMarks: [...others, { id: date, date, mark, createdAt: old?.createdAt ?? now, updatedAt: now }], deleted };
        }),

      addSavingsGoal: ({ title, target, deadline }) => {
        const id = uid();
        const now = Date.now();
        setState((s) => ({
          savings: [...s.savings, { id, title, target, ...(deadline && { deadline }), createdAt: now, updatedAt: now, order: nextOrder(s.savings.map((g) => ({ order: g.order ?? 0 }))) }],
        }));
        return id;
      },
      updateSavingsGoal: (id, patch) => setState((s) => ({ savings: patchById(s.savings, id, patch) })),
      deleteSavingsGoal: (id) =>
        setState((s) => {
          let deleted = tombstone(s.deleted, "savings", id);
          for (const d of s.deposits) if (d.goalId === id) deleted = tombstone(deleted, "deposits", d.id);
          return { savings: s.savings.filter((g) => g.id !== id), deposits: s.deposits.filter((d) => d.goalId !== id), deleted };
        }),
      addDeposit: (goalId, amount, note) => {
        const id = uid();
        const now = Date.now();
        setState((s) => ({ deposits: [...s.deposits, { id, goalId, amount, date: todayKey(), createdAt: now, updatedAt: now, ...(note?.trim() && { note: note.trim() }) }] }));
        return id;
      },
      deleteDeposit: (id) => setState((s) => ({ deposits: s.deposits.filter((d) => d.id !== id), deleted: tombstone(s.deleted, "deposits", id) })),

      addClip: (c) => {
        const id = uid();
        const now = Date.now();
        setState((s) => ({ clips: [...s.clips, { ...c, id, createdAt: now, updatedAt: now, order: nextOrder(s.clips.map((x) => ({ order: x.order ?? 0 }))) }] }));
        return id;
      },
      updateClip: (id, patch) => setState((s) => ({ clips: patchById(s.clips, id, patch) })),
      deleteClip: (id) => setState((s) => ({ clips: s.clips.filter((c) => c.id !== id), deleted: tombstone(s.deleted, "clips", id) })),

      updateSettings: (patch) => setState((s) => ({ settings: { ...s.settings, ...patch, updatedAt: Date.now() } })),

      replaceAll: (data) => setState({ ...initialData, ...normalize(data) }),

      applySynced: (data) => setState(data),
    }),
    {
      name: "alexender-data",
      version: 1,
      storage: idbStorage,
      skipHydration: true,
      partialize: (s) => pickData(s),
      merge: (persisted, current) => ({ ...current, ...normalize((persisted ?? {}) as Partial<Data>) }),
    },
  ),
);

/** The persisted/synced part of the store. */
export function pickData(s: Data): Data {
  const { tasks, days, missions, goals, videos, books, bucket, donts, podcasts, plans, ideas, habits, habitChecks, timerTasks, timerSessions, exercises, workoutLogs, skills, learnings, questions, playlists, myStories, storiesRead, journal, dayMarks, achievements, savings, deposits, clips, settings, deleted } = s;
  return { tasks, days, missions, goals, videos, books, bucket, donts, podcasts, plans, ideas, habits, habitChecks, timerTasks, timerSessions, exercises, workoutLogs, skills, learnings, questions, playlists, myStories, storiesRead, journal, dayMarks, achievements, savings, deposits, clips, settings, deleted };
}

/** Every image id referenced anywhere — used for backups and photo sync. */
export const allImageIds = (s: Data) => [
  ...s.missions.flatMap((m) => [...m.images, ...(m.iconId ? [m.iconId] : [])]),
  ...s.goals.flatMap((g) => [...g.images, ...(g.iconId ? [g.iconId] : [])]),
  ...s.books.flatMap((b) => (b.coverId ? [b.coverId] : [])),
  ...s.bucket.flatMap((b) => (b.imageId ? [b.imageId] : [])),
  ...(s.myStories ?? []).flatMap((x) => (x.imageId ? [x.imageId] : [])),
];

/** Manual order, falling back to creation time for records saved before ordering existed. */
export const byOrder = (a: { order?: number; createdAt: number }, b: { order?: number; createdAt: number }) =>
  (a.order ?? a.createdAt) - (b.order ?? b.createdAt) || a.createdAt - b.createdAt;

/** Ticking clock shared by the whole app (not persisted). */
export const useClock = create<{ now: number; today: string; tick: () => void }>((setState) => ({
  now: 0,
  today: "",
  tick: () => setState({ now: Date.now(), today: todayKey() }),
}));

/** UI-only state. */
export const useUI = create<{ unlocked: boolean; setUnlocked: (unlocked: boolean) => void }>((setState) => ({
  unlocked: false,
  setUnlocked: (unlocked) => setState({ unlocked }),
}));
