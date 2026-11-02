"use client";

import { CalendarPlus, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { SectionProgress } from "@/components/SectionProgress";
import { DueChip, StepPlanner, stepProgress } from "@/components/StepPlanner";
import { Button, IconButton, Input, Modal, ProgressBar, Segmented, Select, Textarea, toast } from "@/components/ui";
import { daysBetween } from "@/lib/date";
import { byOrder, useClock, useStore } from "@/lib/store";
import type { Plan, PlanPriority, PlanStatus } from "@/lib/types";
import { useBackToClose } from "@/lib/useBackToClose";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/dialog";
import { openRewards } from "@/components/Ceremony";
import { RewardPicker, RewardSection } from "@/components/Rewards";
import type { PersonalReward } from "@/lib/types";

const STATUSES: { value: PlanStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "Doing" },
  { value: "paused", label: "Paused" },
  { value: "done", label: "Done" },
];
const PRIORITIES: { value: PlanPriority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "med", label: "Medium" },
  { value: "low", label: "Low" },
];
const PRIORITY_COLOR: Record<PlanPriority, string> = { high: "var(--danger)", med: "var(--crystal)", low: "var(--faint)" };
const STATUS_RANK: Record<PlanStatus, number> = { doing: 0, todo: 1, paused: 2, done: 3 };
const PRIORITY_RANK: Record<PlanPriority, number> = { high: 0, med: 1, low: 2 };

const statusOf = (p: Plan): PlanStatus => p.status ?? "todo";
const priorityOf = (p: Plan): PlanPriority => p.priority ?? "med";

/** What to look at first: what you're doing, then what matters most, then what's due soonest. */
function byFocus(a: Plan, b: Plan) {
  return (
    STATUS_RANK[statusOf(a)] - STATUS_RANK[statusOf(b)] ||
    PRIORITY_RANK[priorityOf(a)] - PRIORITY_RANK[priorityOf(b)] ||
    (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") ||
    byOrder(a, b)
  );
}

/** Plan anything — with status, priority, deadlines, dated steps and the next move always in view. */
export default function PlansPage() {
  const plans = useStore((s) => s.plans);
  const today = useClock((s) => s.today);
  const addTask = useStore((s) => s.addTask);
  const [filter, setFilter] = useState<"active" | "done">("active");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const active = plans.filter((p) => statusOf(p) !== "done").sort(byFocus);
  const done = plans.filter((p) => statusOf(p) === "done").sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const shown = filter === "active" ? active : done;

  // Dated steps across every active plan — overdue first, then soonest.
  const upcoming = active
    .flatMap((p) => (p.steps ?? []).filter((s) => !s.done && s.due).map((s) => ({ plan: p, step: s })))
    .sort((a, b) => a.step.due!.localeCompare(b.step.due!))
    .slice(0, 6);
  const overdue = upcoming.filter(({ step }) => step.due! < today).length;
  const current = plans.find((p) => p.id === open);
  const activeSteps = active.flatMap((p) => p.steps ?? []);

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 flex justify-end">
        <button
          onClick={() => setAdding(true)}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-line-strong px-5 text-[14.5px] font-medium text-muted transition-colors hover:border-faint hover:text-fg"
        >
          <Plus className="size-4" /> New plan
        </button>
      </header>

      {plans.length > 0 && (
        <SectionProgress
          value={activeSteps.length ? (activeSteps.filter((s) => s.done).length / activeSteps.length) * 100 : done.length ? 100 : 0}
          label="of active steps done"
          detail={`${done.length}/${plans.length} plans complete${overdue ? ` · ${overdue} overdue` : ""}`}
        />
      )}

      {upcoming.length > 0 && filter === "active" && (
        <section className="mb-8 rounded-3xl border border-line bg-surface p-4">
          <h2 className="mb-2 text-[12px] font-medium tracking-[0.14em] text-faint uppercase">Coming up</h2>
          <ul className="divide-y divide-line">
            {upcoming.map(({ plan, step }) => (
              <li key={step.id} className="flex min-h-14 items-center gap-3 py-2">
                <button onClick={() => setOpen(plan.id)} className="min-w-0 flex-1 text-left">
                  <span className="block text-[15.5px] leading-snug break-words">{step.text}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-[12.5px] break-words text-faint">
                    <DueChip due={step.due!} today={today} />
                    {plan.title}
                  </span>
                </button>
                <IconButton
                  label="Add to Today"
                  onClick={() => {
                    addTask({ title: step.text, date: today });
                    toast("Added to Today");
                  }}
                >
                  <CalendarPlus className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plans.length > 0 && (
        <div className="mb-4">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: "active", label: `Active ${active.length}` },
              { value: "done", label: `Done ${done.length}` },
            ]}
          />
        </div>
      )}

      {plans.length === 0 && (
        <button onClick={() => setAdding(true)} className="flex w-full flex-col items-start gap-1 py-4 text-left">
          <span className="text-[16px] font-medium">Make your first plan</span>
          <span className="text-[13px] text-faint">A trip, a launch, an exam, a habit — set a deadline and a priority, then break it into dated steps.</span>
        </button>
      )}
      {plans.length > 0 && shown.length === 0 && <p className="py-8 text-[14px] text-faint">{filter === "active" ? "Nothing active — every plan is done." : "No finished plans yet."}</p>}

      <ul className="space-y-3">
        {shown.map((p) => (
          <li key={p.id}>
            <PlanCard plan={p} today={today} onOpen={() => setOpen(p.id)} />
          </li>
        ))}
      </ul>

      <Modal open={adding} onClose={() => setAdding(false)} title="New plan">
        {adding && (
          <NewPlanForm
            onCancel={() => setAdding(false)}
            onCreated={(id) => {
              setAdding(false);
              setOpen(id);
            }}
          />
        )}
      </Modal>

      {current && <PlanView plan={current} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PlanCard({ plan, today, onOpen }: { plan: Plan; today: string; onOpen: () => void }) {
  const p = stepProgress(plan.steps);
  const status = statusOf(plan);
  return (
    <button onClick={onOpen} className="group -mx-3 flex w-[calc(100%+1.5rem)] items-stretch gap-4 rounded-2xl px-3 py-4 text-left transition-colors hover:bg-surface active:bg-surface">
      <span aria-hidden className="w-1 shrink-0 rounded-full" style={{ background: PRIORITY_COLOR[priorityOf(plan)] }} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn("min-w-0 flex-1 text-[17px] leading-snug font-semibold tracking-tight break-words", status === "done" && "text-faint line-through decoration-1")}>{plan.title}</span>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px]", status === "doing" ? "bg-crystal-soft text-crystal" : "bg-surface-2 text-faint")}>
            {STATUSES.find((s) => s.value === status)?.label}
          </span>
        </span>
        {plan.description && <span className="mt-1 line-clamp-2 block text-[13px] leading-relaxed text-muted">{plan.description}</span>}
        <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-faint">
          {p.total > 0 ? (
            <span className="flex items-center gap-2">
              <ProgressBar value={p.pct} tone="crystal" className="w-20" />
              <span className="tabular-nums">
                {p.done}/{p.total}
              </span>
            </span>
          ) : (
            <span>No steps yet</span>
          )}
          {plan.deadline && status !== "done" && <DeadlineText deadline={plan.deadline} today={today} />}
        </span>
        {p.next && status !== "done" && <span className="mt-2 line-clamp-2 block text-[12.5px] text-muted">Next: {p.next.text}</span>}
      </span>
      <ChevronRight className="mt-1 size-4 shrink-0 self-start text-faint" />
    </button>
  );
}

function DeadlineText({ deadline, today }: { deadline: string; today: string }) {
  const left = daysBetween(today, deadline);
  return (
    <span className={cn("tabular-nums", left < 0 ? "text-danger" : left <= 7 ? "text-crystal" : "")}>
      {left < 0 ? `${-left}d overdue` : left === 0 ? "Due today" : `${left}d left`}
    </span>
  );
}

function NewPlanForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const { addPlan, updatePlan } = useStore.getState();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<PlanPriority>("med");
  const [reward, setReward] = useState<PersonalReward>();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const id = addPlan(title.trim());
        updatePlan(id, { description: description.trim() || undefined, deadline: deadline || undefined, priority, status: "todo", ...(reward?.text.trim() && { reward: { ...reward, text: reward.text.trim() } }) });
        onCreated(id);
      }}
      className="space-y-4"
    >
      <label className="block">
        <span className="mb-1.5 block text-[12px] text-faint">Plan</span>
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Trip to Japan" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[12px] text-faint">Description · optional</span>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What done looks like" />
      </label>
      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="mb-1.5 block text-[12px] text-faint">Complete by · optional</span>
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-10 w-auto" />
        </label>
        <div>
          <span className="mb-1.5 block text-[12px] text-faint">Priority</span>
          <Segmented value={priority} onChange={setPriority} options={PRIORITIES} />
        </div>
      </div>
      <RewardPicker value={reward} onChange={setReward} />
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!title.trim()}>
          Create plan
        </Button>
      </div>
    </form>
  );
}

/** A small pill holding a native picker — quiet until you need it. */
function Pill({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="relative inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-[12.5px] text-muted transition-colors focus-within:border-line-strong hover:border-line-strong">
      <span className="text-faint">{label}</span>
      {children}
    </label>
  );
}

const pillControl = "bg-transparent text-[12.5px] text-fg outline-none [color-scheme:dark]";

/** One plan, full screen and simple: what it is, three small settings, the steps, and notes. */
function PlanView({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const today = useClock((s) => s.today);
  const { updatePlan, deletePlan, restore } = useStore.getState();
  const set = (patch: Partial<Plan>) => updatePlan(plan.id, patch);
  const p = stepProgress(plan.steps);
  const status = statusOf(plan);
  const earned = useStore((s) => s.achievements.find((a) => a.id === `plan:${plan.id}`));
  useBackToClose(true, onClose, { lockScroll: true });


  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={plan.title} className="animate-fade fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg">
      <div className="sticky top-0 z-10 bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-1 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-6">
          <IconButton label="Close" onClick={onClose} className="size-10 text-fg">
            <X className="size-5" />
          </IconButton>
          <span className="flex-1" />
          <IconButton
            label="Delete plan"
            onClick={async () => {
              if (!(await confirmDialog(`Delete “${plan.title}”?`, { danger: true }))) return;
              const copy = plan;
              deletePlan(plan.id);
              onClose();
              toast("Plan deleted", { label: "Undo", run: () => restore("plans", copy) });
            }}
            className="size-10 hover:text-danger"
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-[max(4rem,env(safe-area-inset-bottom))] sm:px-6">
        <input
          value={plan.title}
          onChange={(e) => e.target.value.trim() && set({ title: e.target.value })}
          aria-label="Plan title"
          className="mt-2 w-full bg-transparent text-[26px] leading-tight font-semibold tracking-[-0.02em] outline-none sm:text-[30px]"
        />
        <textarea
          value={plan.description ?? ""}
          onChange={(e) => set({ description: e.target.value || undefined })}
          aria-label="Description"
          placeholder="What done looks like"
          rows={1}
          className="mt-1 block w-full resize-none bg-transparent text-[14.5px] leading-relaxed text-muted outline-none placeholder:text-faint [field-sizing:content]"
        />

        {/* Three quiet settings in one row. */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Pill label="Status">
            <Select label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUSES} />
          </Pill>
          <Pill label="Priority">
            <Select
              label="Priority"
              value={priorityOf(plan)}
              onChange={(v) => set({ priority: v })}
              options={PRIORITIES.map((o) => ({ ...o, dot: PRIORITY_COLOR[o.value] }))}
            />
          </Pill>
          <Pill label="Complete by">
            <input
              type="date"
              value={plan.deadline ?? ""}
              onChange={(e) => set({ deadline: e.target.value || undefined })}
              className={cn(pillControl, "w-[7.6rem]", !plan.deadline && "text-faint")}
            />
          </Pill>
          {plan.deadline && status !== "done" && (
            <span className="text-[12px]">
              <DeadlineText deadline={plan.deadline} today={today} />
            </span>
          )}
        </div>

        {p.total > 0 && p.done === p.total && status !== "done" && (
          <div className="animate-fade mt-5 flex items-center gap-3 text-[13.5px]">
            <span className="flex-1 text-success">Every step is done.</span>
            <Button size="sm" onClick={() => set({ status: "done" })}>
              Mark plan done
            </Button>
          </div>
        )}

        <div className="mt-6">
          <RewardSection reward={plan.reward} onChange={(reward) => set({ reward })} done={status === "done"} earned={earned} onClaim={openRewards} what="plan" />
        </div>

        <section className="mt-10">
          <StepPlanner
            steps={plan.steps}
            onChange={(steps) => set({ steps, ...(status === "todo" && steps.some((s) => s.done) && { status: "doing" as const }) })}
          />
        </section>

        <section className="mt-10">
          {plan.why && <p className="mb-3 border-l-2 border-crystal/60 pl-3 text-[13.5px] leading-relaxed text-muted">{plan.why}</p>}
          <textarea
            value={plan.note ?? ""}
            onChange={(e) => set({ note: e.target.value || undefined })}
            aria-label="Notes"
            placeholder="Notes"
            rows={2}
            className="block w-full resize-none border-t border-line bg-transparent pt-4 text-[14px] leading-relaxed outline-none placeholder:text-faint [field-sizing:content]"
          />
        </section>
      </div>
    </div>,
    document.body,
  );
}
