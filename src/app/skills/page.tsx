"use client";

import { Check, Sprout, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { confirmDialog } from "@/components/dialog";
import { SectionProgress } from "@/components/SectionProgress";
import { SortableList } from "@/components/Sortable";
import { StepPlanner, stepProgress } from "@/components/StepPlanner";
import { EmptyState, IconButton, ProgressBar, Segmented } from "@/components/ui";
import { addDays, daysBetween, fromKey } from "@/lib/date";
import { byOrder, useClock, useStore } from "@/lib/store";
import type { Learning, Skill } from "@/lib/types";
import { useBackToClose } from "@/lib/useBackToClose";
import { cn } from "@/lib/utils";

/** Days in a row with something learned, up to today (an empty today doesn't break it yet). */
function learningStreak(dates: Set<string>, today: string) {
  let n = 0;
  for (let d = dates.has(today) ? today : addDays(today, -1); dates.has(d); d = addDays(d, -1)) n++;
  return n;
}

const ago = (date: string, today: string) => {
  const d = daysBetween(date, today);
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

/** Skills — what you're developing: a plan of what to learn, and a log of what you learned. */
export default function SkillsPage() {
  const today = useClock((s) => s.today);
  const skills = useStore((s) => s.skills);
  const learnings = useStore((s) => s.learnings);
  const { addSkill, reorder } = useStore.getState();
  const [text, setText] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => [...skills].sort(byOrder), [skills]);
  const bySkill = useMemo(() => {
    const map = new Map<string, Learning[]>();
    for (const l of learnings) {
      if (!l.skillId) continue; // learned on its own, not for a skill
      if (!map.has(l.skillId)) map.set(l.skillId, []);
      map.get(l.skillId)!.push(l);
    }
    return map;
  }, [learnings]);

  const planned = list.filter((k) => (k.steps ?? []).length > 0);
  const avg = planned.length ? planned.reduce((n, k) => n + stepProgress(k.steps).pct, 0) / planned.length : 0;
  const weekStart = addDays(today, -6);
  const thisWeek = learnings.filter((l) => l.skillId && l.date >= weekStart).length;
  const current = list.find((k) => k.id === open);

  return (
    <div className="mx-auto max-w-2xl">

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const title = text.trim();
          if (!title) return;
          setOpen(addSkill(title));
          setText("");
        }}
        className="mb-8"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="A skill to develop…"
          aria-label="New skill"
          enterKeyHint="done"
          className="h-12 w-full border-b border-line bg-transparent text-[16px] outline-none placeholder:text-faint focus:border-line-strong"
        />
      </form>

      {list.length > 0 && <SectionProgress value={avg} label="of the plan learned" detail={`${thisWeek} learned this week`} />}

      {list.length === 0 && <EmptyState icon={<Sprout className="size-5" />} title="What are you growing into?" hint="Public speaking, Greek, guitar, sales. Plan what to learn, then write one line a day of what you learned." />}

      <SortableList items={list} onReorder={(ids) => reorder("skills", ids)} className="space-y-1">
        {(k, handle) => {
          const learned = bySkill.get(k.id) ?? [];
          const p = stepProgress(k.steps);
          const last = learned.reduce((m, l) => (l.date > m ? l.date : m), "");
          const streak = learningStreak(new Set(learned.map((l) => l.date)), today);
          return (
            <div className="group relative">
              <div className="absolute top-1/2 -left-7 hidden -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 lg:block">{handle}</div>
              <button onClick={() => setOpen(k.id)} className="-mx-3 block w-[calc(100%+1.5rem)] rounded-2xl px-3 py-4 text-left transition-colors hover:bg-surface">
                <span className="flex items-baseline gap-3">
                  <span className="min-w-0 flex-1 text-[18px] leading-snug font-semibold tracking-tight break-words">{k.title}</span>
                  {p.total > 0 && <span className="shrink-0 text-[13px] text-muted tabular-nums">{p.pct}%</span>}
                </span>
                {p.total > 0 && <ProgressBar value={p.pct} tone="crystal" className="mt-2.5" />}
                <span className="mt-2.5 block text-[12px] text-faint tabular-nums">
                  {learned.length} learned{last ? ` · last ${ago(last, today)}` : ""}
                  {streak > 1 ? ` · ${streak}-day streak` : ""}
                  {p.total > 0 ? ` · ${p.done}/${p.total} steps` : " · no plan yet"}
                </span>
              </button>
            </div>
          );
        }}
      </SortableList>

      {current && <SkillView key={current.id} skill={current} learned={bySkill.get(current.id) ?? []} today={today} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** One skill, full screen: why it matters, what you learned (first), and the plan. */
function SkillView({ skill, learned, today, onClose }: { skill: Skill; learned: Learning[]; today: string; onClose: () => void }) {
  const { updateSkill, deleteSkill, addLearning, deleteLearning } = useStore.getState();
  const [pane, setPane] = useState<"learned" | "plan">((skill.steps ?? []).length || learned.length ? "learned" : "plan");
  const [text, setText] = useState("");
  useBackToClose(true, onClose, { lockScroll: true });

  const steps = skill.steps ?? [];
  const p = stepProgress(steps);
  const open = steps.filter((s) => !s.done).slice(0, 3);
  const streak = learningStreak(new Set(learned.map((l) => l.date)), today);
  const byDay = [...learned].sort((a, b) => b.createdAt - a.createdAt).reduce<[string, Learning[]][]>((groups, l) => {
    const last = groups[groups.length - 1];
    if (last && last[0] === l.date) last[1].push(l);
    else groups.push([l.date, [l]]);
    return groups;
  }, []);

  // Learning a planned step ticks it off — that's what moves the progress.
  const learnStep = (id: string) => {
    const step = steps.find((s) => s.id === id);
    if (!step) return;
    updateSkill(skill.id, { steps: steps.map((s) => (s.id === id ? { ...s, done: true, doneAt: Date.now() } : s)) });
    addLearning(skill.id, step.text);
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={skill.title} className="animate-fade fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg">
      <div className="sticky top-0 z-10 bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-1 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-6">
          <IconButton label="Close" onClick={onClose} className="size-10 text-fg">
            <X className="size-5" />
          </IconButton>
          <span className="flex-1" />
          <IconButton
            label="Delete skill"
            onClick={async () => {
              if (!(await confirmDialog(`Delete “${skill.title}”?`, { detail: "Its plan and everything you logged go with it.", danger: true }))) return;
              deleteSkill(skill.id);
              onClose();
            }}
            className="size-10 hover:text-danger"
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-[max(4rem,env(safe-area-inset-bottom))] sm:px-6">
        <input
          value={skill.title}
          onChange={(e) => e.target.value.trim() && updateSkill(skill.id, { title: e.target.value })}
          aria-label="Skill"
          className="mt-2 w-full bg-transparent text-[26px] leading-tight font-semibold tracking-[-0.02em] outline-none sm:text-[30px]"
        />
        <textarea
          value={skill.why ?? ""}
          onChange={(e) => updateSkill(skill.id, { why: e.target.value || undefined })}
          placeholder="Why it matters to you"
          aria-label="Why it matters"
          rows={1}
          className="mt-1 block w-full resize-none bg-transparent text-[14.5px] leading-relaxed text-muted outline-none placeholder:text-faint [field-sizing:content]"
        />

        <div className="mt-6 grid grid-cols-3 gap-2">
          {[
            [p.total ? `${p.pct}%` : "—", "Plan learned"],
            [learned.length, "Things learned"],
            [streak, "Day streak"],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="text-[20px] font-semibold tabular-nums">{value}</p>
              <p className="mt-0.5 text-[11.5px] text-faint">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 mb-6">
          <Segmented
            value={pane}
            onChange={setPane}
            options={[
              { value: "learned", label: `Learned · ${learned.length}` },
              { value: "plan", label: p.total ? `Plan · ${p.pct}%` : "Plan" },
            ]}
          />
        </div>

        {pane === "learned" ? (
          <section className="animate-fade">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!text.trim()) return;
                addLearning(skill.id, text.trim());
                setText("");
              }}
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="What did you learn today?"
                aria-label="What did you learn today?"
                rows={2}
                className="block w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed outline-none placeholder:text-faint focus:border-line-strong [field-sizing:content]"
              />
            </form>

            {open.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-[12px] text-faint">Learned a step from your plan? Tick it off:</p>
                <div className="flex flex-wrap gap-1.5">
                  {open.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => learnStep(s.id)}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-left text-[12.5px] text-muted transition-colors hover:border-crystal/60 hover:text-fg"
                    >
                      <Check className="size-3.5 shrink-0" /> <span className="break-words">{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {byDay.length === 0 && <p className="mt-6 text-[13px] text-faint">One line a day is enough. It adds up.</p>}
            <div className="mt-8 space-y-6">
              {byDay.map(([date, items]) => (
                <div key={date}>
                  <p className="mb-2 text-[12px] text-faint">{date === today ? "Today" : fromKey(date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</p>
                  <ul className="space-y-1">
                    {items.map((l) => (
                      <li key={l.id} className="group flex items-start gap-3">
                        <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-crystal/70" />
                        <span className="min-w-0 flex-1 py-0.5 text-[14.5px] leading-relaxed break-words whitespace-pre-wrap">{l.text}</span>
                        <IconButton label="Delete" onClick={() => deleteLearning(l.id)} className={cn("size-8 hover:text-danger pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100")}>
                          <X className="size-3.5" />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="animate-fade">
            <StepPlanner steps={steps} onChange={(next) => updateSkill(skill.id, { steps: next })} emptyHint="What do you need to learn, in order? Add the first thing." />
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}
