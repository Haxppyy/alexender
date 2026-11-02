export type Priority = "high" | "med" | "low";

export interface Task {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  done: boolean;
  priority: Priority;
  time?: string; // HH:MM
  createdAt: number;
  /** Manual position (drag to reorder). */
  order?: number;
  /** Last edit time — newest edit wins when devices sync. */
  updatedAt?: number;
  completedAt?: number;
  /** Set when the task is explicitly started; makes time-spent exact. */
  startedAt?: number;
  /** Minutes spent, filled in automatically on completion (editable). */
  spentMin?: number;
  /** Optional free-form note: details, links, what "done" means. */
  note?: string;
  /** Left unfinished and copied to this day. The task itself stays on its own day, not done. */
  carriedTo?: string;
  /** Marked as not done — it counts against the day, like any task left open when the day ends. */
  failed?: boolean;
}

export interface DayLog {
  date: string;
  total: number;
  done: number;
  pct: number;
  /** First time Alexander was opened that day — the fallback start for time tracking. */
  firstSeen?: number;
}

export interface Mission {
  id: string;
  /** The mission's title. */
  text: string;
  description?: string;
  /** A small picture shown as the mission's icon. */
  iconId?: string;
  images: string[];
  /** The plan that gets you there. */
  steps?: PlanStep[];
  createdAt: number;
  /** Manual position (drag to reorder). */
  order?: number;
  /** Last edit time — newest edit wins when devices sync. */
  updatedAt?: number;
}

export interface Goal {
  id: string;
  title: string;
  why: string;
  deadline?: string;
  iconId?: string;
  images: string[];
  steps?: PlanStep[];
  achieved: boolean;
  achievedAt?: number;
  createdAt: number;
  /** Manual position (drag to reorder). */
  order?: number;
  /** Last edit time — newest edit wins when devices sync. */
  updatedAt?: number;
}

/** A YouTube playlist to work through — title, channel and cover fill in from the link. */
export interface Playlist {
  id: string;
  url: string;
  /** YouTube's playlist id (the `list=` part of the link). */
  listId: string;
  title: string;
  channel?: string;
  thumb?: string;
  done: boolean;
  completedAt?: number;
  createdAt: number;
  updatedAt?: number;
  order: number;
}

export interface Video {
  id: string;
  url: string;
  youtubeId: string;
  title: string;
  channel?: string;
  durationSec?: number;
  views?: number;
  published?: string;
  done: boolean;
  completedAt?: number;
  createdAt: number;
  /** Last edit time — newest edit wins when devices sync. */
  updatedAt?: number;
  order: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  coverChecked?: boolean;
  /** A cover photo you uploaded (wins over the looked-up one). */
  coverId?: string;
  /** What you will do with what the book taught you. */
  action?: string;
  totalPages?: number;
  currentPage?: number;
  /** Being read now. Several books can be read at once. */
  reading?: boolean;
  done: boolean;
  completedAt?: number;
  createdAt: number;
  /** Last edit time — newest edit wins when devices sync. */
  updatedAt?: number;
  order: number;
}

/** One entry of a simple list: a to-do, a "don't do" rule, a podcast. */
export interface ListItem {
  id: string;
  title: string;
  note?: string;
  /** A link (podcast episodes). */
  url?: string;
  done: boolean;
  doneAt?: number;
  createdAt: number;
  updatedAt?: number;
  order: number;
}

export interface PlanStep {
  id: string;
  text: string;
  done: boolean;
  /** Optional due date (YYYY-MM-DD). */
  due?: string;
  doneAt?: number;
}

export type PlanStatus = "todo" | "doing" | "paused" | "done";
export type PlanPriority = "low" | "med" | "high";

/** A plan for anything: what and why, a deadline, ordered steps with due dates, and notes. */
export interface Plan {
  id: string;
  title: string;
  description?: string;
  /** Why this plan matters — read it when motivation dips. */
  why?: string;
  deadline?: string;
  status?: PlanStatus;
  priority?: PlanPriority;
  note?: string;
  steps: PlanStep[];
  createdAt: number;
  updatedAt?: number;
  order: number;
}

export type WorkoutUnit = "reps" | "min" | "km" | "steps";

/** An exercise with a daily target — "Push-ups, 100 a day". */
export interface Exercise {
  id: string;
  title: string;
  unit: WorkoutUnit;
  /** How much a day counts as hit. */
  target: number;
  createdAt: number;
  updatedAt?: number;
  order?: number;
}

/** One burst of an exercise ("+20"). A day's total is the sum, so two devices never clash. */
export interface WorkoutLog {
  id: string;
  exerciseId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  createdAt: number;
  updatedAt?: number;
}

/** A skill you're developing: why, a plan of what to learn, and a log of what you learned. */
export interface Skill {
  id: string;
  title: string;
  why?: string;
  steps?: PlanStep[];
  createdAt: number;
  updatedAt?: number;
  order?: number;
}

/** Something learned on a day — on its own, or for one of your skills. */
export interface Learning {
  id: string;
  /** The skill it belongs to, if any. */
  skillId?: string;
  text: string;
  /** Where it came from: a book, a person, a video… */
  source?: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
  updatedAt?: number;
}

/** Something you do every day. */
export interface Habit {
  id: string;
  title: string;
  createdAt: number;
  updatedAt?: number;
  order?: number;
}

/**
 * One day a habit was done. The id is `${habitId}:${date}`, so the same day checked on two
 * devices is one record. No record for a day means it wasn't done.
 */
export interface HabitCheck {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
  updatedAt?: number;
}

/** Something you time — study, gym, deep work. */
export interface TimerTask {
  id: string;
  title: string;
  createdAt: number;
  updatedAt?: number;
  order?: number;
}

/** One timed session. Running while it has no `endedAt` and `endsAt` is still ahead. */
export interface TimerSession {
  id: string;
  taskId: string;
  /** The task's name when it ran, so history survives renames and deletes. */
  title: string;
  date: string; // YYYY-MM-DD, the day it started
  startedAt: number;
  /** When you chose for it to end. */
  endsAt: number;
  /** When it actually ended — on time, or stopped early. */
  endedAt?: number;
  /** Started with no end: it counts up until you stop it (`endsAt` is only a 24-hour safety stop). */
  open?: boolean;
  createdAt: number;
  updatedAt?: number;
}

/** A doubt or question you have — until you find the answer. */
export interface Question {
  id: string;
  text: string;
  /** What it's about — gives the question its colour. */
  topic?: string;
  answer?: string;
  answered: boolean;
  answeredAt?: number;
  createdAt: number;
  updatedAt?: number;
}

export type IdeaStatus = "new" | "researching" | "accepted" | "rejected";

/** An idea: captured, researched, then accepted or rejected — with the reason. */
export interface Idea {
  id: string;
  title: string;
  /** What the research found. */
  notes?: string;
  status: IdeaStatus;
  /** Why it was accepted or rejected. */
  reason?: string;
  decidedAt?: number;
  createdAt: number;
  updatedAt?: number;
}

/** A story you have read (built-in or your own), so progress follows you across devices. */
export interface StoryRead {
  /** The story's id. */
  id: string;
  createdAt: number;
  updatedAt?: number;
}

/** A story of a great person that you added yourself, with their picture. */
export interface MyStory {
  id: string;
  person: string;
  title: string;
  /** The story; blank lines separate paragraphs. */
  story: string;
  imageId?: string;
  when?: string;
  lesson?: string;
  source?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface BucketItem {
  id: string;
  title: string;
  note?: string;
  imageId?: string;
  done: boolean;
  doneAt?: number;
  createdAt: number;
  updatedAt?: number;
  order: number;
}

export type JournalCategory = "day" | "thoughts" | "gratitude" | "lesson" | "win" | "mistake" | "idea" | "dream";

/**
 * One journal entry. A day can hold several, each in its own category. Entries written before
 * there could be several have no id: their key in the journal is their date.
 */
export interface JournalEntry {
  id?: string;
  date: string;
  category?: JournalCategory;
  text: string;
  createdAt?: number;
  updatedAt: number;
}

/** How a day was spent, in your own judgement: used or wasted, and 1–5 overall. The id is the date. */
export interface DayRating {
  id: string;
  date: string;
  verdict?: "used" | "wasted";
  stars?: number;
  createdAt: number;
  updatedAt?: number;
}

/** Something you're saving money for. */
export interface SavingsGoal {
  id: string;
  title: string;
  target: number;
  deadline?: string;
  createdAt: number;
  updatedAt?: number;
  order?: number;
}

/** Money put in (positive) or taken out (negative). A goal's total is the sum. */
export interface Deposit {
  id: string;
  goalId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
  createdAt: number;
  updatedAt?: number;
}

/** A video clip kept on this device. The video itself lives in its own store under `videoId`. */
export interface Clip {
  id: string;
  title: string;
  videoId: string;
  type: string;
  size: number;
  durationSec?: number;
  createdAt: number;
  updatedAt?: number;
  order?: number;
}

export interface Settings {
  name: string;
  winThreshold: number;
  birthDate: string; // YYYY-MM-DD
  country: string;
  /** Overrides the country average when set. */
  lifeExpectancy?: number;
  /** Which tab the YouTube section opens on. */
  youtubeTab?: "videos" | "playlists" | "podcasts";
  /** How the statue on Today is drawn: the photo, or in characters. */
  statueStyle?: "photo" | "ascii";
  /** Which picture of time the Life section shows. */
  lifeView?: string;
  /** Device passcode, stored only as a salted hash. */
  lock?: { salt: string; hash: string; length: number };
  /** Legacy single mission, migrated into `missions`. */
  mission?: string;
  updatedAt?: number;
}
