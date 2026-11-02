"use client";

import { Bell, BellOff, Check, Plus, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { showReminder, useGoalToOpen } from "@/components/GoalReminders";
import { ObjectiveCard, ObjectiveForm, ObjectiveView } from "@/components/Objective";
import { SectionProgress } from "@/components/SectionProgress";
import { SortableList } from "@/components/Sortable";
import { Button, Input, Modal } from "@/components/ui";
import { daysBetween, formatTime12 } from "@/lib/date";
import { goalReminder } from "@/lib/motivate";
import { askToNotify } from "@/lib/notify";
import { byOrder, useClock, useStore } from "@/lib/store";
import type { Goal } from "@/lib/types";
import { cn } from "@/lib/utils";

const target = <Target className="size-5" strokeWidth={1.5} />;

function DaysLeft({ deadline, today }: { deadline: string; today: string }) {
  const left = daysBetween(today, deadline);
  return (
    <span className={cn("tabular-nums", left < 0 ? "text-danger" : left <= 14 ? "text-crystal" : "")}>
      {left < 0 ? `${-left} days overdue` : left === 0 ? "Due today" : `${left} days left`}
    </span>
  );
}

/** Goals — concrete targets with a deadline, a vision and a plan. Separate from your missions. */
export default function GoalsPage() {
  const goals = useStore((s) => s.goals);
  const today = useClock((s) => s.today);
  const { addGoal, updateGoal, deleteGoal, reorder } = useStore.getState();
  const [adding, setAdding] = useState(false);
  const [deadline, setDeadline] = useState("");
  // Arriving from Alexander's reminder opens that goal.
  const [open, setOpen] = useState<string | null>(() => useGoalToOpen.getState().id);
  useEffect(() => {
    useGoalToOpen.setState({ id: null });
    return useGoalToOpen.subscribe(({ id }) => {
      if (!id) return;
      setOpen(id);
      useGoalToOpen.setState({ id: null });
    });
  }, []);
  const active = goals.filter((g) => !g.achieved).sort(byOrder);
  const achieved = goals.filter((g) => g.achieved).sort((a, b) => (b.achievedAt ?? 0) - (a.achievedAt ?? 0));
  const current = goals.find((g) => g.id === open);

  const meta = (g: Goal) =>
    g.achieved ? (
      <span className="text-success">Achieved</span>
    ) : g.deadline || g.remind ? (
      <span className="inline-flex items-center gap-3">
        {g.deadline && <DaysLeft deadline={g.deadline} today={today} />}
        {g.remind && (
          <span className="inline-flex items-center gap-1 text-crystal/80">
            <Bell className="size-3" /> {formatTime12(g.remind)}
          </span>
        )}
      </span>
    ) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8 flex items-end justify-between gap-4">
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight">Goals</h1>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-line-strong px-5 text-[14.5px] font-medium text-muted transition-colors hover:border-faint hover:text-fg"
        >
          <Plus className="size-4" /> Add goal
        </button>
      </header>

      {goals.length > 0 && (
        <SectionProgress
          value={(achieved.length / goals.length) * 100}
          label="achieved"
          detail={`${achieved.length} of ${goals.length} goals · ${active.flatMap((g) => g.steps ?? []).filter((s) => s.done).length}/${active.flatMap((g) => g.steps ?? []).length} steps`}
        />
      )}

      {goals.length === 0 && (
        <button onClick={() => setAdding(true)} className="flex w-full flex-col items-start gap-1 py-4 text-left">
          <span className="text-[16px] font-medium">Add your first goal</span>
          <span className="text-[13px] text-faint">A concrete target with a deadline — then plan the steps to reach it.</span>
        </button>
      )}

      <SortableList items={active} onReorder={(ids) => reorder("goals", ids)} className="space-y-3">
        {(g, handle) => (
          <div className="group relative">
            <div className="absolute top-1/2 -left-9 hidden -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 lg:block">{handle}</div>
            <ObjectiveCard item={toFields(g)} fallbackIcon={target} meta={meta(g)} onOpen={() => setOpen(g.id)} />
          </div>
        )}
      </SortableList>

      {achieved.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 text-[13px] font-medium text-muted">Achieved</h2>
          <ul className="space-y-3">
            {achieved.map((g) => (
              <li key={g.id}>
                <ObjectiveCard item={toFields(g)} fallbackIcon={target} meta={meta(g)} onOpen={() => setOpen(g.id)} muted />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="New goal">
        {adding && (
          <ObjectiveForm
            kind="goal"
            extra={
              <label className="block">
                <span className="mb-1.5 block text-[12px] text-faint">Deadline · optional</span>
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-10 w-auto" />
              </label>
            }
            onCancel={() => {
              setAdding(false);
              setDeadline("");
            }}
            onSave={({ title, description, iconId }) => {
              const id = addGoal({ title, why: description, deadline: deadline || undefined });
              if (iconId) updateGoal(id, { iconId, steps: [] });
              setAdding(false);
              setDeadline("");
              setOpen(id);
            }}
          />
        )}
      </Modal>

      {current && (
        <ObjectiveView
          kind="goal"
          item={toFields(current)}
          fallbackIcon={target}
          onPatch={({ title, description, ...rest }) => updateGoal(current.id, { ...rest, ...(title !== undefined && { title }), ...(description !== undefined && { why: description }) })}
          onDelete={() => deleteGoal(current.id)}
          onClose={() => setOpen(null)}
          details={
            <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-[12px] text-faint">
              <label className="flex items-center gap-2">
                Deadline
                <Input type="date" value={current.deadline ?? ""} onChange={(e) => updateGoal(current.id, { deadline: e.target.value || undefined })} className="h-9 w-auto px-2 text-[12.5px]" />
              </label>
              {current.deadline && !current.achieved && <DaysLeft deadline={current.deadline} today={today} />}
              <Button
                size="sm"
                variant={current.achieved ? "outline" : "primary"}
                onClick={() => updateGoal(current.id, { achieved: !current.achieved, achievedAt: current.achieved ? undefined : Date.now() })}
              >
                <Check className="size-3.5" /> {current.achieved ? "Achieved" : "Mark achieved"}
              </Button>
            </div>
            {!current.achieved && <ReminderSettings goal={current} today={today} />}
            </div>
          }
        />
      )}
    </div>
  );
}

/** When Alexander reminds you of this goal, and what he'll say today. */
function ReminderSettings({ goal, today }: { goal: Goal; today: string }) {
  const updateGoal = useStore((s) => s.updateGoal);
  return (
    <section className="rounded-2xl border border-line bg-surface px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 text-[14px] font-medium">
          {goal.remind ? <Bell className="size-4 text-crystal" /> : <BellOff className="size-4 text-faint" />}
          Alexander reminds me daily at
        </span>
        <Input
          type="time"
          value={goal.remind ?? ""}
          onChange={(e) => {
            updateGoal(goal.id, { remind: e.target.value || undefined });
            if (e.target.value) void askToNotify();
          }}
          aria-label="Reminder time"
          className="h-10 w-auto px-3 text-[14px] [color-scheme:dark]"
        />
        {goal.remind && (
          <button type="button" onClick={() => updateGoal(goal.id, { remind: undefined })} className="h-10 rounded-full px-3 text-[13px] text-faint hover:text-danger">
            Turn off
          </button>
        )}
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">“{goalReminder(goal, today).text}”</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => showReminder(goal.id)}>
          Show me now
        </Button>
        <span className="text-[12px] text-faint">A notification comes while Alexander is open, even in the background. If it was closed, he tells you when you next open it.</span>
      </div>
    </section>
  );
}

const toFields = (g: Goal) => ({ title: g.title, description: g.why || undefined, iconId: g.iconId, images: g.images, steps: g.steps });
