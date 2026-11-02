"use client";

import { Check, ChevronLeft, ChevronRight, ImagePlus, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SectionProgress } from "@/components/SectionProgress";
import { Button, IconButton, ImageUploadButton, Input, Modal, SectionTop, StoredImage, Textarea } from "@/components/ui";
import { deleteImages } from "@/lib/images";
import { useClock, useStore } from "@/lib/store";
import { STORIES } from "@/lib/stories";
import type { MyStory } from "@/lib/types";
import { overlaysOpen, useBackToClose } from "@/lib/useBackToClose";
import { confirmDialog } from "@/components/dialog";

/** One story as the page shows it — a built-in one or one you added. */
interface Item {
  key: string;
  person: string;
  title: string;
  when?: string;
  where?: string;
  body: string[];
  lesson?: string;
  source?: string;
  caption?: string;
  credit?: string;
  src?: string;
  imageId?: string;
  mine?: MyStory;
}

const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

function toItem(s: MyStory): Item {
  return { key: s.id, person: s.person, title: s.title || s.person, when: s.when, body: paragraphs(s.story), lesson: s.lesson, source: s.source, imageId: s.imageId, mine: s };
}

/** A story's picture: a built-in image file, or a photo you uploaded. Lists use a small thumbnail. */
function Picture({ item, className, alt = "", thumb }: { item: Item; className?: string; alt?: string; thumb?: boolean }) {
  if (item.imageId) return <StoredImage id={item.imageId} alt={alt} className={className} />;
  if (item.src) {
    const src = thumb && item.src.startsWith("/stories/") ? item.src.replace("/stories/", "/stories/thumbs/") : item.src;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} loading="lazy" decoding="async" className={className} />;
  }
  return <div aria-hidden className={`bg-surface-2 ${className ?? ""}`} />;
}

/** True stories of great people — the ones you add first, then the collection. */
export default function StoriesPage() {
  const today = useClock((s) => s.today);
  const myStories = useStore((s) => s.myStories);
  const storiesRead = useStore((s) => s.storiesRead);
  const [open, setOpen] = useState<number | null>(null);
  const [editing, setEditing] = useState<MyStory | "new" | null>(null);

  const items: Item[] = [
    ...[...myStories].sort((a, b) => b.createdAt - a.createdAt).map(toItem),
    ...STORIES.map((s) => ({ ...s, key: s.id, caption: s.imageCaption, src: s.image })),
  ];
  // One story is featured each day, cycling through them all.
  const dayNumber = Math.floor(new Date(today).getTime() / 86_400_000);
  const featured = ((dayNumber % items.length) + items.length) % items.length;
  const hero = items[featured];
  const read = new Set(storiesRead.map((r) => r.id));
  const readCount = items.filter((item) => read.has(item.key)).length;

  return (
    <div className="mx-auto max-w-2xl">
      <SectionTop>
        <button
          onClick={() => setEditing("new")}
          className="group inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-4 text-[13px] font-medium text-muted transition-[border-color,color,transform] duration-200 hover:border-faint hover:text-fg active:scale-[0.97]"
        >
          <ImagePlus className="size-3.5" /> Add story
        </button>
      </SectionTop>

      <button
        onClick={() => setOpen(featured)}
        className="group relative block w-full overflow-hidden rounded-3xl border border-line bg-surface text-left transition-transform duration-200 active:scale-[0.99]"
      >
        <Picture item={hero} alt={hero.caption ?? hero.person} className="aspect-[16/10] w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <p className="text-[11px] font-medium text-white/60">Today&apos;s story · {hero.person}</p>
          <p className="mt-1 text-[24px] leading-tight font-semibold tracking-tight text-white sm:text-[30px]">{hero.title}</p>
          {hero.when && <p className="mt-1 text-[12px] text-white/60">{hero.when}</p>}
        </div>
      </button>

      <SectionProgress value={(readCount / items.length) * 100} label="read" detail={`${readCount} of ${items.length} stories`} />

      <ul className="stagger mt-10">
        {items.map((item, i) => (
          <li key={item.key} style={{ ["--i" as string]: Math.min(i, 12) }}>
            <button
              onClick={() => setOpen(i)}
              className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-4 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-surface active:bg-surface"
            >
              <Picture item={item} thumb className="h-[76px] w-[60px] shrink-0 rounded-xl bg-surface-2 object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-faint">{item.person}</span>
                <span className="mt-0.5 block text-[15.5px] leading-snug font-medium">{item.title}</span>
                {item.when && <span className="mt-0.5 block text-[12px] text-faint">{item.when}</span>}
              </span>
              {read.has(item.key) ? <Check aria-label="Read" className="size-4 shrink-0 text-crystal/80" /> : <ChevronRight className="size-4 shrink-0 text-faint" />}
            </button>
          </li>
        ))}
      </ul>

      {open !== null && items[open] && (
        <Reader
          items={items}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          onEdit={(story) => setEditing(story)}
        />
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add a story" : "Edit story"} wide>
        {editing !== null && (
          <StoryForm
            key={editing === "new" ? "new" : editing.id}
            story={editing === "new" ? undefined : editing}
            onDone={(deleted) => {
              setEditing(null);
              if (deleted) setOpen(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

/** Add or edit your own story: who, their picture, and what happened. */
function StoryForm({ story, onDone }: { story?: MyStory; onDone: (deleted?: boolean) => void }) {
  const { addMyStory, updateMyStory, deleteMyStory } = useStore.getState();
  const [person, setPerson] = useState(story?.person ?? "");
  const [title, setTitle] = useState(story?.title ?? "");
  const [when, setWhen] = useState(story?.when ?? "");
  const [text, setText] = useState(story?.story ?? "");
  const [lesson, setLesson] = useState(story?.lesson ?? "");
  const [source, setSource] = useState(story?.source ?? "");
  const [imageId, setImageId] = useState(story?.imageId);
  const ready = person.trim() && text.trim();

  // Photos picked but not kept are removed, so nothing is left behind.
  const discardPicked = (keep?: string) => {
    if (imageId && imageId !== story?.imageId && imageId !== keep) deleteImages([imageId]);
  };

  const save = () => {
    if (!ready) return;
    const fields = {
      person: person.trim(),
      title: title.trim() || person.trim(),
      story: text.trim(),
      imageId,
      when: when.trim() || undefined,
      lesson: lesson.trim() || undefined,
      source: source.trim() || undefined,
    };
    if (story) {
      if (story.imageId && story.imageId !== imageId) deleteImages([story.imageId]);
      updateMyStory(story.id, fields);
    } else addMyStory(fields);
    onDone();
  };

  const field = "mb-1.5 block text-[12px] text-faint";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-4"
    >
      <div className="flex items-start gap-4">
        <ImageUploadButton
          plain
          multiple={false}
          onAdd={([id]) => {
            if (!id) return;
            discardPicked(id);
            setImageId(id);
          }}
          className="relative h-[120px] w-[96px] shrink-0 overflow-hidden rounded-2xl border border-dashed border-line-strong text-faint hover:border-faint hover:text-muted"
        >
          {imageId ? (
            <StoredImage id={imageId} className="size-full" />
          ) : (
            <span className="flex flex-col items-center gap-1.5 text-[11px]">
              <ImagePlus className="size-5" />
              Their photo
            </span>
          )}
        </ImageUploadButton>
        <div className="min-w-0 flex-1 space-y-3">
          <label className="block">
            <span className={field}>Who</span>
            <Input autoFocus value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Chanakya" />
          </label>
          <label className="block">
            <span className={field}>Title</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The vow to remove the Nanda king" />
          </label>
        </div>
      </div>
      <label className="block">
        <span className={field}>When and where · optional</span>
        <Input value={when} onChange={(e) => setWhen(e.target.value)} placeholder="4th century BC · Magadha" />
      </label>
      <label className="block">
        <span className={field}>The story</span>
        <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="What happened, and why it took courage. Leave a blank line between paragraphs." />
      </label>
      <label className="block">
        <span className={field}>What it teaches · optional</span>
        <Input value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder="One line to remember" />
      </label>
      <label className="block">
        <span className={field}>Source · optional</span>
        <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Book, article or link" />
      </label>
      <div className="flex items-center gap-2 pt-1">
        {story && (
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={async () => {
              if (!(await confirmDialog(`Delete “${story.title}”?`, { danger: true }))) return;
              discardPicked();
              deleteMyStory(story.id);
              onDone(true);
            }}
          >
            <Trash2 className="size-3.5" /> Delete
          </Button>
        )}
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            discardPicked();
            onDone();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!ready}>
          {story ? "Save" : "Add story"}
        </Button>
      </div>
    </form>
  );
}

/** Full-screen reader: the image, the story, what it teaches, and where it comes from. */
function Reader({ items, index, onIndex, onClose, onEdit }: { items: Item[]; index: number; onIndex: (i: number) => void; onClose: () => void; onEdit: (story: MyStory) => void }) {
  const item = items[index];
  const markStoryRead = useStore((s) => s.markStoryRead);
  useBackToClose(true, onClose, { lockScroll: true });

  // Opening a story counts as reading it.
  useEffect(() => {
    markStoryRead(item.key);
  }, [item.key, markStoryRead]);

  // Arrow keys turn the page — but not while editing a story on top, or typing anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overlaysOpen() > 1 || (e.target as HTMLElement | null)?.closest?.("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, items.length, onIndex]);

  const meta = [item.person, item.when, item.where].filter(Boolean).join(" · ");
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={item.title} className="animate-fade fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg">
      <div className="sticky top-0 z-10 flex items-center gap-1 bg-bg/85 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur-xl sm:px-6">
        <IconButton label="Back to stories" onClick={onClose} className="size-10 text-fg">
          <X className="size-5" />
        </IconButton>
        <span className="flex-1 text-center text-[12px] text-faint tabular-nums">
          {index + 1} / {items.length}
        </span>
        {item.mine ? (
          <IconButton label="Edit story" onClick={() => onEdit(item.mine!)} className="size-10">
            <Pencil className="size-4" />
          </IconButton>
        ) : (
          <span className="size-10" />
        )}
      </div>

      {/* Keyed so each story fades in fresh. */}
      <article key={item.key} className="animate-fade mx-auto max-w-2xl px-4 pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-6">
        {(item.src || item.imageId) && (
          <figure className="mt-2">
            <Picture item={item} alt={item.caption ?? item.person} className="max-h-[58dvh] w-full rounded-2xl bg-surface object-contain" />
            {item.caption && (
              <figcaption className="mt-2 text-[11.5px] leading-snug text-faint">
                {item.caption} {item.credit && <span className="text-faint/70">· {item.credit}</span>}
              </figcaption>
            )}
          </figure>
        )}

        <p className="mt-8 text-[12px] text-faint">{meta}</p>
        <h1 className="mt-1.5 text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance sm:text-[34px]">{item.title}</h1>

        <div className="mt-6 space-y-4 text-[16.5px] leading-[1.75] whitespace-pre-line text-fg/90">
          {item.body.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        {item.lesson && <p className="mt-8 border-l-2 border-crystal/70 py-1 pl-4 text-[15px] leading-relaxed text-fg">{item.lesson}</p>}
        {item.source && <p className="mt-6 text-[12px] break-words text-faint">Source: {item.source}</p>}

        <nav className="mt-12 grid grid-cols-2 gap-3">
          {index > 0 ? (
            <button onClick={() => onIndex(index - 1)} className="flex items-center gap-2 rounded-2xl border border-line px-4 py-3 text-left transition-colors hover:bg-surface">
              <ChevronLeft className="size-4 shrink-0 text-faint" />
              <span className="min-w-0">
                <span className="block text-[11px] text-faint">Previous</span>
                <span className="block truncate text-[13.5px]">{items[index - 1].title}</span>
              </span>
            </button>
          ) : (
            <span />
          )}
          {index < items.length - 1 && (
            <button onClick={() => onIndex(index + 1)} className="flex items-center justify-end gap-2 rounded-2xl border border-line px-4 py-3 text-right transition-colors hover:bg-surface">
              <span className="min-w-0">
                <span className="block text-[11px] text-faint">Next</span>
                <span className="block truncate text-[13.5px]">{items[index + 1].title}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-faint" />
            </button>
          )}
        </nav>
      </article>
    </div>,
    document.body,
  );
}
