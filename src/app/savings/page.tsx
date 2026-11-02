"use client";

import { ChevronDown, Minus, PiggyBank, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { confirmDialog, promptDialog } from "@/components/dialog";
import { SortableList } from "@/components/Sortable";
import { AnimatedNumber, EmptyState, ProgressBar, SectionTop, toast } from "@/components/ui";
import { daysBetween, fromKey } from "@/lib/date";
import { tap } from "@/lib/motion";
import { byOrder, useClock, useStore } from "@/lib/store";
import type { Deposit, SavingsGoal } from "@/lib/types";
import { cn } from "@/lib/utils";

const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const QUICK = [100, 500, 1000, 5000];

/** "Laptop 60000" → a goal called Laptop with a target of ₹60,000. */
function parseGoal(text: string) {
  const m = text.match(/^(.*?)[\s:₹-]*([\d,]+(?:\.\d+)?)\s*(k)?$/i);
  if (!m || !m[1].trim()) return null;
  const target = Number(m[2].replace(/,/g, "")) * (m[3] ? 1000 : 1);
  return target > 0 ? { title: m[1].trim(), target } : null;
}

/** Savings — what you're saving for, how far you've got, and one tap to put money in. */
export default function SavingsPage() {
  const today = useClock((s) => s.today);
  const goals = useStore((s) => s.savings);
  const deposits = useStore((s) => s.deposits);
  const { addSavingsGoal, reorder } = useStore.getState();

  const list = useMemo(() => [...goals].sort(byOrder), [goals]);
  const savedBy = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of deposits) map.set(d.goalId, (map.get(d.goalId) ?? 0) + d.amount);
    return map;
  }, [deposits]);
  const total = [...savedBy.values()].reduce((a, b) => a + b, 0);
  const target = goals.reduce((a, g) => a + g.target, 0);
  const month = today.slice(0, 7);
  const thisMonth = deposits.filter((d) => d.date.startsWith(month)).reduce((a, d) => a + d.amount, 0);

  return (
    <div className="mx-auto max-w-xl">
      <SectionTop
        actions={[
          {
            label: "New goal",
            placeholder: "What for, and how much — Laptop 60000",
            onAdd: (text) => {
              const g = parseGoal(text);
              if (!g) return toast("Write a name and an amount — like “Laptop 60000”");
              addSavingsGoal(g);
            },
          },
        ]}
      />

      {goals.length === 0 ? (
        <EmptyState icon={<PiggyBank className="size-5" />} title="Save for what matters" hint="Add a goal with its amount — “Bike 90000”. Then put money in with one tap, every time you save." />
      ) : (
        <>
          <header className="mb-8 rounded-[28px] border border-line px-6 py-6" style={{ background: "color-mix(in oklab, var(--hue-sage) 8%, transparent)" }}>
            <p className="text-[14px] text-muted">Saved so far</p>
            <p className="mt-1 text-[44px] leading-none font-semibold tracking-[-0.03em] tabular-nums" style={{ color: "var(--hue-sage)" }}>
              <AnimatedNumber value={total} format={money} />
            </p>
            <p className="mt-3 text-[14px] text-muted">
              of {money(target)} · <span className={thisMonth > 0 ? "text-fg" : thisMonth < 0 ? "text-danger" : ""}>{thisMonth >= 0 ? "+" : ""}{money(thisMonth)} this month</span>
            </p>
            <ProgressBar value={target ? (total / target) * 100 : 0} tone="success" className="mt-4 h-1.5" />
          </header>

          <SortableList items={list} onReorder={(ids) => reorder("savings", ids)} className="space-y-4">
            {(g, handle) => <GoalCard goal={g} saved={savedBy.get(g.id) ?? 0} handle={handle} today={today} />}
          </SortableList>
        </>
      )}
    </div>
  );
}

function GoalCard({ goal, saved, handle, today }: { goal: SavingsGoal; saved: number; handle: React.ReactNode; today: string }) {
  const { addDeposit, deleteDeposit, deleteSavingsGoal, updateSavingsGoal } = useStore.getState();
  const deposits = useStore((s) => s.deposits);
  const [open, setOpen] = useState(false);
  const pct = goal.target ? Math.min(100, (saved / goal.target) * 100) : 0;
  const left = Math.max(0, goal.target - saved);
  const daysLeft = goal.deadline ? daysBetween(today, goal.deadline) : null;
  const history = deposits.filter((d) => d.goalId === goal.id).sort((a, b) => b.createdAt - a.createdAt);

  const put = (amount: number, note?: string) => {
    tap(10);
    const id = addDeposit(goal.id, amount, note);
    if (amount > 0 && saved < goal.target && saved + amount >= goal.target) toast(`${goal.title}: fully saved. Well done.`);
    else toast(`${amount > 0 ? "+" : "−"}${money(Math.abs(amount))} · ${goal.title}`, { label: "Undo", run: () => deleteDeposit(id) });
  };

  const askAmount = async (out: boolean) => {
    const raw = await promptDialog(out ? "How much are you taking out?" : "How much did you save?", { inputMode: "numeric" });
    const n = Number(raw?.replace(/[^\d.]/g, ""));
    if (!n) return;
    put(out ? -n : n);
  };

  return (
    <article className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-start gap-2">
        <div className="-ml-2 pt-1 pointer-coarse:hidden">{handle}</div>
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-2 text-[19px] font-semibold tracking-tight">
            <span className="min-w-0 break-words">{goal.title}</span>
            <ChevronDown className={cn("size-4 shrink-0 text-faint transition-transform", open && "rotate-180")} />
          </span>
          <span className="mt-1 block text-[14px] text-muted tabular-nums">
            <span className="font-semibold text-fg">{money(saved)}</span> of {money(goal.target)}
          </span>
        </button>
        <span className="text-[22px] font-semibold tabular-nums" style={{ color: pct >= 100 ? "var(--hue-sage)" : undefined }}>
          {Math.floor(pct)}%
        </span>
      </div>
      <ProgressBar value={pct} tone="success" className="mt-4 h-2" />
      <p className="mt-2.5 text-[13px] text-faint">
        {left === 0
          ? "Done — you saved all of it."
          : daysLeft !== null && daysLeft > 0
            ? `${money(left)} to go · save ${money(Math.ceil(left / daysLeft))} a day to make it by ${fromKey(goal.deadline!).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
            : daysLeft !== null
              ? `${money(left)} to go · the date has passed`
              : `${money(left)} to go`}
      </p>

      {/* Money in, in one tap. */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {QUICK.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => put(n)}
            className="h-12 rounded-2xl text-[15px] font-semibold tabular-nums transition-transform active:scale-95"
            style={{ color: "var(--hue-sage)", background: "color-mix(in oklab, var(--hue-sage) 12%, transparent)" }}
          >
            +{n >= 1000 ? `${n / 1000}k` : n}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => askAmount(false)} className="h-11 rounded-2xl border border-line text-[14px] font-medium text-muted transition-colors hover:text-fg active:scale-[0.98]">
          Other amount
        </button>
        <button type="button" onClick={() => askAmount(true)} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-line text-[14px] font-medium text-muted transition-colors hover:text-danger active:scale-[0.98]">
          <Minus className="size-4" /> Take out
        </button>
      </div>

      {open && (
        <div className="animate-fade mt-5 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-muted">
            <label className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-3.5">
              Save by
              <input
                type="date"
                value={goal.deadline ?? ""}
                onChange={(e) => updateSavingsGoal(goal.id, { deadline: e.target.value || undefined })}
                className="bg-transparent text-[14px] text-fg outline-none [color-scheme:dark]"
              />
            </label>
            <button
              type="button"
              onClick={async () => {
                const raw = await promptDialog("New target amount", { defaultValue: String(goal.target), inputMode: "numeric" });
                const n = Number(raw?.replace(/[^\d.]/g, ""));
                if (n > 0) updateSavingsGoal(goal.id, { target: n });
              }}
              className="h-10 rounded-full border border-line px-3.5 hover:text-fg"
            >
              Change target
            </button>
            <button
              type="button"
              onClick={async () => {
                if (await confirmDialog(`Delete “${goal.title}”?`, { detail: "Its history goes with it.", danger: true })) deleteSavingsGoal(goal.id);
              }}
              className="ml-auto flex size-10 items-center justify-center rounded-full text-faint hover:text-danger"
              aria-label="Delete goal"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          {history.length > 0 && (
            <ul className="mt-4 space-y-0.5">
              {history.slice(0, 30).map((d) => (
                <DepositRow key={d.id} deposit={d} />
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

function DepositRow({ deposit: d }: { deposit: Deposit }) {
  const deleteDeposit = useStore((s) => s.deleteDeposit);
  return (
    <li className="group flex items-center gap-3 py-1.5 text-[14px]">
      <span className="w-24 shrink-0 text-faint">{fromKey(d.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
      <span className={cn("flex-1 font-medium tabular-nums", d.amount < 0 && "text-danger")}>
        {d.amount > 0 ? "+" : "−"}
        {money(Math.abs(d.amount))}
        {d.note && <span className="ml-2 font-normal text-muted">{d.note}</span>}
      </span>
      <button
        type="button"
        aria-label="Remove"
        onClick={() => deleteDeposit(d.id)}
        className="flex size-8 items-center justify-center rounded-full text-faint hover:text-danger pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}
