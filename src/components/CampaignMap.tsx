"use client";

import { Crosshair, Minus, Plus, Swords } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { addDays } from "@/lib/date";
import { along, campaignOrder, experience, ROAD, SITES, stationsFor, WORLD, XP_PER_PERFECT_DAY, XP_PER_TASK, type Pt } from "@/lib/expedition";
import { smooth, tap } from "@/lib/motion";
import { useClock, useStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BLOOD, INK, INK_SOFT, PAPER, SERIF, World } from "./campaign/World";
import { openRewards, useUnclaimed } from "./Ceremony";
import { Modal } from "./ui";

/*
 * Campaign — the day as an expedition across the ancient world, on Alexander's own road from
 * Pella to the edge of the known world. The map is the whole screen and the whole interface:
 * drag to travel, pinch or scroll to zoom. Each task is a city on the road. Take one and your
 * standard marches there, the fog lifts from the land around it and a banner goes up; give one up
 * and it burns. Lands you haven't reached stay under cloud. The treasure waits at the end and
 * only opens on a perfect day. Every task taken, ever, is experience; experience is rank.
 */

const TILT = 13; // degrees the table is tipped away from you
const MAX_Z = 2.4;

type Cam = { x: number; y: number; z: number };
type Day = "today" | "tomorrow";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const hash = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);

/** A sheet of paper grain, made once and tiled under the map. */
let grain: string | null = null;
function paperGrain() {
  if (grain || typeof document === "undefined") return grain;
  const c = document.createElement("canvas");
  c.width = c.height = 220;
  const g = c.getContext("2d")!;
  const img = g.createImageData(220, 220);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 150 + Math.random() * 105;
    img.data[i] = v;
    img.data[i + 1] = v * 0.93;
    img.data[i + 2] = v * 0.8;
    img.data[i + 3] = 34;
  }
  g.putImageData(img, 0, 0);
  grain = c.toDataURL();
  return grain;
}

/** Wrap a name into at most two short lines. */
function wrap(text: string, width = 20): string[] {
  const lines: string[] = [""];
  for (const w of text.split(/\s+/)) {
    const cur = lines[lines.length - 1];
    if ((cur + " " + w).trim().length <= width) lines[lines.length - 1] = (cur + " " + w).trim();
    else if (lines.length < 2) lines.push(w);
    else {
      lines[1] = `${lines[1].slice(0, width - 1).trimEnd()}…`;
      break;
    }
  }
  if (lines[0].length > width) lines[0] = `${lines[0].slice(0, width - 1)}…`;
  return lines.filter(Boolean);
}

export function Campaign() {
  const today = useClock((s) => s.today);
  const now = useClock((s) => s.now);
  const [day, setDay] = useState<Day>("today");
  const date = day === "today" ? today : addDays(today, 1);
  const all = useStore((s) => s.tasks);
  const achievements = useStore((s) => s.achievements);
  const unclaimed = useUnclaimed();
  const [picked, setPicked] = useState<Task | null>(null);

  // The day's campaign.
  const tasks = useMemo(() => campaignOrder(all.filter((t) => t.date === date)), [all, date]);
  const stations = useMemo(() => stationsFor(tasks.length), [tasks.length]);
  const done = tasks.filter((t) => t.done).length;
  const fallen = tasks.filter((t) => t.failed).length;
  const resolved = done + fallen;
  const total = tasks.length;
  const won = total > 0 && done === total;
  const lost = fallen > 0;
  const heroIndex = won ? total + 1 : resolved; // 0 camp · k the k-th city · total+1 the treasure
  const heroTarget = heroIndex === 0 ? 0 : heroIndex > total ? ROAD.total : stations[heroIndex - 1].d;
  const next = tasks.find((t) => !t.done && !t.failed);
  const nextIndex = next ? tasks.indexOf(next) : -1;

  // Rank and experience, from everything ever taken.
  const exp = useMemo(() => experience(all.filter((t) => t.done).length, achievements.filter((a) => a.id.startsWith("perfect-day:")).length), [all, achievements]);
  const todayXp = done * XP_PER_TASK + (won ? XP_PER_PERFECT_DAY : 0);

  // ---------- The camera ----------
  const viewport = useRef<HTMLDivElement>(null);
  const worldEl = useRef<HTMLDivElement>(null);
  const cloudsEl = useRef<HTMLDivElement>(null);
  const cam = useRef<Cam>({ x: WORLD.w / 2, y: WORLD.h / 2, z: 0.3 });
  const view = useRef({ w: 375, h: 640 });
  const flight = useRef<number | null>(null);
  const follow = useRef(true);

  const minZ = () => Math.max(view.current.w / WORLD.w, view.current.h / WORLD.h) * 1.04;
  const fit = (c: Cam): Cam => {
    const z = clamp(c.z, minZ(), MAX_Z);
    const hw = view.current.w / 2 / z;
    const hh = view.current.h / 2 / z;
    return { z, x: clamp(c.x, hw, WORLD.w - hw), y: clamp(c.y, hh, WORLD.h - hh) };
  };
  const apply = () => {
    const { x, y, z } = (cam.current = fit(cam.current));
    const { w, h } = view.current;
    moving();
    if (worldEl.current) worldEl.current.style.transform = `translate3d(${w / 2 - x * z}px, ${h / 2 - y * z}px, 0) scale(${z})`;
    // Clouds drift at their own height: they slide a little slower than the land beneath.
    if (cloudsEl.current) cloudsEl.current.style.transform = `translate3d(${-x * z * 0.18}px, ${-y * z * 0.18}px, 0)`;
  };
  // While the map moves it's treated as one picture (smooth); once still, it's redrawn sharp.
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const moving = () => {
    if (worldEl.current) worldEl.current.style.willChange = "transform";
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      if (worldEl.current) worldEl.current.style.willChange = "auto";
    }, 260);
  };
  const stopFlight = () => {
    if (flight.current) cancelAnimationFrame(flight.current);
    flight.current = null;
  };
  const flyTo = (to: Partial<Cam>, ms = 1300) => {
    stopFlight();
    const from = { ...cam.current };
    const target = fit({ ...from, ...to });
    const t0 = performance.now();
    const step = (t: number) => {
      const k = ease(Math.min(1, (t - t0) / ms));
      // Long flights pull up a little on the way, like a camera rising to travel.
      const lift = 1 - Math.sin(k * Math.PI) * clamp(Math.hypot(target.x - from.x, target.y - from.y) / 2400, 0, 0.35);
      cam.current = { x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k, z: (from.z + (target.z - from.z) * k) * lift };
      apply();
      flight.current = k < 1 ? requestAnimationFrame(step) : null;
    };
    flight.current = requestAnimationFrame(step);
  };

  // ---------- Your standard on the march ----------
  const heroEl = useRef<SVGGElement>(null);
  const lightEl = useRef<SVGCircleElement>(null);
  const heroD = useRef<number | null>(null);
  const heroTargetRef = useRef(heroTarget);
  const lastDate = useRef(date);
  const [arrival, setArrival] = useState<(Pt & { key: number; xp: number }) | null>(null);

  const placeHero = (d: number) => {
    const p = along(d);
    heroEl.current?.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    lightEl.current?.setAttribute("cx", p.x.toFixed(1));
    lightEl.current?.setAttribute("cy", p.y.toFixed(1));
    return p;
  };

  // Size, and the opening shot: the whole world, then down to where you stand.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const measure = () => {
      view.current = { w: el.clientWidth, h: el.clientHeight };
      apply();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    cam.current = { x: WORLD.w / 2, y: WORLD.h / 2, z: minZ() };
    apply();
    const p = along(heroTargetRef.current);
    const t = setTimeout(() => flyTo({ x: p.x, y: p.y, z: 1.1 }, 2400), 450);
    return () => {
      ro.disconnect();
      clearTimeout(t);
      stopFlight();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    heroTargetRef.current = heroTarget;
    const from = heroD.current;
    // A new day on the map: stand where that day stands, no march.
    if (from === null || lastDate.current !== date) {
      const switched = from !== null;
      lastDate.current = date;
      heroD.current = heroTarget;
      const p = placeHero(heroTarget);
      if (switched) flyTo({ x: p.x, y: p.y, z: Math.max(cam.current.z, 0.9) }, 1200);
      return;
    }
    if (from === heroTarget) return;
    const forward = heroTarget > from;
    const dur = clamp(Math.abs(heroTarget - from) * 2, 1300, 4200);
    const t0 = performance.now();
    follow.current = true;
    stopFlight();
    heroEl.current?.classList.add("cmp-marching");
    let frame = 0;
    const step = (t: number) => {
      const k = ease(Math.min(1, (t - t0) / dur));
      const d = from + (heroTarget - from) * k;
      heroD.current = d;
      const p = placeHero(d);
      if (follow.current) {
        cam.current = { ...cam.current, x: cam.current.x + (p.x - cam.current.x) * 0.12, y: cam.current.y + (p.y - cam.current.y) * 0.12 };
        apply();
      }
      if (k < 1) frame = requestAnimationFrame(step);
      else {
        heroEl.current?.classList.remove("cmp-marching");
        // Arrived: a burst of light, and the experience it brought.
        const arrived = tasks[heroIndex - 1];
        if (forward && (heroIndex > total || arrived?.done)) {
          tap(26);
          setArrival({ ...p, key: Date.now(), xp: heroIndex > total ? XP_PER_PERFECT_DAY : XP_PER_TASK });
        }
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroTarget, date]);

  // ---------- Travelling by hand: drag, pinch, wheel ----------
  const dragged = useRef(false);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const pts = new Map<number, Pt>();
    let start: { cam: Cam; mid: Pt; dist: number } | null = null;
    const cos = Math.cos((TILT * Math.PI) / 180);
    const local = (e: PointerEvent | WheelEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const midOf = () => {
      const list = [...pts.values()];
      return {
        list,
        mid: { x: list.reduce((s, p) => s + p.x, 0) / list.length, y: list.reduce((s, p) => s + p.y, 0) / list.length },
        dist: list.length > 1 ? Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y) : 0,
      };
    };
    const snapshot = () => {
      const { mid, dist } = midOf();
      start = { cam: { ...cam.current }, mid, dist };
    };
    const down = (e: PointerEvent) => {
      if ((e.target as Element).closest("[data-ui]")) return;
      pts.set(e.pointerId, local(e));
      if (pts.size === 1) dragged.current = false;
      stopFlight();
      snapshot();
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId) || !start) return;
      pts.set(e.pointerId, local(e));
      const { list, mid, dist } = midOf();
      if (!dragged.current && Math.hypot(mid.x - start.mid.x, mid.y - start.mid.y) < 6 && list.length < 2) return;
      if (!dragged.current) {
        dragged.current = true;
        follow.current = false;
        el.setPointerCapture(e.pointerId);
      }
      const z = list.length > 1 && start.dist > 0 ? clamp(start.cam.z * (dist / start.dist), minZ(), MAX_Z) : start.cam.z;
      // Keep the ground under your fingers under your fingers.
      const { w, h } = view.current;
      const wx = start.cam.x + (start.mid.x - w / 2) / start.cam.z;
      const wy = start.cam.y + (start.mid.y - h / 2) / (start.cam.z * cos);
      cam.current = { z, x: wx - (mid.x - w / 2) / z, y: wy - (mid.y - h / 2) / (z * cos) };
      apply();
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size) snapshot();
      else start = null;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      stopFlight();
      follow.current = false;
      const p = local(e);
      const { w, h } = view.current;
      const c = cam.current;
      const z = clamp(c.z * Math.exp(-e.deltaY * 0.0015), minZ(), MAX_Z);
      const wx = c.x + (p.x - w / 2) / c.z;
      const wy = c.y + (p.y - h / 2) / c.z;
      cam.current = { z, x: wx - (p.x - w / 2) / z, y: wy - (p.y - h / 2) / z };
      apply();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomBy = (k: number) => {
    follow.current = false;
    flyTo({ z: cam.current.z * k }, 420);
  };
  const locate = () => {
    follow.current = true;
    const p = along(heroD.current ?? heroTarget);
    flyTo({ x: p.x, y: p.y, z: Math.max(1.1, cam.current.z) }, 1000);
  };
  const goTo = (i: number) => {
    const s = stations[i];
    if (!s) return;
    const p = along(s.d);
    follow.current = false;
    flyTo({ x: p.x, y: p.y, z: Math.max(1.15, cam.current.z) }, 1100);
    setTimeout(() => setPicked(tasks[i]), 700);
  };

  // ---------- What the fog has lifted from ----------
  const reveals = useMemo(() => {
    const out: (Pt & { r: number })[] = [{ ...SITES[0], r: 230 }];
    for (let d = 0; d < heroTarget; d += 110) out.push({ ...along(d), r: 150 });
    stations.forEach((s, i) => {
      if (i < resolved) out.push({ ...along(s.d), r: 230 });
      else if (i === resolved) out.push({ ...along(s.d), r: 120 }); // the next city, scouted
    });
    return out;
  }, [stations, resolved, heroTarget]);

  // Weather and light: a storm over a day with a fallen city, gold over a perfect one, and the
  // hour of the day in the colour of the air.
  const hour = now ? new Date(now).getHours() : 12;
  const tint = hour < 6 || hour >= 20 ? "night" : hour < 9 ? "dawn" : hour >= 17 ? "dusk" : "day";
  const weather = won ? "gold" : lost ? "storm" : "fair";
  const end = along(ROAD.total);

  return createPortal(
    <div className="fixed inset-x-0 top-[calc(3.5rem+1px+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 overflow-hidden bg-[#140e08] select-none lg:bottom-0 lg:left-56">
      {/* The table, tipped slightly away from you. */}
      <div
        ref={viewport}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        style={{ perspective: "1700px" }}
        onClickCapture={(e) => {
          if (dragged.current) {
            e.stopPropagation();
            e.preventDefault();
            dragged.current = false;
          }
        }}
      >
        <div className="absolute inset-0 origin-[50%_62%]" style={{ transform: `rotateX(${TILT}deg) scale(1.1)` }}>
          <div
            ref={worldEl}
            className="absolute top-0 left-0 origin-top-left"
            style={{
              width: WORLD.w,
              height: WORLD.h,
              backgroundColor: "#e4cf9f",
              backgroundImage: `url(${paperGrain() ?? ""}), radial-gradient(ellipse at 30% 30%, rgb(255 246 220 / 0.55), transparent 55%), radial-gradient(ellipse at 75% 70%, rgb(140 96 40 / 0.22), transparent 60%), radial-gradient(ellipse at 50% 50%, transparent 55%, rgb(70 40 12 / 0.55))`,
              boxShadow: "0 0 0 2px #3b2612, 0 40px 120px rgb(0 0 0 / 0.8)",
            }}
          >
            <World />
            <Journey
              tasks={tasks}
              stations={stations}
              resolved={resolved}
              nextIndex={nextIndex}
              heroTarget={heroTarget}
              won={won}
              reveals={reveals}
              heroRef={heroEl}
              lightRef={lightEl}
              arrival={arrival}
              onOpen={(t) => setPicked(t)}
              end={end}
            />
          </div>
        </div>

        {/* The air: drifting cloud shadows, the weather, the hour, the edges in shade. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div ref={cloudsEl} className="absolute -inset-[60%]">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="cmp-cloud" style={{ top: `${18 + i * 19}%`, animationDelay: `${i * -21}s`, animationDuration: `${70 + i * 18}s` } as CSSProperties} />
            ))}
          </div>
          {weather === "storm" && <div className="cmp-rain absolute inset-0" />}
          {weather === "gold" && <div className="cmp-sunrays absolute -inset-1/2" />}
          <div className={cn("absolute inset-0 transition-colors duration-1000", `cmp-tint-${tint}`, weather === "storm" && "cmp-tint-storm")} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgb(10 6 2 / 0.6))" }} />
        </div>
      </div>

      {/* Rank. */}
      <div data-ui className="cmp-panel absolute top-3 left-3 w-[calc(100%-11.75rem)] max-w-[15rem] rounded-2xl px-3.5 py-2.5" style={{ fontFamily: SERIF }}>
        <p className="flex items-baseline justify-between gap-2 text-[#3b2612]">
          <span className="truncate text-[15px] font-bold">{exp.title}</span>
          <span className="shrink-0 text-[11.5px] italic">Rank {exp.level}</span>
        </p>
        <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-[#3b2612]/15">
          <div className="h-full rounded-full bg-gradient-to-r from-[#8f2516] to-[#c9862a] transition-[width] duration-1000" style={{ width: `${(exp.into / exp.span) * 100}%` }} />
        </div>
        <p className="mt-1 flex justify-between text-[11px] text-[#6e4d2b] tabular-nums">
          <span>{exp.xp.toLocaleString()} XP</span>
          {todayXp > 0 && <span className="font-semibold text-[#8f2516]">+{todayXp} today</span>}
        </p>
      </div>

      {/* The day, and spoils waiting. */}
      <div data-ui className="absolute top-3 right-3 flex flex-col items-end gap-2">
        <div className="cmp-panel flex rounded-full p-1" style={{ fontFamily: SERIF }}>
          {(["today", "tomorrow"] as Day[]).map((d) => (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={cn("h-8 rounded-full px-2.5 text-[12.5px] capitalize transition-colors", day === d ? "bg-[#3b2612] text-[#f1e2bd]" : "text-[#3b2612]")}
            >
              {d}
            </button>
          ))}
        </div>
        {unclaimed.length > 0 && (
          <button onClick={openRewards} className="victory-claim flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold text-[#2a1a04]">
            <Swords className="size-4" /> Claim
          </button>
        )}
      </div>

      {/* Zoom, and find yourself. */}
      <div data-ui className="absolute top-1/2 right-3 flex -translate-y-1/2 flex-col gap-2">
        <button aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(1.45)} className="cmp-seal flex size-11 items-center justify-center rounded-full text-[#f3dcb0] transition-transform active:scale-90">
          <Plus className="size-[18px]" />
        </button>
        <button aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(1 / 1.45)} className="cmp-seal flex size-11 items-center justify-center rounded-full text-[#f3dcb0] transition-transform active:scale-90">
          <Minus className="size-[18px]" />
        </button>
        <button aria-label="Find my standard" title="Find my standard" onClick={() => locate()} className="cmp-seal flex size-11 items-center justify-center rounded-full text-[#f3dcb0] transition-transform active:scale-90">
          <Crosshair className="size-[18px]" />
        </button>
      </div>

      {/* The next expedition, on a scrap of paper. */}
      <div data-ui className="absolute bottom-3 left-3 right-[4.9rem] mx-auto max-w-md lg:right-3">
        <button
          onClick={() => (next ? goTo(nextIndex) : won && unclaimed.length ? openRewards() : locate())}
          className="cmp-panel flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-transform active:scale-[0.99]"
          style={{ fontFamily: SERIF }}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#8f2516] text-[#f6e1bf] shadow-[inset_0_-2px_4px_rgb(0_0_0/0.3)]">
            <Swords className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1 text-[#3b2612]">
            <span className="block text-[11px] tracking-[0.2em] text-[#6e4d2b] uppercase">
              {total === 0 ? "No expedition" : next ? `Expedition ${nextIndex + 1} of ${total}` : won ? "The treasure is yours" : "The march is over"}
            </span>
            <span className="mt-0.5 block truncate text-[16px] font-bold">
              {total === 0
                ? `Plan ${day === "today" ? "today" : "tomorrow"} on Today to set out`
                : next
                  ? next.title
                  : won
                    ? unclaimed.length
                      ? "Claim your reward"
                      : "Every city taken"
                    : `${fallen} ${fallen === 1 ? "city" : "cities"} fell — march again tomorrow`}
            </span>
            {next && <span className="block truncate text-[12.5px] text-[#6e4d2b] italic">{stations[nextIndex]?.name} · +{XP_PER_TASK} XP</span>}
          </span>
        </button>
      </div>

      <Modal open={!!picked} onClose={() => setPicked(null)} title={picked?.title}>
        {picked && <Battle task={picked} place={stations[tasks.indexOf(picked)]} onDone={() => setPicked(null)} />}
      </Modal>
    </div>,
    document.body,
  );
}

/** Fight for a city: take it, or fall back. */
function Battle({ task, place, onDone }: { task: Task; place?: { name: string; note: string }; onDone: () => void }) {
  const { toggleTask, toggleNotDone } = useStore.getState();
  const act = (fn: () => void, buzz: number) => {
    tap(buzz);
    onDone();
    // Let the sheet close, then the march begins.
    setTimeout(() => smooth(fn), 250);
  };
  return (
    <div className="space-y-3 pb-1">
      {place && (
        <p className="text-[14.5px] text-muted" style={{ fontFamily: SERIF }}>
          <span className="font-semibold text-fg italic">{place.name}</span> — {place.note}
          {!task.done && !task.failed && <span className="text-[#e0ac34]"> · +{XP_PER_TASK} XP</span>}
        </p>
      )}
      {!task.done && (
        <button onClick={() => act(() => toggleTask(task.id), 24)} className="victory-claim flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-bold text-[#2a1a04]">
          <Swords className="size-5" /> Conquer — it&apos;s done
        </button>
      )}
      {task.done && (
        <button onClick={() => act(() => toggleTask(task.id), 8)} className="h-12 w-full rounded-2xl border border-line-strong text-[15px] font-medium text-muted">
          Not taken after all
        </button>
      )}
      {!task.done && (
        <button onClick={() => act(() => toggleNotDone(task.id), 30)} className="h-12 w-full rounded-2xl border border-line-strong text-[15px] font-medium text-muted hover:text-danger">
          {task.failed ? "Take back — still fighting" : "Fall back — not done"}
        </button>
      )}
    </div>
  );
}

/**
 * Everything on the map that belongs to the day: the road marched in red, the cities, the fog
 * over what's still unknown, the treasure, your standard, and the light where you've just arrived.
 */
function Journey({
  tasks,
  stations,
  resolved,
  nextIndex,
  heroTarget,
  won,
  reveals,
  heroRef,
  lightRef,
  arrival,
  onOpen,
  end,
}: {
  tasks: Task[];
  stations: { d: number; name: string; note: string }[];
  resolved: number;
  nextIndex: number;
  heroTarget: number;
  won: boolean;
  reveals: (Pt & { r: number })[];
  heroRef: React.RefObject<SVGGElement | null>;
  lightRef: React.RefObject<SVGCircleElement | null>;
  arrival: (Pt & { key: number; xp: number }) | null;
  onOpen: (t: Task) => void;
  end: Pt;
}) {
  const marched = useMemo(() => {
    const pts: Pt[] = [];
    for (let d = 0; d <= heroTarget; d += 6) pts.push(along(d));
    pts.push(along(heroTarget));
    return `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L")}`;
  }, [heroTarget]);

  return (
    <svg width={WORLD.w} height={WORLD.h} viewBox={`0 0 ${WORLD.w} ${WORLD.h}`} className="absolute inset-0 block overflow-visible" fontFamily={SERIF}>
      <defs>
        <radialGradient id="j-hole">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.55" stopColor="#000" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="j-gold">
          <stop offset="0" stopColor="#fff3c2" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#f2cb5c" stopOpacity="0.45" />
          <stop offset="1" stopColor="#e0ac34" stopOpacity="0" />
        </radialGradient>
        <mask id="j-fog" maskUnits="userSpaceOnUse" x="0" y="0" width={WORLD.w} height={WORLD.h}>
          <rect width={WORLD.w} height={WORLD.h} fill="#fff" />
          {reveals.map((r, i) => (
            <circle key={i} cx={r.x} cy={r.y} r={r.r} fill="url(#j-hole)" className="j-reveal" />
          ))}
          <circle ref={lightRef} r="200" fill="url(#j-hole)" />
        </mask>
      </defs>

      {/* The road you've marched, in red. */}
      <path d={marched} fill="none" stroke={BLOOD} strokeWidth="5" strokeDasharray="12 8" strokeLinecap="round" opacity="0.9" />

      {/* The cities. */}
      {tasks.map((t, i) => {
        const s = stations[i];
        if (!s) return null;
        return <City key={t.id} task={t} station={s} next={i === nextIndex} onOpen={() => onOpen(t)} />;
      })}

      {/* The treasure at the end of the world. */}
      <Treasure x={end.x} y={end.y} won={won} />

      {/* Fog over the lands not yet reached; on a perfect day it lifts from everything. */}
      <g mask="url(#j-fog)" className={cn("j-fog", won && "j-fog-lifted")} pointerEvents="none">
        <rect width={WORLD.w} height={WORLD.h} fill="#2f2418" opacity="0.62" />
        {Array.from({ length: 46 }, (_, i) => {
          const x = (i * 431) % WORLD.w;
          const y = (i * 263) % WORLD.h;
          return <ellipse key={i} cx={x} cy={y} rx={150 + (i % 5) * 30} ry={70 + (i % 3) * 20} fill="#e9dfca" opacity="0.13" />;
        })}
      </g>

      {/* Cities still unknown, glimpsed through the cloud — and the treasure's light. */}
      {tasks.map((t, i) => {
        const s = stations[i];
        if (!s || i <= resolved || won) return null;
        const p = along(s.d);
        return (
          <g key={t.id} className="cursor-pointer" onClick={() => onOpen(t)} role="button" aria-label={`Unexplored: ${t.title}`}>
            <circle cx={p.x} cy={p.y} r="15" fill="#3b2612" stroke="#e9d6a7" strokeWidth="1.5" opacity="0.85" />
            <text x={p.x} y={p.y + 6} textAnchor="middle" fontSize="17" fontWeight="700" fill="#e9d6a7">
              ?
            </text>
          </g>
        );
      })}
      {!won && <circle cx={end.x} cy={end.y} r="70" fill="url(#j-gold)" className="cmp-beacon" pointerEvents="none" />}

      {/* Where you've just arrived: a burst of light, and the experience. */}
      {arrival && (
        <g key={arrival.key} transform={`translate(${arrival.x} ${arrival.y})`} pointerEvents="none">
          <circle r="22" fill="none" stroke="#f2cb5c" strokeWidth="3" className="cmp-burst-ring" />
          <g className="cmp-burst-rays">
            {Array.from({ length: 12 }, (_, i) => (
              <path key={i} d="M0 -26 L3 -60 L-3 -60 Z" fill="#f6d778" transform={`rotate(${i * 30})`} />
            ))}
          </g>
          <text y="-46" textAnchor="middle" fontSize="20" fontWeight="700" fill="#8f2516" stroke={PAPER} strokeWidth="4" paintOrder="stroke" className="cmp-xp">
            +{arrival.xp} XP
          </text>
        </g>
      )}

      {/* Your standard. */}
      <g ref={heroRef} className="cmp-hero" pointerEvents="none">
        <g transform="translate(-30 8)">
        <ellipse cy="3" rx="13" ry="4" fill="#000" opacity="0.25" />
        <g className="cmp-hero-body">
          <line x1="0" y1="0" x2="0" y2="-44" stroke={INK} strokeWidth="2" />
          <path d="M0 -44 L26 -38 Q20 -33 26 -28 L0 -30 Z" fill="#8f2516" stroke={INK} strokeWidth="1" className="cmp-flag" />
          <circle cy="-12" r="11" fill="#d9a63a" stroke={INK} strokeWidth="1.4" />
          {/* The Vergina sun on the shield. */}
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d="M0 -12 L1.6 -20 L-1.6 -20 Z" fill="#7a4c0c" transform={`rotate(${i * 45} 0 -12)`} />
          ))}
          <circle cy="-12" r="2.4" fill="#7a4c0c" />
        </g>
        </g>
      </g>
    </svg>
  );
}

/** A city on the road, drawn in ink — with a banner once it's yours, smoke if it fell. */
function City({ task, station, next, onOpen }: { task: Task; station: { d: number; name: string; note: string }; next: boolean; onOpen: () => void }) {
  const p = along(station.d);
  const kind = hash(task.id) % 4;
  const state = task.done ? "won" : task.failed ? "fallen" : "ahead";
  // Write the name on the side away from the road.
  const nx = -Math.sin(p.angle);
  const ny = Math.cos(p.angle);
  const flip = Math.abs(Math.cos(p.angle)) > 0.55 ? ny < 0 : nx < 0;
  const ox = (flip ? -nx : nx) * 52;
  const oy = (flip ? -ny : ny) * 52 + 6;
  const anchor = ox > 18 ? "start" : ox < -18 ? "end" : "middle";
  const lines = wrap(task.title);
  const halo = { stroke: PAPER, strokeWidth: 4.5, strokeLinejoin: "round" as const, paintOrder: "stroke" as const };

  return (
    <g transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`} className="cursor-pointer" onClick={onOpen} role="button" aria-label={`${task.title} — ${state === "won" ? "taken" : state === "fallen" ? "fallen" : "ahead"}`}>
      {state === "won" && <circle r="46" fill="url(#j-gold)" opacity="0.55" />}
      {next && <circle r="34" fill="none" stroke={BLOOD} strokeWidth="2" strokeDasharray="5 5" className="cmp-next" />}
      <g opacity={state === "fallen" ? 0.55 : 1}>
        <ellipse cy="4" rx="28" ry="6" fill="#5a3a18" opacity="0.2" />
        {kind === 0 && (
          <g fill="#dcc596" stroke={INK} strokeWidth="1.4" strokeLinejoin="round">
            <path d="M-24 2 V-14 H-18 V-20 H-12 V-14 H12 V-20 H18 V-14 H24 V2 Z" />
            <path d="M-8 -14 V-30 L0 -38 L8 -30 V-14" />
            <path d="M-4 2 V-6 A4 4 0 0 1 4 -6 V2" fill={INK_SOFT} />
          </g>
        )}
        {kind === 1 && (
          <g fill="#e2cfa4" stroke={INK} strokeWidth="1.3" strokeLinejoin="round">
            <path d="M-26 2 H26 V-2 H-26 Z" />
            <path d="M-22 -2 V-22 M-11 -2 V-22 M0 -2 V-22 M11 -2 V-22 M22 -2 V-22" strokeWidth="2.6" />
            <path d="M-27 -22 H27 L0 -36 Z" />
          </g>
        )}
        {kind === 2 && (
          <g fill="#dcc596" stroke={INK} strokeWidth="1.3" strokeLinejoin="round">
            <path d="M-24 2 V-10 L-16 -16 L-8 -10 V2 Z" />
            <path d="M8 2 V-12 L16 -18 L24 -12 V2 Z" />
            <path d="M-10 2 V-16 A10 10 0 0 1 10 -16 V2 Z" />
            <path d="M0 -26 V-34" />
          </g>
        )}
        {kind === 3 && (
          <g fill="#dcc596" stroke={INK} strokeWidth="1.3" strokeLinejoin="round">
            <path d="M-9 2 V-26 H9 V2 Z" />
            <path d="M-12 -26 L0 -44 L12 -26 Z" fill={INK_SOFT} />
            <path d="M-20 2 V-8 H-9 M9 -8 H20 V2" />
          </g>
        )}
      </g>

      {state === "won" && (
        <g transform="translate(14 -24)">
          <line x1="0" y1="0" x2="0" y2="-30" stroke={INK} strokeWidth="1.6" />
          <path d="M0 -30 L20 -25 L0 -19 Z" fill={BLOOD} stroke={INK} strokeWidth="0.8" className="cmp-flag" />
        </g>
      )}
      {state === "fallen" && (
        <g>
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={-6 + i * 6} cy="-30" r="7" fill="#5a4a3a" opacity="0.5" className="cmp-smoke" style={{ animationDelay: `${i * 0.9}s` }} />
          ))}
          <g stroke={BLOOD} strokeWidth="4" strokeLinecap="round">
            <line x1="-15" y1="-28" x2="15" y2="2" />
            <line x1="15" y1="-28" x2="-15" y2="2" />
          </g>
        </g>
      )}

      <g transform={`translate(${ox.toFixed(1)} ${oy.toFixed(1)})`}>
        {lines.map((l, i) => (
          <text key={i} y={i * 17} textAnchor={anchor} fontSize="16" fontWeight="700" fill={INK} textDecoration={state === "fallen" ? "line-through" : undefined} {...halo}>
            {l}
          </text>
        ))}
        <text y={lines.length * 17} textAnchor={anchor} fontSize="12.5" fontStyle="italic" fill={state === "won" ? BLOOD : INK_SOFT} {...halo}>
          {station.name}
          {state === "won" ? " · taken" : state === "fallen" ? " · fallen" : ""}
        </text>
      </g>
    </g>
  );
}

/** The end of the road: a chest on a rise, closed under its X — open and blazing on a perfect day. */
function Treasure({ x, y, won }: { x: number; y: number; won: boolean }) {
  const halo = { stroke: PAPER, strokeWidth: 4.5, strokeLinejoin: "round" as const, paintOrder: "stroke" as const };
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      {won && (
        <g className="cmp-treasure-rays">
          {Array.from({ length: 16 }, (_, i) => (
            <path key={i} d="M0 -20 L7 -130 L-7 -130 Z" fill="#f8dc84" opacity="0.35" transform={`rotate(${i * 22.5})`} />
          ))}
        </g>
      )}
      {won && <circle r="90" fill="url(#j-gold)" />}
      <ellipse cy="8" rx="44" ry="10" fill="#c9a86d" stroke={INK_SOFT} strokeWidth="1" />
      {won ? (
        <g>
          <path d="M-22 -4 L-17 -26 H17 L22 -4" fill="#7a4a22" stroke={INK} strokeWidth="1.4" />
          <rect x="-22" y="-4" width="44" height="22" rx="3" fill="#6b3f1d" stroke={INK} strokeWidth="1.4" />
          <ellipse cy="-5" rx="18" ry="5" fill="#e0ac34" stroke="#8a5a12" />
          <circle cx="-8" cy="-9" r="3.2" fill="#f5cf62" stroke="#8a5a12" strokeWidth="0.8" />
          <circle cx="6" cy="-10" r="3.2" fill="#f5cf62" stroke="#8a5a12" strokeWidth="0.8" />
          <path d="M-3 -16 L1 -22 L5 -16 L1 -12 Z" fill="#3d8bf0" stroke="#eef7ff" />
          <rect x="-4" y="2" width="8" height="9" fill="#e0ac34" stroke={INK} />
        </g>
      ) : (
        <g stroke={BLOOD} strokeWidth="7" strokeLinecap="round">
          <line x1="-20" y1="-20" x2="20" y2="14" />
          <line x1="20" y1="-20" x2="-20" y2="14" />
        </g>
      )}
      <text y="44" textAnchor="middle" fontSize="18" fontWeight="700" fontStyle="italic" fill={INK} {...halo}>
        The Edge of the World
      </text>
      <text y="62" textAnchor="middle" fontSize="12.5" fontStyle="italic" fill={won ? BLOOD : INK_SOFT} {...halo}>
        {won ? "the treasure is yours" : "where the treasure lies"}
      </text>
    </g>
  );
}
