"use client";

import { NotebookPen, X } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { smooth, tap } from "@/lib/motion";
import { byOrder, useStore } from "@/lib/store";
import type { Priority, Task } from "@/lib/types";
import { cn, parseQuickTask } from "@/lib/utils";
import { BROKEN_PROMISE } from "@/lib/voice";
import { SortableList } from "./Sortable";
import { Checkbox, IconButton, toast } from "./ui";

/** Open tasks in your order; then done ones in the order they were done; then the ones not done. */
const rank = (t: Task) => (t.done ? 1 : t.failed ? 2 : 0);
export const sortTasks = (a: Task, b: Task) =>
  rank(a) - rank(b) || (a.done ? (a.completedAt ?? 0) - (b.completedAt ?? 0) : byOrder(a, b));

/** Each priority's colour and name — red-hot for what can't wait, calm blue for what can. */
export const PRIORITIES: { value: Priority; label: string; short: string; color: string }[] = [
  { value: "high", label: "High priority", short: "High", color: "var(--hue-rose)" },
  { value: "med", label: "Medium", short: "Medium", color: "var(--hue-amber)" },
  { value: "low", label: "Low", short: "Low", color: "var(--hue-sky)" },
];
const priorityOf = (p: Priority) => PRIORITIES.find((x) => x.value === p) ?? PRIORITIES[1];
const NEXT_PRIORITY: Record<Priority, Priority> = { high: "med", med: "low", low: "high" };

/** The tasks of one day, open ones grouped by priority. Drag the handle to reorder within a group. */
export function TaskList({
  date,
  emptyText,
}: {
  date: string;
  emptyText?: string;
}) {
  const allTasks = useStore((s) => s.tasks);
  const reorder = useStore((s) => s.reorder);
  const tasks = useMemo(
    () => allTasks.filter((t) => t.date === date).sort(sortTasks),
    [allTasks, date],
  );
  const open = tasks.filter((t) => !t.done && !t.failed);
  const done = tasks.filter((t) => t.done || t.failed);

  if (tasks.length === 0)
    return emptyText ? (
      <p className="animate-fade py-8 text-center text-[14px] text-faint">
        {emptyText}
      </p>
    ) : null;
  return (
    <div>
      {PRIORITIES.map((p) => {
        const group = open.filter((t) => (t.priority ?? "med") === p.value);
        if (!group.length) return null;
        return (
          <section key={p.value} className="mb-4">
            <h3 className="mb-1 flex items-center gap-2 px-1 text-[12px] font-semibold tracking-[0.12em] uppercase" style={{ color: p.color }}>
              <span aria-hidden className="h-3.5 w-1 rounded-full" style={{ background: p.color }} />
              {p.label}
              <span className="font-medium text-faint tabular-nums">{group.length}</span>
            </h3>
            <SortableList items={group} onReorder={(ids) => reorder("tasks", ids)}>
              {(t, handle) => <TaskRow task={t} handle={handle} />}
            </SortableList>
          </section>
        );
      })}
      {done.length > 0 && (
        <ul className={cn(open.length > 0 && "mt-2 border-t border-line pt-2")}>
          {done.map((t) => (
            <li key={t.id}>
              <TaskRow task={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({
  task,
  handle,
}: {
  task: Task;
  handle?: ReactNode;
}) {
  const { toggleTask, toggleNotDone, deleteTask, updateTask, restore } = useStore.getState();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  // Set once Enter or Escape has handled the edit, so the blur that follows doesn't act again.
  const handled = useRef(false);
  const [noteOpen, setNoteOpen] = useState(false);
  // Opening the note ends any title edit first, so the row settles back to normal.
  const openNote = () => {
    if (editing) save();
    setNoteOpen(true);
  };

  const startEditing = () => {
    handled.current = false;
    setTitle(task.title);
    setEditing(true);
  };

  // Editing understands the same shortcuts as adding: "Gym !high tomorrow".
  const save = () => {
    if (handled.current) return;
    handled.current = true;
    setEditing(false);
    const parsed = parseQuickTask(title, task.date);
    if (!parsed.title || title.trim() === task.title) {
      setTitle(task.title);
      return;
    }
    updateTask(task.id, {
      title: parsed.title,
      date: parsed.date,
      ...(/(^|\s)!\w/.test(title) && { priority: parsed.priority }),
    });
    setTitle(parsed.title);
  };

  const remove = () => {
    smooth(() => deleteTask(task.id));
    toast("Task deleted", { label: "Undo", run: () => restore("tasks", task) });
  };

  return (
    <div
      style={{ viewTransitionName: `task-${task.id}` }}
      className={cn(
        "group -mx-2 rounded-2xl px-2 transition-colors duration-200 hover:bg-surface",
      )}
    >
      <div className="flex min-h-[58px] items-center gap-2">
        <div className="flex w-7 shrink-0 justify-center pointer-coarse:hidden pointer-fine:opacity-0 pointer-fine:transition-opacity pointer-fine:group-hover:opacity-100">
          {handle}
        </div>
        {task.failed ? (
          // Not done: a red cross. Tap it to take that back.
          <button
            type="button"
            aria-label={`${task.title}: not done — tap to undo`}
            onClick={() => smooth(() => toggleNotDone(task.id))}
            className="hit flex size-[22px] shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger transition-transform active:scale-90"
          >
            <X className="size-3.5" strokeWidth={3} />
          </button>
        ) : (
          <Checkbox
            checked={task.done}
            onChange={() => {
              if (!task.done) tap();
              smooth(() => toggleTask(task.id));
            }}
            label={task.title}
          />
        )}
        <div className="ml-1 flex min-w-0 flex-1 items-center gap-2">
          {editing ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={save}
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") {
                  e.preventDefault();
                  handled.current = true;
                  setTitle(task.title);
                  setEditing(false);
                }
              }}
              className="w-full bg-transparent text-[16.5px] outline-none"
            />
          ) : (
            <button
              onClick={startEditing}
              className={cn(
                "min-w-0 py-3.5 text-left text-[16.5px] leading-snug break-words transition-[color] duration-300",
                task.done
                  ? "text-faint line-through decoration-faint/70"
                  : task.failed
                    ? "text-faint"
                    : "text-fg",
              )}
            >
              {task.title}
            </button>
          )}
          {task.failed && <span className="shrink-0 text-[11.5px] text-danger/80">Not done</span>}
          {!task.done && !task.failed && (
            // Tap to move it up or down: high → medium → low.
            <button
              type="button"
              title="Change priority"
              aria-label={`${priorityOf(task.priority).label} — change`}
              onClick={() => smooth(() => updateTask(task.id, { priority: NEXT_PRIORITY[task.priority ?? "med"] }))}
              className="hit ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-transform active:scale-90"
              style={{ color: priorityOf(task.priority).color, background: `color-mix(in oklab, ${priorityOf(task.priority).color} 14%, transparent)` }}
            >
              {priorityOf(task.priority).short}
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center text-[12px] text-faint">
          {/* Desktop: on hover. Phone: only while the task is being edited, to keep rows clean. */}
          <div
            onPointerDown={(e) => e.preventDefault()}
            className={cn(
              "flex items-center pointer-fine:opacity-0 pointer-fine:transition-opacity pointer-fine:group-hover:opacity-100 pointer-fine:focus-within:opacity-100",
              !editing && "pointer-coarse:hidden",
            )}
          >
            <IconButton
              label={task.note ? "Edit note" : "Add note"}
              onClick={openNote}
            >
              <NotebookPen className="size-3.5" />
            </IconButton>
            <IconButton
              label="Delete task"
              className="hover:text-danger"
              onClick={remove}
            >
              <X className="size-3.5" />
            </IconButton>
          </div>
        </div>
        {!task.done && !task.failed && (
          <button
            type="button"
            aria-label={`Mark ${task.title} as not done`}
            title="Not done"
            onClick={() => {
              tap(30);
              smooth(() => toggleNotDone(task.id));
              toast(BROKEN_PROMISE[Math.floor(Math.random() * BROKEN_PROMISE.length)]);
            }}
            className="hit ml-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-line-strong text-faint transition-colors hover:border-danger/70 hover:text-danger active:scale-90"
          >
            <X className="size-3" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* The note sits under the title, lined up with it. */}
      {(noteOpen || task.note) && (
        <div className="pr-2 pb-3 pl-[70px] -mt-2 pointer-coarse:pl-[34px]">
          {noteOpen ? (
            <NoteEditor task={task} onClose={() => setNoteOpen(false)} />
          ) : (
            <button
              onClick={openNote}
              title="Edit note"
              className={cn(
                "line-clamp-2 w-full text-left text-[13px] leading-relaxed whitespace-pre-wrap transition-colors hover:text-muted",
                task.done ? "text-faint/70" : "text-faint",
              )}
            >
              {task.note}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Saves as you type; Esc or tapping elsewhere closes it. An empty note is removed. */
function NoteEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const updateTask = useStore((s) => s.updateTask);
  const [text, setText] = useState(task.note ?? "");
  return (
    <textarea
      autoFocus
      value={text}
      rows={Math.max(1, text.split("\n").length)}
      placeholder="Add a note…"
      onChange={(e) => {
        setText(e.target.value);
        updateTask(task.id, {
          note: e.target.value.trim() ? e.target.value : undefined,
        });
      }}
      onBlur={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
        // Enter adds a line; Ctrl/Cmd + Enter finishes.
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onClose();
      }}
      className="block w-full resize-none rounded-lg bg-surface-2 px-2.5 py-2 text-[13px] leading-relaxed text-fg outline-none placeholder:text-faint [field-sizing:content] focus:ring-1 focus:ring-line-strong"
    />
  );
}
