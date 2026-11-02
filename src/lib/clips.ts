"use client";

import { clear, createStore, del, get, set, type UseStore } from "idb-keyval";
import { useEffect, useState } from "react";
import { uid } from "./utils";

// Videos live in their own IndexedDB store, on this device only — they are far too big to sync.
let store: UseStore | undefined;
const clipStore = () => (store ??= createStore("alexender-clips", "videos"));

const urlCache = new Map<string, string>();

export const isVideo = (file: File) => file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv|3gp|avi)$/i.test(file.name);

/** How long a video runs, read from the file itself. */
function readDuration(blob: Blob): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    const done = (d?: number) => {
      URL.revokeObjectURL(url);
      resolve(d && Number.isFinite(d) ? d : undefined);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => done(video.duration);
    video.onerror = () => done();
    setTimeout(() => done(), 5000);
    video.src = url;
  });
}

export async function saveVideo(file: File) {
  const videoId = uid();
  await set(videoId, file, clipStore());
  return { videoId, type: file.type || "video/mp4", size: file.size, durationSec: await readDuration(file) };
}

export async function deleteVideo(id: string) {
  await del(id, clipStore());
  const url = urlCache.get(id);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(id);
}

export async function clearVideos() {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
  await clear(clipStore());
}

export function useVideoUrl(id?: string) {
  const [url, setUrl] = useState<string | null>(id ? (urlCache.get(id) ?? null) : null);
  useEffect(() => {
    let alive = true;
    if (id && !urlCache.has(id))
      get<Blob>(id, clipStore()).then((blob) => {
        if (!blob) return;
        const u = URL.createObjectURL(blob);
        urlCache.set(id, u);
        if (alive) setUrl(u);
      });
    return () => {
      alive = false;
    };
  }, [id]);
  return id ? (urlCache.get(id) ?? url) : null;
}

/** "12 MB". */
export const formatSize = (bytes: number) =>
  bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : bytes >= 1e6 ? `${Math.round(bytes / 1e6)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
