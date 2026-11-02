"use client";

import { ChevronLeft, ChevronRight, Clapperboard, Play, Trash2, Upload, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { confirmDialog } from "@/components/dialog";
import { EditableText, EmptyState, toast } from "@/components/ui";
import { deleteVideo, formatSize, isVideo, saveVideo, useVideoUrl } from "@/lib/clips";
import { useStore } from "@/lib/store";
import type { Clip } from "@/lib/types";
import { useBackToClose } from "@/lib/useBackToClose";
import { formatDuration } from "@/lib/utils";

/** Clips — short videos you want close at hand: motivation, moments, proof. Kept on this device. */
export default function ClipsPage() {
  const clips = useStore((s) => s.clips);
  const addClip = useStore((s) => s.addClip);
  const input = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const list = useMemo(() => [...clips].sort((a, b) => b.createdAt - a.createdAt), [clips]);
  const size = clips.reduce((n, c) => n + c.size, 0);

  const upload = async (files: FileList) => {
    const videos = Array.from(files).filter(isVideo);
    if (!videos.length) return toast("Those aren't videos");
    setSaving({ done: 0, total: videos.length });
    for (const [i, file] of videos.entries()) {
      try {
        const saved = await saveVideo(file);
        addClip({ title: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Clip", ...saved });
      } catch {
        toast(`Couldn't save ${file.name} — the device may be out of space`);
      }
      setSaving({ done: i + 1, total: videos.length });
    }
    setSaving(null);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <input
        ref={input}
        type="file"
        accept="video/*"
        multiple
        hidden
        onChange={async (e) => {
          if (e.target.files?.length) await upload(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={!!saving}
        onClick={() => input.current?.click()}
        className="mb-3 flex h-20 w-full items-center justify-center gap-3 rounded-3xl border border-dashed border-line-strong text-[17px] font-semibold text-muted transition-[border-color,color,transform] hover:border-crystal/60 hover:text-fg active:scale-[0.99] disabled:opacity-60"
      >
        <Upload className="size-5" />
        {saving ? `Saving ${saving.done + 1 > saving.total ? saving.total : saving.done + 1} of ${saving.total}…` : "Upload clips"}
      </button>
      <p className="mb-8 text-center text-[12.5px] text-faint">
        {clips.length ? `${clips.length} ${clips.length === 1 ? "clip" : "clips"} · ${formatSize(size)} · ` : ""}Kept on this device only — not synced, not in backups.
      </p>

      {clips.length === 0 && <EmptyState icon={<Clapperboard className="size-5" />} title="Your clips" hint="Upload videos from your phone or computer — the speech that fires you up, a moment you're proud of, proof of how far you've come." />}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {list.map((c) => (
          <li key={c.id}>
            <Tile clip={c} onPlay={() => setPlaying(c.id)} />
          </li>
        ))}
      </ul>

      {playing && <Player ids={list.map((c) => c.id)} current={playing} onMove={setPlaying} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function Tile({ clip, onPlay }: { clip: Clip; onPlay: () => void }) {
  const url = useVideoUrl(clip.videoId);
  return (
    <button type="button" onClick={onPlay} className="group block w-full text-left">
      <span className="relative block aspect-[4/5] overflow-hidden rounded-3xl bg-surface-2 ring-1 ring-line">
        {/* The first frame stands in for a thumbnail. */}
        {url && <video src={`${url}#t=0.1`} preload="metadata" muted playsInline className="animate-fade size-full object-cover" />}
        <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/30">
          <span className="flex size-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform group-active:scale-90">
            <Play className="ml-0.5 size-5" fill="currentColor" />
          </span>
        </span>
        {clip.durationSec && <span className="absolute right-2.5 bottom-2.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[11.5px] font-medium text-white tabular-nums">{formatDuration(clip.durationSec)}</span>}
      </span>
      <span className="mt-2 block truncate px-1 text-[14.5px] font-medium">{clip.title}</span>
    </button>
  );
}

/** Full screen, playing at once. Swipe-free arrows to the next and previous clip. */
function Player({ ids, current, onMove, onClose }: { ids: string[]; current: string; onMove: (id: string) => void; onClose: () => void }) {
  const clip = useStore((s) => s.clips.find((c) => c.id === current));
  const { updateClip, deleteClip } = useStore.getState();
  const url = useVideoUrl(clip?.videoId);
  useBackToClose(true, onClose, { lockScroll: true });
  const i = ids.indexOf(current);
  if (!clip) return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={clip.title} className="animate-fade fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex shrink-0 items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button onClick={onClose} aria-label="Close" className="flex size-11 items-center justify-center rounded-full text-white/80 hover:bg-white/10">
          <X className="size-5" />
        </button>
        <EditableText value={clip.title} onSave={(title) => title && updateClip(clip.id, { title })} className="min-w-0 flex-1 truncate text-[16px] font-medium text-white" />
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
        {url && <video key={url} src={url} controls autoPlay playsInline className="absolute inset-0 size-full object-contain" />}
        {i > 0 && (
          <button onClick={() => onMove(ids[i - 1])} aria-label="Previous clip" className="absolute top-1/2 left-2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
            <ChevronLeft className="size-6" />
          </button>
        )}
        {i < ids.length - 1 && (
          <button onClick={() => onMove(ids[i + 1])} aria-label="Next clip" className="absolute top-1/2 right-2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>
      <p className="shrink-0 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[12px] text-white/40">
        {new Date(clip.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })} · {formatSize(clip.size)}
      </p>
    </div>,
    document.body,
  );
}
