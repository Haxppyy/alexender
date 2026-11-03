"use client";

import { ChevronDown, ChevronUp, Clapperboard, Play, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { confirmDialog } from "@/components/dialog";
import { EditableText, EmptyState, Modal, toast } from "@/components/ui";
import { deleteVideo, formatSize, isVideo, saveVideo, useVideoUrl } from "@/lib/clips";
import { useStore } from "@/lib/store";
import type { Clip } from "@/lib/types";
import { useBackToClose } from "@/lib/useBackToClose";
import { formatDuration } from "@/lib/utils";

const nameOf = (file: File) => file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Clip";

/** Clips — videos you want close at hand, full width one after another. Kept on this device. */
export default function ClipsPage() {
  const clips = useStore((s) => s.clips);
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);

  const list = useMemo(() => [...clips].sort((a, b) => b.createdAt - a.createdAt), [clips]);

  return (
    <div className="mx-auto max-w-xl">
      <input
        ref={input}
        type="file"
        accept="video/*"
        multiple
        hidden
        onChange={(e) => {
          const videos = Array.from(e.target.files ?? []).filter(isVideo);
          if (e.target.files?.length && !videos.length) toast("Those aren't videos");
          setPicked(videos);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="mb-3 flex h-20 w-full items-center justify-center gap-3 rounded-3xl border border-dashed border-line-strong text-[17px] font-semibold text-muted transition-[border-color,color,transform] hover:border-crystal/60 hover:text-fg active:scale-[0.99]"
      >
        <Upload className="size-5" /> Upload a clip
      </button>
      <div className="mb-8" />

      {clips.length === 0 && <EmptyState icon={<Clapperboard className="size-5" />} title="Your clips" hint="Upload videos from your phone or computer — the speech that fires you up, a moment you're proud of, proof of how far you've come." />}

      {/* One after another, full width — like a visualization you scroll through. */}
      <ul className="space-y-8">
        {list.map((c) => (
          <li key={c.id}>
            <Tile clip={c} onPlay={() => setPlaying(c.id)} />
          </li>
        ))}
      </ul>

      {picked.length > 0 && <NameClips files={picked} onDone={() => setPicked([])} />}
      {playing && <Player ids={list.map((c) => c.id)} current={playing} onMove={setPlaying} onClose={() => setPlaying(null)} />}
    </div>
  );
}

/** Name each video before it's saved. */
function NameClips({ files, onDone }: { files: File[]; onDone: () => void }) {
  const addClip = useStore((s) => s.addClip);
  const [names, setNames] = useState(() => files.map(nameOf));
  const [saving, setSaving] = useState(false);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const save = async () => {
    setSaving(true);
    for (const [i, file] of files.entries()) {
      try {
        const saved = await saveVideo(file);
        addClip({ title: names[i].trim() || nameOf(file), ...saved });
      } catch {
        toast(`Couldn't save ${file.name} — the device may be out of space`);
      }
    }
    onDone();
  };

  return (
    <Modal open onClose={() => !saving && onDone()} title={files.length === 1 ? "Name this clip" : `Name ${files.length} clips`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-5"
      >
        {files.map((f, i) => (
          <div key={i} className="flex items-center gap-3">
            <video src={`${previews[i]}#t=0.1`} preload="metadata" muted playsInline className="h-20 w-16 shrink-0 rounded-xl bg-surface-2 object-cover" />
            <input
              autoFocus={i === 0}
              value={names[i]}
              onChange={(e) => setNames((n) => n.map((x, j) => (j === i ? e.target.value : x)))}
              onFocus={(e) => e.target.select()}
              aria-label={`Name for ${f.name}`}
              placeholder="Name"
              className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3.5 text-[16px] outline-none focus:border-line-strong"
            />
          </div>
        ))}
        <button type="submit" disabled={saving} className="h-12 w-full rounded-2xl bg-fg text-[15px] font-semibold text-bg transition-[transform,opacity] active:scale-[0.98] disabled:opacity-50">
          {saving ? "Saving…" : files.length === 1 ? "Save clip" : "Save clips"}
        </button>
      </form>
    </Modal>
  );
}

function Tile({ clip, onPlay }: { clip: Clip; onPlay: () => void }) {
  const url = useVideoUrl(clip.videoId);
  return (
    <button type="button" onClick={onPlay} className="group block w-full text-left">
      <span className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
        <span className="min-w-0 truncate text-[18px] font-semibold tracking-tight">{clip.title}</span>
        {clip.durationSec && <span className="shrink-0 text-[13px] text-faint tabular-nums">{formatDuration(clip.durationSec)}</span>}
      </span>
      <span className="relative block overflow-hidden rounded-3xl bg-surface-2">
        {/* The first frame, at the video's own shape. */}
        {url ? <video src={`${url}#t=0.1`} preload="metadata" muted playsInline className="animate-fade block max-h-[80dvh] min-h-48 w-full object-contain" /> : <span className="block aspect-video" />}
        <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/25">
          <span className="flex size-16 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform group-active:scale-90">
            <Play className="ml-1 size-7" fill="currentColor" />
          </span>
        </span>
      </span>
    </button>
  );
}

/** Full screen, playing at once. Swipe up or down (or the arrows) for the next clip. */
function Player({ ids, current, onMove, onClose }: { ids: string[]; current: string; onMove: (id: string) => void; onClose: () => void }) {
  const clip = useStore((s) => s.clips.find((c) => c.id === current));
  const { updateClip, deleteClip } = useStore.getState();
  const url = useVideoUrl(clip?.videoId);
  const touchY = useRef<number | null>(null);
  useBackToClose(true, onClose, { lockScroll: true });
  const i = ids.indexOf(current);
  if (!clip) return null;
  const go = (dir: 1 | -1) => ids[i + dir] && onMove(ids[i + dir]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={clip.title}
      className="animate-fade fixed inset-0 z-50 flex flex-col bg-black"
      onTouchStart={(e) => (touchY.current = e.touches[0].clientY)}
      onTouchEnd={(e) => {
        if (touchY.current === null) return;
        const dy = e.changedTouches[0].clientY - touchY.current;
        touchY.current = null;
        if (Math.abs(dy) > 70) go(dy < 0 ? 1 : -1);
      }}
    >
      <div className="flex shrink-0 items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button onClick={onClose} aria-label="Close" className="flex size-11 items-center justify-center rounded-full text-white/80 hover:bg-white/10">
          <X className="size-5" />
        </button>
        <EditableText value={clip.title} onSave={(title) => title && updateClip(clip.id, { title })} className="min-w-0 flex-1 truncate text-[17px] font-semibold text-white" />
        <span className="shrink-0 text-[12px] text-white/40 tabular-nums">
          {i + 1}/{ids.length}
        </span>
        <button
          aria-label="Delete clip"
          onClick={async () => {
            if (!(await confirmDialog(`Delete “${clip.title}”?`, { detail: "The video is removed from this device.", danger: true }))) return;
            deleteClip(clip.id);
            void deleteVideo(clip.videoId);
            const next = ids[i + 1] ?? ids[i - 1];
            if (next) onMove(next);
            else onClose();
          }}
          className="flex size-11 items-center justify-center rounded-full text-white/60 hover:text-danger"
        >
          <Trash2 className="size-[18px]" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        {url && <video key={url} src={url} controls autoPlay playsInline className="animate-fade absolute inset-0 size-full object-contain" />}
        <div className="absolute right-2 bottom-20 flex flex-col gap-2">
          {i > 0 && (
            <button onClick={() => go(-1)} aria-label="Previous clip" className="flex size-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm">
              <ChevronUp className="size-6" />
            </button>
          )}
          {i < ids.length - 1 && (
            <button onClick={() => go(1)} aria-label="Next clip" className="flex size-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm">
              <ChevronDown className="size-6" />
            </button>
          )}
        </div>
      </div>
      <p className="shrink-0 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[12px] text-white/40">
        {new Date(clip.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })} · {formatSize(clip.size)}
      </p>
    </div>,
    document.body,
  );
}
