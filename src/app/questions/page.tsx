"use client";

import { Check, MessageCircleQuestionMark, RotateCcw, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { confirmDialog } from "@/components/dialog";
import { SectionProgress } from "@/components/SectionProgress";
import { AddBar, EmptyState, IconButton, Segmented } from "@/components/ui";
import { tap } from "@/lib/motion";
import { useClock, useStore } from "@/lib/store";
import type { Question } from "@/lib/types";
import { useBackToClose } from "@/lib/useBackToClose";
import { cn } from "@/lib/utils";

/*
 * Questions — the doubts you carry, until you find the answers. Each topic gets one soft colour
 * from a small palette, used only for a dot, a tag and a thin edge: a little colour, still calm.
 */

const HUES = ["var(--hue-sky)", "var(--hue-sage)", "var(--hue-amber)", "var(--hue-rose)", "var(--hue-violet)", "var(--hue-teal)"];

/** The same topic always gets the same colour. */
const hueOf = (topic?: string) => {
  if (!topic) return HUES[0];
  const n = [...topic.toLowerCase()].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381);
  return HUES[n % HUES.length];
};

const ago = (ms: number, now: number) => {
  const d = Math.floor((now - ms) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 30 ? `${d}d ago` : new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

function TopicTag({ topic, className }: { topic?: string; className?: string }) {
  if (!topic) return null;
  const hue = hueOf(topic);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium", className)} style={{ color: hue, background: `color-mix(in oklab, ${hue} 14%, transparent)` }}>
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: hue }} />
      {topic}
    </span>
  );
}

/** The topics you've used, most recent first — tap one instead of typing it again. */
function TopicPicker({ topics, value, onChange }: { topics: string[]; value: string; onChange: (topic: string) => void }) {
  return (
    <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-0.5">
      {topics.map((t) => {
        const on = value.toLowerCase() === t.toLowerCase();
        const hue = hueOf(t);
        return (
          <button
            key={t}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? "" : t)}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition-colors"
            style={on ? { color: hue, borderColor: `color-mix(in oklab, ${hue} 55%, transparent)`, background: `color-mix(in oklab, ${hue} 12%, transparent)` } : undefined}
          >
            <span aria-hidden className="size-1.5 rounded-full" style={{ background: hue }} />
            <span className={on ? "" : "text-muted"}>{t}</span>
          </button>
        );
      })}
      <input
        value={topics.some((t) => t.toLowerCase() === value.toLowerCase()) ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={topics.length ? "or a new topic" : "Topic — optional"}
        aria-label="Topic"
        className="h-7 w-32 shrink-0 bg-transparent px-1 text-[12.5px] outline-none placeholder:text-faint"
      />
    </div>
  );
}

export default function QuestionsPage() {
  const now = useClock((s) => s.now);
  const questions = useStore((s) => s.questions);
  const addQuestion = useStore((s) => s.addQuestion);
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [view, setView] = useState<"open" | "answered">("open");
  const [openId, setOpenId] = useState<string | null>(null);

  // Topics you've used, most recent first, each once (case doesn't matter).
  const topics = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const q of [...questions].sort((a, b) => b.createdAt - a.createdAt)) if (q.topic && !byKey.has(q.topic.toLowerCase())) byKey.set(q.topic.toLowerCase(), q.topic);
    return [...byKey.values()].slice(0, 8);
  }, [questions]);
  const answered = questions.filter((q) => q.answered).length;
  const shown = questions
    .filter((q) => (view === "open" ? !q.answered : q.answered))
    .sort((a, b) => (view === "open" ? b.createdAt - a.createdAt : (b.answeredAt ?? 0) - (a.answeredAt ?? 0)));
  const current = questions.find((q) => q.id === openId);

  const ask = () => {
    if (!text.trim()) return;
    addQuestion(text.trim(), topic);
    tap(10);
    setText("");
    setView("open");
  };

  return (
    <div className="mx-auto max-w-2xl">

      <AddBar
        value={text}
        onChange={setText}
        onSubmit={ask}
        placeholder="What's your question?"
        label="Ask"
        className="mb-8"
        footer={<TopicPicker topics={topics} value={topic} onChange={setTopic} />}
      />

      {questions.length > 0 && (
        <>
          <SectionProgress value={(answered / questions.length) * 100} label="answered" detail={`${questions.length - answered} open · ${answered} answered`} />
          <div className="mb-5">
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "open", label: `Open · ${questions.length - answered}` },
                { value: "answered", label: `Answered · ${answered}` },
              ]}
            />
          </div>
        </>
      )}

      {questions.length === 0 && (
        <EmptyState icon={<MessageCircleQuestionMark className="size-5" />} title="Keep your doubts somewhere" hint="Write down any question as it comes. When you find the answer, write that too — it's how doubts turn into knowing." />
      )}
      {questions.length > 0 && shown.length === 0 && <p className="text-[13px] text-faint">{view === "open" ? "No open questions. Curious about nothing? Unlikely." : "Nothing answered yet."}</p>}

      <ul className="space-y-2">
        {shown.map((q) => {
          const hue = hueOf(q.topic);
          return (
            <li key={q.id}>
              <button
                onClick={() => setOpenId(q.id)}
                className="group relative block w-full overflow-hidden rounded-2xl bg-surface py-3.5 pr-4 pl-5 text-left transition-colors hover:bg-surface-2"
              >
                {/* The thin coloured edge that says which topic this is. */}
                <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-r-full" style={{ background: hue, opacity: q.answered ? 0.45 : 0.9 }} />
                <span className="flex items-center gap-2">
                  {q.topic ? <TopicTag topic={q.topic} /> : null}
                  <span className="ml-auto shrink-0 text-[11.5px] text-faint">{ago(q.answered ? (q.answeredAt ?? q.createdAt) : q.createdAt, now)}</span>
                </span>
                <span className={cn("mt-1.5 block text-[15.5px] leading-snug font-medium break-words", q.answered && "text-muted")}>{q.text}</span>
                {q.answer && (
                  <span className="mt-1 flex items-start gap-1.5 text-[13px] leading-relaxed text-muted">
                    <Check className="mt-[3px] size-3.5 shrink-0" style={{ color: hue }} strokeWidth={2.5} />
                    <span className="line-clamp-2 break-words">{q.answer}</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {current && <QuestionView key={current.id} question={current} topics={topics} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/** One question, full screen: the question, its topic, and the answer once you find it. */
function QuestionView({ question: q, topics, onClose }: { question: Question; topics: string[]; onClose: () => void }) {
  const { updateQuestion, deleteQuestion } = useStore.getState();
  const set = (patch: Partial<Question>) => updateQuestion(q.id, patch);
  const hue = hueOf(q.topic);
  useBackToClose(true, onClose, { lockScroll: true });

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={q.text} className="animate-fade fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg">
      <div className="sticky top-0 z-10 bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-1 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-6">
          <IconButton label="Close" onClick={onClose} className="size-10 text-fg">
            <X className="size-5" />
          </IconButton>
          <span className="flex-1" />
          <IconButton
            label="Delete question"
            onClick={async () => {
              if (!(await confirmDialog("Delete this question?", { danger: true }))) return;
              deleteQuestion(q.id);
              onClose();
            }}
            className="size-10 hover:text-danger"
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-[max(4rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="mt-2 flex items-center gap-2">
          <TopicTag topic={q.topic} />
          <span className="text-[12px] text-faint">{q.answered ? "Answered" : "Open"}</span>
        </div>
        <textarea
          value={q.text}
          onChange={(e) => e.target.value.trim() && set({ text: e.target.value })}
          aria-label="Question"
          rows={1}
          className="mt-2 block w-full resize-none bg-transparent text-[24px] leading-snug font-semibold tracking-[-0.015em] outline-none [field-sizing:content] sm:text-[28px]"
        />
        <div className="mt-3">
          <TopicPicker topics={topics} value={q.topic ?? ""} onChange={(t) => set({ topic: t.trim() || undefined })} />
        </div>

        <section className="mt-8 rounded-2xl border p-4" style={{ borderColor: `color-mix(in oklab, ${hue} 30%, var(--line))`, background: `color-mix(in oklab, ${hue} 5%, transparent)` }}>
          <h2 className="mb-2 text-[12px] font-medium" style={{ color: hue }}>
            The answer
          </h2>
          <textarea
            value={q.answer ?? ""}
            onChange={(e) => set({ answer: e.target.value || undefined })}
            placeholder="Write it here when you find it — and where it came from."
            aria-label="Answer"
            rows={4}
            className="block w-full resize-none bg-transparent text-[15px] leading-[1.7] outline-none placeholder:text-faint [field-sizing:content]"
          />
        </section>

        <div className="mt-6 flex justify-end">
          {q.answered ? (
            <button onClick={() => set({ answered: false, answeredAt: undefined })} className="inline-flex items-center gap-1.5 text-[13px] text-faint transition-colors hover:text-fg">
              <RotateCcw className="size-3.5" /> Reopen
            </button>
          ) : (
            <button
              onClick={() => {
                tap(16);
                set({ answered: true, answeredAt: Date.now() });
                onClose();
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-[13.5px] font-medium text-bg transition-transform active:scale-95"
              style={{ background: hue }}
            >
              <Check className="size-4" strokeWidth={2.5} /> Mark answered
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
