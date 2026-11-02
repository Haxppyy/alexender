"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Trash2 } from "lucide-react";
import { useBackToClose } from "@/lib/useBackToClose";
import { SectionProgress } from "@/components/SectionProgress";
import { confirmDialog } from "@/components/dialog";
import { toast } from "@/components/ui";
import { addDays, fromKey } from "@/lib/date";
import { tap } from "@/lib/motion";
import { useClock, useStore } from "@/lib/store";
import type { JournalCategory, JournalEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

/** What an entry is about. Each has its own colour, so a day reads at a glance. */
export const CATEGORIES: { value: JournalCategory; label: string; color: string; prompt: string }[] = [
  { value: "day", label: "My day", color: "var(--hue-sky)", prompt: "How was your day?\n\nWhat happened, what you felt…" },
  { value: "thoughts", label: "Thoughts", color: "var(--hue-peach)", prompt: "What's on your mind?" },
  { value: "gratitude", label: "Gratitude", color: "var(--hue-sage)", prompt: "Three things you're grateful for today…" },
  { value: "lesson", label: "Lesson", color: "var(--hue-teal)", prompt: "What did today teach you?" },
  { value: "win", label: "Win", color: "var(--hue-amber)", prompt: "What did you get right today?" },
  { value: "mistake", label: "Mistake", color: "var(--hue-rose)", prompt: "What went wrong — and what will you do differently?" },
  { value: "idea", label: "Idea", color: "var(--hue-lime)", prompt: "Write the idea down before it's gone…" },
  { value: "dream", label: "Dream", color: "var(--hue-violet)", prompt: "What did you dream — or dream of?" },
];
const categoryOf = (c?: JournalCategory) => CATEGORIES.find((x) => x.value === c) ?? CATEGORIES[0];

const dayLabel = (date: string, today: string) =>
  date === today
    ? "Today"
    : date === addDays(today, -1)
      ? "Yesterday"
      : fromKey(date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: date.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric" });

type Item = JournalEntry & { key: string };

export default function JournalPage() {
  const today = useClock((s) => s.today);
  const journal = useStore((s) => s.journal);
  const addJournal = useStore((s) => s.addJournal);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<JournalCategory | null>(null);

  // Newest day first; within a day, in the order written.
  const entries = useMemo<Item[]>(
    () =>
      Object.entries(journal)
        .map(([key, e]) => ({ ...e, key }))
        .filter((e) => e.text.trim() || e.key === open)
        .sort((a, b) => b.date.localeCompare(a.date) || (a.createdAt ?? 0) - (b.createdAt ?? 0)),
    [journal, open],
  );
  const shown = filter ? entries.filter((e) => (e.category ?? "day") === filter) : entries;
  const groups = shown.reduce<[string, Item[]][]>((acc, e) => {
    const last = acc[acc.length - 1];
    if (last && last[0] === e.date) last[1].push(e);
    else acc.push([e.date, [e]]);
    return acc;
  }, []);
  const used = new Set(entries.map((e) => e.category ?? "day"));

  // This month: days written out of days so far. Streak: consecutive days up to today (or yesterday).
  const written = new Set(entries.filter((e) => e.text.trim()).map((e) => e.date));
  const dayOfMonth = Number(today.slice(8, 10));
  const thisMonth = [...written].filter((d) => d.slice(0, 7) === today.slice(0, 7)).length;
  let streak = 0;
  for (let d = written.has(today) ? today : addDays(today, -1); written.has(d); d = addDays(d, -1)) streak++;

  const write = (category: JournalCategory) => {
    tap(8);
    setOpen(addJournal(today, category));
  };

  return (
    <div className="mx-auto max-w-xl">
      <section className="mb-8">
        <p className="mb-3 text-center text-[14px] text-muted">Write about…</p>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => write(c.value)}
              className="flex h-16 flex-col items-center justify-center gap-1.5 rounded-2xl text-[13px] font-semibold transition-transform active:scale-95"
              style={{ color: c.color, background: `color-mix(in oklab, ${c.color} 12%, transparent)` }}
            >
              <span aria-hidden className="size-2 rounded-full" style={{ background: c.color }} />
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {entries.length > 0 && (
        <SectionProgress
          value={(thisMonth / dayOfMonth) * 100}
          label="of days written this month"
          detail={`${streak}-day streak · ${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
        />
      )}

      {used.size > 1 && (
        <div className="no-scrollbar -mx-4 mb-8 flex gap-1.5 overflow-x-auto px-4">
          <FilterChip on={!filter} onClick={() => setFilter(null)} label="All" />
          {CATEGORIES.filter((c) => used.has(c.value)).map((c) => (
            <FilterChip key={c.value} on={filter === c.value} onClick={() => setFilter(filter === c.value ? null : c.value)} label={c.label} color={c.color} />
          ))}
        </div>
      )}

      {open && <Entry key={open} entryKey={open} onDone={() => setOpen(null)} />}

      {entries.length === 0 && <p className="text-center text-[16px] text-faint">Your days, in your words. Pick what to write about — a day can hold as many entries as you like.</p>}

      <div className="space-y-10">
        {groups.map(([date, items]) => (
          <section key={date}>
            <h2 className="mb-3 flex items-baseline justify-between gap-3">
              <span className="text-[17px] font-semibold tracking-tight">{dayLabel(date, today)}</span>
              <span className="text-[12.5px] text-faint">
                {items.length} {items.length === 1 ? "entry" : "entries"}
              </span>
            </h2>
            <ul className="space-y-2.5">
              {items.map((e) => {
                const c = categoryOf(e.category);
                return (
                  <li key={e.key}>
                    <button
                      onClick={() => setOpen(e.key)}
                      className="block w-full rounded-2xl border-l-[3px] px-4 py-3.5 text-left transition-[background-color,transform] active:scale-[0.99]"
                      style={{ borderColor: c.color, background: `color-mix(in oklab, ${c.color} 7%, var(--surface))` }}
                    >
                      <span className="text-[12px] font-semibold tracking-[0.08em] uppercase" style={{ color: c.color }}>
                        {c.label}
                      </span>
                      <span className="mt-1 line-clamp-5 block text-[16.5px] leading-relaxed whitespace-pre-wrap text-fg/90">{e.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function FilterChip({ on, onClick, label, color = "var(--fg)" }: { on: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn("h-9 shrink-0 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors", !on && "border-line text-muted hover:text-fg")}
      style={on ? { color, borderColor: `color-mix(in oklab, ${color} 55%, transparent)`, background: `color-mix(in oklab, ${color} 12%, transparent)` } : undefined}
    >
      {label}
    </button>
  );
}

/**
 * Tracks the part of the screen not covered by the on-screen keyboard. Browsers that
 * shrink the page for the keyboard and those (like iPhone Safari) that overlay it both
 * report it through visualViewport.
 */
function useVisibleViewport() {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setBox({ top: vv.offsetTop, height: vv.height });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return box;
}

/** Full-screen writing for one entry. Saves as you type; always fits above the keyboard. An entry left empty is removed. */
function Entry({ entryKey, onDone }: { entryKey: string; onDone: () => void }) {
  const entry = useStore((s) => s.journal[entryKey]);
  const { updateJournal, deleteJournal } = useStore.getState();
  const [text, setText] = useState(entry?.text ?? "");
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<string | null>(null);
  const box = useVisibleViewport();

  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current === null) return;
    updateJournal(entryKey, { text: pending.current });
    pending.current = null;
    setSaved(true);
  };

  // Closing saves what's pending, and drops the entry if nothing was written.
  const close = () => {
    flush();
    if (!useStore.getState().journal[entryKey]?.text.trim()) deleteJournal(entryKey);
    onDone();
  };
  useBackToClose(true, close, { lockScroll: true });

  // Save whatever is pending when leaving the entry.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pending.current !== null) useStore.getState().updateJournal(entryKey, { text: pending.current });
    },
    [entryKey],
  );

  if (!entry) return null;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const c = categoryOf(entry.category);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Journal entry"
      className="animate-fade fixed inset-x-0 top-0 z-50 flex h-dvh flex-col bg-bg"
      style={box ? { top: box.top, height: box.height } : undefined}
    >
      <div className="mx-auto flex w-full max-w-2xl shrink-0 items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-6 sm:pt-6">
        <button onClick={close} aria-label="Back to journal" className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg active:scale-95">
          <ChevronLeft className="size-6" />
        </button>
        <p className="min-w-0 flex-1 truncate text-[16px] font-medium">{fromKey(entry.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
        {entry.text.trim() && (
          <button
            aria-label="Delete entry"
            onClick={async () => {
              if (!(await confirmDialog("Delete this entry?", { danger: true }))) return;
              pending.current = null;
              deleteJournal(entryKey);
              toast("Entry deleted");
              onDone();
            }}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-faint transition-colors hover:text-danger"
          >
            <Trash2 className="size-[18px]" />
          </button>
        )}
        <button onClick={close} className="h-10 shrink-0 rounded-full bg-fg px-5 text-[14px] font-medium text-bg transition-transform active:scale-95">
          Done
        </button>
      </div>
      {/* The category: tap another to move the entry there. */}
      <div className="no-scrollbar mx-auto flex w-full max-w-2xl shrink-0 gap-1.5 overflow-x-auto px-5 pb-1 sm:px-8">
        {CATEGORIES.map((x) => (
          <button
            key={x.value}
            type="button"
            onClick={() => updateJournal(entryKey, { category: x.value })}
            className="h-8 shrink-0 rounded-full px-3 text-[12.5px] font-semibold transition-colors"
            style={x.value === c.value ? { color: x.color, background: `color-mix(in oklab, ${x.color} 16%, transparent)` } : { color: "var(--faint)" }}
          >
            {x.label}
          </button>
        ))}
      </div>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => {
          const value = e.target.value;
          setText(value);
          setSaved(false);
          pending.current = value;
          clearTimeout(timer.current);
          timer.current = setTimeout(flush, 500);
        }}
        onBlur={flush}
        placeholder={c.prompt}
        className="mx-auto block min-h-0 w-full max-w-2xl flex-1 resize-none overflow-y-auto bg-transparent px-5 py-4 text-[18px] leading-[1.75] text-fg outline-none placeholder:text-faint sm:px-8 sm:text-[19px]"
      />
      <div className="mx-auto flex w-full max-w-2xl shrink-0 items-center justify-between border-t border-line px-5 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-[12px] text-faint sm:px-8">
        <span>{words ? `${words} words` : "Nothing written yet"}</span>
        <span>{saved ? (entry.text ? "Saved" : "") : "Saving…"}</span>
      </div>
    </div>,
    document.body,
  );
}
