"use client";

import { Check, Lightbulb, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { SectionProgress } from "@/components/SectionProgress";
import { AddBar, EmptyState, IconButton, Segmented, toast } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { Idea, IdeaStatus } from "@/lib/types";
import { useBackToClose } from "@/lib/useBackToClose";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/dialog";

type Filter = "open" | "accepted" | "rejected";

const STATUS: Record<IdeaStatus, { label: string; color: string }> = {
  new: { label: "New", color: "var(--faint)" },
  researching: { label: "Researching", color: "var(--crystal)" },
  accepted: { label: "Accepted", color: "var(--success)" },
  rejected: { label: "Rejected", color: "var(--danger)" },
};

const isOpen = (i: Idea) => i.status === "new" || i.status === "researching";

/** Ideas — catch it, research it, then decide: accept or reject, and say why. */
export default function IdeasPage() {
  const ideas = useStore((s) => s.ideas);
  const addIdea = useStore((s) => s.addIdea);
  const [filter, setFilter] = useState<Filter>("open");
  const [text, setText] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const decided = ideas.filter((i) => !isOpen(i));
  const accepted = ideas.filter((i) => i.status === "accepted").length;
  const shown = ideas
    .filter((i) => (filter === "open" ? isOpen(i) : i.status === filter))
    .sort((a, b) => (filter === "open" ? b.createdAt - a.createdAt : (b.decidedAt ?? 0) - (a.decidedAt ?? 0)));
  const current = ideas.find((i) => i.id === open);

  return (
    <div className="mx-auto max-w-2xl">

      {/* Capture first: one line, Enter, done. */}
      <AddBar
        value={text}
        onChange={setText}
        onSubmit={() => {
          addIdea(text.trim());
          setText("");
          setFilter("open");
        }}
        placeholder="Capture an idea"
        label="Add idea"
        className="mb-8"
      />

      {ideas.length > 0 && (
        <SectionProgress
          value={(decided.length / ideas.length) * 100}
          label="decided"
          detail={`${ideas.length - decided.length} open · ${accepted} accepted · ${decided.length - accepted} rejected`}
        />
      )}

      {ideas.length > 0 && (
        <div className="mb-6">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: "open", label: "Open" },
              { value: "accepted", label: "Accepted" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
        </div>
      )}

      {ideas.length === 0 && <EmptyState icon={<Lightbulb className="size-5" />} title="Catch it before it's gone" hint="Write the idea above. Research it later, then accept or reject it — with the reason." />}
      {ideas.length > 0 && shown.length === 0 && (
        <p className="text-[14px] text-faint">{filter === "open" ? "Nothing waiting for a decision." : `No ${filter} ideas yet.`}</p>
      )}

      <ul className="space-y-1">
        {shown.map((i) => (
          <li key={i.id}>
            <button onClick={() => setOpen(i.id)} className="-mx-3 block w-[calc(100%+1.5rem)] rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-surface">
              <span className="flex items-center gap-2 text-[11.5px] text-faint">
                <span aria-hidden className="size-1.5 rounded-full" style={{ background: STATUS[i.status].color }} />
                {STATUS[i.status].label}
              </span>
              <span className={cn("mt-1 block text-[15.5px] font-medium", i.status === "rejected" && "text-muted")}>{i.title}</span>
              {(i.reason || i.notes) && <span className="mt-0.5 line-clamp-2 block text-[13px] leading-relaxed text-muted">{i.reason || i.notes}</span>}
            </button>
          </li>
        ))}
      </ul>

      {current && <IdeaView key={current.id} idea={current} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** One idea, full screen: the research, then the decision and its reason. */
function IdeaView({ idea, onClose }: { idea: Idea; onClose: () => void }) {
  const { updateIdea, deleteIdea, restore } = useStore.getState();
  const set = (patch: Partial<Idea>) => updateIdea(idea.id, patch);
  const decided = !isOpen(idea);
  useBackToClose(true, onClose, { lockScroll: true });


  const decide = (status: "accepted" | "rejected") => set({ status, decidedAt: Date.now() });

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={idea.title} className="animate-fade fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg">
      <div className="sticky top-0 z-10 bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-1 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-6">
          <IconButton label="Close" onClick={onClose} className="size-10 text-fg">
            <X className="size-5" />
          </IconButton>
          <span className="flex-1" />
          <IconButton
            label="Delete idea"
            onClick={async () => {
              if (!(await confirmDialog(`Delete “${idea.title}”?`, { danger: true }))) return;
              const copy = idea;
              deleteIdea(idea.id);
              onClose();
              toast("Idea deleted", { label: "Undo", run: () => restore("ideas", copy) });
            }}
            className="size-10 hover:text-danger"
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-[max(4rem,env(safe-area-inset-bottom))] sm:px-6">
        <span className="mt-2 flex items-center gap-2 text-[12px] text-faint">
          <span aria-hidden className="size-1.5 rounded-full" style={{ background: STATUS[idea.status].color }} />
          {STATUS[idea.status].label}
          <span>· {new Date(idea.decidedAt ?? idea.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
        </span>
        <input
          value={idea.title}
          onChange={(e) => e.target.value.trim() && set({ title: e.target.value })}
          aria-label="Idea"
          className="mt-2 w-full bg-transparent text-[26px] leading-tight font-semibold tracking-[-0.02em] outline-none sm:text-[30px]"
        />

        <section className="mt-8">
          <h2 className="mb-2 text-[12px] font-medium text-faint">Research</h2>
          <textarea
            value={idea.notes ?? ""}
            onChange={(e) => set({ notes: e.target.value || undefined, ...(idea.status === "new" && e.target.value.trim() && { status: "researching" as const }) })}
            placeholder="What is it, who needs it, what would it take, what could go wrong…"
            rows={6}
            className="block w-full resize-none bg-transparent text-[15px] leading-[1.7] outline-none placeholder:text-faint [field-sizing:content]"
          />
        </section>

        <section className="mt-10 border-t border-line pt-6">
          {!decided ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto text-[13.5px] text-muted">Your decision</span>
              <button
                onClick={() => decide("rejected")}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-5 text-[13.5px] font-medium text-muted transition-colors hover:border-danger hover:text-danger active:scale-95"
              >
                <X className="size-4" /> Reject
              </button>
              <button
                onClick={() => decide("accepted")}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-fg px-5 text-[13.5px] font-medium text-bg transition-transform active:scale-95"
              >
                <Check className="size-4" /> Accept
              </button>
            </div>
          ) : (
            <div className="animate-fade">
              <div className="flex items-center gap-3">
                <span className={cn("flex-1 text-[14px] font-medium", idea.status === "accepted" ? "text-success" : "text-danger")}>
                  {idea.status === "accepted" ? "Accepted" : "Rejected"}
                </span>
                <button
                  onClick={() => set({ status: idea.notes?.trim() ? "researching" : "new", decidedAt: undefined })}
                  className="inline-flex items-center gap-1.5 text-[12.5px] text-faint transition-colors hover:text-fg"
                >
                  <RotateCcw className="size-3.5" /> Reopen
                </button>
              </div>
              <textarea
                autoFocus={!idea.reason}
                value={idea.reason ?? ""}
                onChange={(e) => set({ reason: e.target.value || undefined })}
                placeholder={idea.status === "accepted" ? "Why it’s worth doing" : "Why not — so you remember next time"}
                rows={2}
                className="mt-3 block w-full resize-none bg-transparent text-[14.5px] leading-relaxed outline-none placeholder:text-faint [field-sizing:content]"
              />
            </div>
          )}
        </section>
      </div>
    </div>,
    document.body,
  );
}
