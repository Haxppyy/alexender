"use client";

import { ChevronRight, ImagePlus, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { deleteImages, saveImages } from "@/lib/images";
import type { PersonalReward, PlanStep } from "@/lib/types";
import { RewardPicker } from "./Rewards";
import { useBackToClose } from "@/lib/useBackToClose";
import { cn } from "@/lib/utils";
import { StepPlanner, stepProgress } from "./StepPlanner";
import { Button, IconButton, ImageUploadButton, Input, ProgressBar, Segmented, StoredImage, Textarea } from "./ui";
import { confirmDialog } from "./dialog";

/*
 * Missions and goals share one shape on screen: an icon, a title and a description; a vision
 * (images, shown first) and a plan with progress beside it.
 */

export interface ObjectiveFields {
  title: string;
  description?: string;
  iconId?: string;
  images: string[];
  steps?: PlanStep[];
}

export type ObjectivePatch = Partial<{ title: string; description: string; iconId: string; images: string[]; steps: PlanStep[] }>;

/** The small picture standing for a mission or goal. */
export function ObjectiveIcon({ iconId, fallback, className }: { iconId?: string; fallback: ReactNode; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface-2 text-faint", className)}>
      {iconId ? <StoredImage id={iconId} className="size-full" /> : fallback}
    </span>
  );
}

/** A mission or goal in a list: icon, title, description, and its plan in one quiet line — how far, and what's next. */
export function ObjectiveCard({ item, fallbackIcon, meta, onOpen, muted }: { item: ObjectiveFields; fallbackIcon: ReactNode; meta?: ReactNode; onOpen: () => void; muted?: boolean }) {
  const p = stepProgress(item.steps);
  return (
    <button onClick={onOpen} className="group -mx-3 flex w-[calc(100%+1.5rem)] items-start gap-4 rounded-2xl px-3 py-4 text-left transition-colors hover:bg-surface active:bg-surface">
      <ObjectiveIcon iconId={item.iconId} fallback={fallbackIcon} className="size-14" />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[19px] leading-snug font-semibold tracking-tight sm:text-[21px]", muted && "text-faint line-through decoration-1")}>{item.title}</span>
        {item.description && <span className="mt-1.5 line-clamp-2 block text-[13.5px] leading-relaxed text-muted">{item.description}</span>}
        {p.total > 0 ? (
          <span className="mt-4 block">
            <span className="flex items-center gap-3">
              <ProgressBar value={p.pct} tone="crystal" className="h-[3px] flex-1" />
              <span className="shrink-0 text-[12.5px] text-faint tabular-nums">
                {p.done}/{p.total}
              </span>
            </span>
            {p.next && !muted && (
              <span className="mt-2.5 flex items-baseline gap-2 text-[14px]">
                <span className="shrink-0 text-faint">Next</span>
                <span className="min-w-0 truncate text-muted">{p.next.text}</span>
              </span>
            )}
          </span>
        ) : (
          <span className="mt-3 block text-[13px] text-faint">No plan yet</span>
        )}
        {meta && <span className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-faint">{meta}</span>}
      </span>
      <ChevronRight className="mt-1 size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

/** Title, description and icon — used when adding a mission or goal. */
export function ObjectiveForm({ kind, onSave, onCancel, extra }: { kind: string; onSave: (f: { title: string; description?: string; iconId?: string; reward?: PersonalReward }) => void; onCancel: () => void; extra?: ReactNode }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [iconId, setIconId] = useState<string>();
  const [reward, setReward] = useState<PersonalReward>();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSave({ title: title.trim(), description: description.trim() || undefined, iconId, reward: reward?.text.trim() ? { ...reward, text: reward.text.trim() } : undefined });
      }}
      className="space-y-4"
    >
      <div className="flex items-start gap-4">
        <ImageUploadButton
          plain
          multiple={false}
          onAdd={([id]) => {
            if (!id) return;
            if (iconId) deleteImages([iconId]);
            setIconId(id);
          }}
          className="relative size-16 shrink-0 overflow-hidden rounded-2xl border border-dashed border-line-strong text-faint hover:border-faint hover:text-muted"
        >
          {iconId ? <StoredImage id={iconId} className="size-full" /> : <ImagePlus className="size-5" />}
          <span className="sr-only">Choose an icon image</span>
        </ImageUploadButton>
        <label className="block min-w-0 flex-1">
          <span className="mb-1.5 block text-[12px] text-faint">Title</span>
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Name the ${kind}`} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[12px] text-faint">Description</span>
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={`What this ${kind} means to you, and what it looks like when it's done`} />
      </label>
      {extra}
      <RewardPicker value={reward} onChange={setReward} />
      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (iconId) deleteImages([iconId]);
            onCancel();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!title.trim()}>
          Add {kind}
        </Button>
      </div>
    </form>
  );
}

/**
 * A mission or goal, full screen. The vision comes first; the plan and its progress sit beside
 * it on a wide screen, or one tap away on a phone. Everything is editable in place.
 */
export function ObjectiveView({
  kind,
  item,
  fallbackIcon,
  onPatch,
  onDelete,
  onClose,
  details,
}: {
  kind: string;
  item: ObjectiveFields;
  fallbackIcon: ReactNode;
  onPatch: (patch: ObjectivePatch) => void;
  onDelete: () => void;
  onClose: () => void;
  /** Extra controls under the description (a goal's deadline and "achieved"). */
  details?: ReactNode;
}) {
  const [pane, setPane] = useState<"vision" | "plan">("vision");
  const [managing, setManaging] = useState(false);
  const [dropping, setDropping] = useState(false);
  const p = stepProgress(item.steps);
  useBackToClose(true, onClose, { lockScroll: true });


  const addImages = (ids: string[]) => ids.length && onPatch({ images: [...item.images, ...ids] });

  const vision = (
    <section
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDropping(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDropping(false);
        if (e.dataTransfer.files.length) addImages(await saveImages(e.dataTransfer.files));
      }}
      className={cn("relative rounded-3xl", dropping && "ring-2 ring-crystal/60")}
    >
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[13px] font-medium text-muted">Visualization</h2>
        <span className="flex-1" />
        {item.images.length > 0 && (
          <button onClick={() => setManaging((m) => !m)} className="rounded-full px-2.5 py-1 text-[12px] text-faint transition-colors hover:text-fg">
            {managing ? "Done" : "Edit"}
          </button>
        )}
        <ImageUploadButton plain onAdd={addImages} className="h-8 rounded-full border border-line-strong px-3 text-[12px] text-muted hover:border-faint hover:text-fg">
          <ImagePlus className="size-3.5" /> Add
        </ImageUploadButton>
      </div>
      {item.images.length === 0 ? (
        <ImageUploadButton onAdd={addImages} className="aspect-[4/3] w-full flex-col gap-2 text-[14px]">
          <ImagePlus className="size-6" />
          Add images of what it looks like
          <span className="text-[12px] text-faint">Pick several at once — or drop them here</span>
        </ImageUploadButton>
      ) : (
        <div className="space-y-3">
          {item.images.map((id) => (
            <div key={id} className="relative">
              <StoredImage id={id} className="block h-auto min-h-32 w-full rounded-2xl bg-surface object-contain" />
              {managing && (
                <button
                  aria-label="Remove image"
                  onClick={async () => {
                    if (!(await confirmDialog("Remove this image?", { danger: true, confirmLabel: "Remove" }))) return;
                    deleteImages([id]);
                    onPatch({ images: item.images.filter((x) => x !== id) });
                  }}
                  className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition-colors hover:bg-danger"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const plan = (
    <section>
      <h2 className="mb-3 text-[13px] font-medium text-muted">Plan & progress</h2>
      <StepPlanner steps={item.steps} onChange={(steps) => onPatch({ steps })} emptyHint={`What are the steps from here to this ${kind}? Add the first one.`} />
    </section>
  );

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={item.title} className="animate-fade fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg">
      <div className="sticky top-0 z-10 bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-6">
          <IconButton label="Close" onClick={onClose} className="size-10 text-fg">
            <X className="size-5" />
          </IconButton>
          <span className="flex-1 text-[12px] text-faint capitalize">{kind}</span>
          <IconButton
            label={`Delete ${kind}`}
            onClick={async () => {
              if (!(await confirmDialog(`Delete “${item.title}”?`, { detail: "Its images and plan go with it.", danger: true }))) return;
              onDelete();
              onClose();
            }}
            className="size-10 hover:text-danger"
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-[max(4rem,env(safe-area-inset-bottom))] sm:px-6">
        {/* Who it is: icon, title, description — all editable in place. */}
        <header className="flex items-start gap-4 pt-2 sm:gap-5">
          <ImageUploadButton
            plain
            multiple={false}
            onAdd={([id]) => {
              if (!id) return;
              if (item.iconId) deleteImages([item.iconId]);
              onPatch({ iconId: id });
            }}
            className="group/icon relative size-16 shrink-0 overflow-hidden rounded-2xl sm:size-20"
          >
            <ObjectiveIcon iconId={item.iconId} fallback={fallbackIcon} className="size-full" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover/icon:opacity-100">
              <ImagePlus className="size-4 text-white" />
            </span>
            <span className="sr-only">Change icon</span>
          </ImageUploadButton>
          <div className="min-w-0 flex-1">
            <input
              value={item.title}
              onChange={(e) => e.target.value.trim() && onPatch({ title: e.target.value })}
              aria-label="Title"
              className="w-full bg-transparent text-[24px] leading-tight font-semibold tracking-[-0.02em] outline-none sm:text-[30px]"
            />
            <textarea
              value={item.description ?? ""}
              onChange={(e) => onPatch({ description: e.target.value })}
              aria-label="Description"
              placeholder="Add a description"
              rows={2}
              className="mt-1 block w-full resize-none bg-transparent text-[14.5px] leading-relaxed text-muted outline-none placeholder:text-faint [field-sizing:content]"
            />
            {details && <div className="mt-3">{details}</div>}
            {p.total > 0 && (
              <div className="mt-3 flex items-center gap-2 text-[12px] text-faint">
                <ProgressBar value={p.pct} tone="crystal" className="w-32" />
                <span className="tabular-nums">{p.pct}%</span>
              </div>
            )}
          </div>
        </header>

        {/* Phone: one pane at a time, vision first. Wide screens: side by side. */}
        <div className="mt-8 lg:hidden">
          <Segmented
            value={pane}
            onChange={setPane}
            options={[
              { value: "vision", label: "Visualization" },
              { value: "plan", label: `Plan · ${p.pct}%` },
            ]}
          />
          <div key={pane} className="animate-fade mt-6">
            {pane === "vision" ? vision : plan}
          </div>
        </div>
        <div className="mt-10 hidden gap-10 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {vision}
          <div className="lg:sticky lg:top-20 lg:self-start">{plan}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
