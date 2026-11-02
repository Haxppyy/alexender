"use client";

import { Swords } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fromKey } from "@/lib/date";
import { smooth, tap } from "@/lib/motion";
import { useClock, useStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { openRewards, useUnclaimed } from "./Ceremony";
import { Modal } from "./ui";

/*
 * The day as a campaign on an old map. Every task is a place to take — a fortress, a mountain
 * pass, a serpent's crossing — along a trail from your camp to the citadel where the day's
 * treasure waits. Your march is inked in red as you conquer; places you gave up on burn and are
 * marked fallen; the citadel and its chest open only when every place is taken. Drawn in SVG on
 * aged paper, no images.
 */

const INK = "#3a2613";
const INK_SOFT = "#6b4a2a";
const BLOOD = "#8e2a17";
const W = 360;
const HALO = { stroke: "#e4d0a2", strokeWidth: 4, strokeLinejoin: "round" as const, paintOrder: "stroke" as const };
const STEP = 150;
const TOP = 150;

type Kind = "fortress" | "peaks" | "forest" | "crossing" | "serpent" | "tower" | "ruins" | "warcamp";
const KINDS: Kind[] = ["fortress", "peaks", "forest", "crossing", "serpent", "tower", "ruins", "warcamp"];
const PLACES: Record<Kind, string[]> = {
  fortress: ["The Iron Keep", "Fort Gloom", "The Black Bastion"],
  peaks: ["The Misty Peaks", "Wolf's Pass", "The Frozen Teeth"],
  forest: ["The Dark Wood", "Thornwood", "The Whispering Pines"],
  crossing: ["The Drowned Ford", "Raven Bridge", "The Cold River"],
  serpent: ["Serpent's Reach", "The Wyrm's Lake", "Leviathan Bay"],
  tower: ["The Sorcerer's Tower", "The Lonely Spire", "Watchtower of Ash"],
  ruins: ["The Old Ruins", "The Fallen Temple", "Tomb of Kings"],
  warcamp: ["The Bandit Camp", "The Orc Warcamp", "Raider's Hollow"],
};

const hash = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Conquered first (in the order taken), then fallen, then what's still ahead (in your order). */
function campaignOrder(tasks: Task[]) {
  const rank = (t: Task) => (t.done ? 0 : t.failed ? 1 : 2);
  return [...tasks].sort((a, b) => rank(a) - rank(b) || (a.done ? (a.completedAt ?? 0) - (b.completedAt ?? 0) : (a.order ?? a.createdAt) - (b.order ?? b.createdAt)));
}

export function CampaignMap({ date }: { date: string }) {
  const all = useStore((s) => s.tasks);
  const today = useClock((s) => s.today);
  const unclaimed = useUnclaimed();
  const [picked, setPicked] = useState<Task | null>(null);
  const heroRef = useRef<SVGGElement>(null);

  const tasks = useMemo(() => campaignOrder(all.filter((t) => t.date === date)), [all, date]);
  const done = tasks.filter((t) => t.done).length;
  const fallen = tasks.filter((t) => t.failed).length;
  const resolved = done + fallen;
  const total = tasks.length;
  // The treasure is for a perfect day: every place taken. One fallen place loses it for today.
  const won = total > 0 && done === total;
  const toWin = total - done;
  const lost = fallen > 0;

  // Camp, every task, then the citadel — zig-zagging down the page.
  const seed = hash(date);
  const points = useMemo(() => {
    const n = tasks.length + 2;
    return Array.from({ length: n }, (_, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const jitter = ((hash(`${seed}:${i}`) % 40) - 20) * (i === 0 || i === n - 1 ? 0 : 1);
      const x = i === 0 || i === n - 1 ? W / 2 : W / 2 + side * 82 + jitter;
      return { x, y: TOP + i * STEP };
    });
  }, [tasks.length, seed]);
  const H = points[points.length - 1].y + 170;
  const hero = Math.min(resolved, tasks.length); // index into points (0 = camp)

  const path = (from: number, to: number) => {
    let d = `M${points[from].x},${points[from].y}`;
    for (let i = from + 1; i <= to; i++) {
      const a = points[i - 1];
      const b = points[i];
      d += ` C${a.x},${a.y + STEP * 0.55} ${b.x},${b.y - STEP * 0.55} ${b.x},${b.y}`;
    }
    return d;
  };
  const fullPath = path(0, points.length - 1);
  const marched = hero > 0 ? path(0, hero) : "";

  useEffect(() => {
    const t = setTimeout(() => heroRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 900);
    return () => clearTimeout(t);
  }, [date]);

  const title = date === today ? "Today's Campaign" : fromKey(date).toLocaleDateString(undefined, { weekday: "long" }) + "'s Campaign";

  return (
    <div key={date} className="animate-fade">
      <div className="mx-auto mb-4 flex max-w-[480px] items-center gap-3 px-1">
        <p className="min-w-0 flex-1 text-[14px] text-muted tabular-nums">
          {total === 0 ? "No battles planned" : `${done} conquered${fallen ? ` · ${fallen} fallen` : ""} · ${total - resolved} ahead`}
        </p>
        {unclaimed.length > 0 && (
          <button onClick={openRewards} className="victory-claim flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold text-[#2a1a04]">
            <Swords className="size-4" /> Claim
          </button>
        )}
      </div>

      <div className="mx-auto w-full max-w-[480px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" style={{ filter: "drop-shadow(0 20px 40px rgb(0 0 0 / 0.7))" }}>
          <Parchment height={H} seed={seed} />

          {/* The title cartouche. */}
          <g transform={`translate(${W / 2} 54)`}>
            <path d="M-118 -24 H118 L130 0 L118 24 H-118 L-130 0 Z" fill="#e9d7ab" stroke={INK} strokeWidth="1.4" />
            <path d="M-112 -18 H112 L122 0 L112 18 H-112 L-122 0 Z" fill="none" stroke={INK_SOFT} strokeWidth="0.6" />
            <text y="-2" textAnchor="middle" fontSize="15" fontWeight="700" letterSpacing="3" fill={INK}>
              {title.toUpperCase()}
            </text>
            <text y="13" textAnchor="middle" fontSize="8.5" fontStyle="italic" letterSpacing="1" fill={INK_SOFT}>
              {fromKey(date).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
            </text>
          </g>
          <Compass x={W - 46} y={128} />
          <Scenery height={H} points={points} seed={seed} />

          {/* The road ahead, dashed; the road marched, in red. */}
          <path d={fullPath} fill="none" stroke={INK_SOFT} strokeWidth="2.2" strokeDasharray="2 7" strokeLinecap="round" opacity="0.75" />
          {marched && (
            <>
              <mask id="march-mask">
                <path d={marched} fill="none" stroke="#fff" strokeWidth="8" pathLength={1} strokeDasharray="1 1" className="map-draw" />
              </mask>
              <path d={marched} fill="none" stroke={BLOOD} strokeWidth="3.4" strokeDasharray="9 6" strokeLinecap="round" mask="url(#march-mask)" />
            </>
          )}

          {/* Camp. */}
          <Place x={points[0].x} y={points[0].y} label="Your Camp" sub="Where the day begins">
            <Tents />
          </Place>

          {tasks.map((t, i) => {
            const p = points[i + 1];
            const kind = KINDS[hash(t.id) % KINDS.length];
            const place = PLACES[kind][hash(`${t.id}#`) % PLACES[kind].length];
            const next = !t.done && !t.failed && i === resolved;
            return (
              <g key={t.id} role="button" tabIndex={0} aria-label={`${t.title} — ${t.done ? "conquered" : t.failed ? "fallen" : "ahead"}`} onClick={() => setPicked(t)} className="cursor-pointer outline-none">
                <Place x={p.x} y={p.y} label={t.title} sub={place} struck={t.failed} next={next} state={t.done ? "won" : t.failed ? "fallen" : "ahead"}>
                  <Glyph kind={kind} />
                </Place>
              </g>
            );
          })}

          {/* The citadel and the day's treasure. */}
          <Citadel x={points[points.length - 1].x} y={points[points.length - 1].y} won={won} lost={lost} toWin={toWin} empty={total === 0} />

          {/* You are here. */}
          <g ref={heroRef} transform={`translate(${points[hero].x + (hero === 0 ? 46 : points[hero].x > W / 2 ? -50 : 50)} ${points[hero].y - 30})`} className="map-hero">
            <line x1="0" y1="0" x2="0" y2="34" stroke={INK} strokeWidth="1.6" />
            <path d="M0 0 L22 6 L0 13 Z" fill="var(--crystal)" stroke={INK} strokeWidth="1" />
            <circle cx="0" cy="35" r="3" fill={INK} />
            <text x="4" y="48" fontSize="8.5" fontWeight="700" letterSpacing="1.5" fill={INK}>
              YOU
            </text>
          </g>
        </svg>

        {total > 0 && (
          <p className="mt-5 text-center text-[13.5px] leading-relaxed text-muted">
            {won
              ? "Every place taken. The citadel and its treasure are yours."
              : lost
                ? "A place has fallen — the treasure is lost for today. Take what you can, and march again tomorrow."
                : `Take ${toWin} more ${toWin === 1 ? "place" : "places"} and the treasure is yours.`}{" "}
            Tap a place to fight for it.
          </p>
        )}
      </div>

      <Modal open={!!picked} onClose={() => setPicked(null)} title={picked?.title}>
        {picked && <Battle task={picked} onDone={() => setPicked(null)} />}
      </Modal>
    </div>
  );
}

/** Fight for a place: take it, or fall back. */
function Battle({ task, onDone }: { task: Task; onDone: () => void }) {
  const { toggleTask, toggleNotDone } = useStore.getState();
  const act = (fn: () => void, buzz: number) => {
    tap(buzz);
    smooth(fn);
    onDone();
  };
  return (
    <div className="space-y-2 pb-1">
      {!task.done && (
        <button onClick={() => act(() => toggleTask(task.id), 24)} className="victory-claim flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-bold text-[#2a1a04]">
          <Swords className="size-5" /> Conquer — it&apos;s done
        </button>
      )}
      {task.done && (
        <button onClick={() => act(() => toggleTask(task.id), 8)} className="h-12 w-full rounded-2xl border border-line-strong text-[15px] font-medium text-muted">
          Not conquered after all
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

/** A place on the map: its picture, a name, and — once decided — a seal or a burn. */
function Place({ x, y, label, sub, children, state, struck, next }: { x: number; y: number; label: string; sub: string; children: ReactNode; state?: "won" | "fallen" | "ahead"; struck?: boolean; next?: boolean }) {
  const short = label.length > 26 ? `${label.slice(0, 25)}…` : label;
  return (
    <g transform={`translate(${x} ${y})`}>
      {next && <circle r="40" fill="none" stroke={BLOOD} strokeWidth="1.2" strokeDasharray="3 4" opacity="0.8" className="map-next" />}
      <g opacity={state === "fallen" ? 0.55 : 1} filter={state === "fallen" ? "url(#burn)" : undefined}>
        {children}
      </g>
      {state === "won" && <Seal />}
      {state === "fallen" && (
        <g stroke={BLOOD} strokeWidth="4" strokeLinecap="round" opacity="0.85">
          <line x1="-20" y1="-20" x2="20" y2="20" />
          <line x1="20" y1="-20" x2="-20" y2="20" />
        </g>
      )}
      {/* Names sit on a halo of paper, so the road never runs through them. */}
      <text y="46" textAnchor="middle" fontSize="11.5" fontWeight="700" fill={INK} textDecoration={struck ? "line-through" : undefined} {...HALO}>
        {short}
      </text>
      <text y="59" textAnchor="middle" fontSize="8.5" fontStyle="italic" letterSpacing="0.6" fill={INK_SOFT} {...HALO}>
        {state === "won" ? `${sub} · conquered` : state === "fallen" ? `${sub} · fallen` : sub}
      </text>
    </g>
  );
}

/** A red wax seal pressed over a conquered place. */
function Seal() {
  return (
    <g transform="translate(22 -18)">
      <path d="M0 -15 C8 -16 15 -9 15 0 C16 8 9 15 0 15 C-9 16 -15 8 -15 0 C-16 -9 -8 -15 0 -15 Z" fill="#9e2b1a" />
      <circle r="10.5" fill="none" stroke="#c9503a" strokeWidth="1" />
      <path d="M-5 0 L-1.5 4 L6 -4.5" fill="none" stroke="#f3c9a8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** Ink drawings of the places, each about 50 units across, centred on 0,0. */
function Glyph({ kind }: { kind: Kind }) {
  const s = { fill: "none", stroke: INK, strokeWidth: 1.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  switch (kind) {
    case "fortress":
      return (
        <g {...s}>
          <path d="M-24 22 V-6 H-18 V-12 H-12 V-6 H-6 V-12 H6 V-6 H12 V-12 H18 V-6 H24 V22 Z" fill="#dcc596" />
          <path d="M-6 22 V10 A6 6 0 0 1 6 10 V22" fill={INK_SOFT} />
          <path d="M-14 -12 V-26 L-2 -22 L-14 -18" fill={BLOOD} />
          <path d="M-18 4 h4 M14 4 h4" />
        </g>
      );
    case "peaks":
      return (
        <g {...s}>
          <path d="M-28 20 L-10 -14 L2 6 L12 -22 L30 20 Z" fill="#dcc596" />
          <path d="M-14 -6 L-10 -14 L-6 -6 M8 -14 L12 -22 L16 -14" fill="#f4ead2" />
          <path d="M-4 14 l6 -8 M16 14 l4 -10 M-20 16 l4 -6" strokeWidth="0.9" />
        </g>
      );
    case "forest":
      return (
        <g {...s}>
          {[-18, 0, 18].map((dx, i) => (
            <g key={dx} transform={`translate(${dx} ${i === 1 ? -6 : 2})`}>
              <path d="M0 -20 L11 6 H-11 Z" fill="#c9b27f" />
              <path d="M0 -10 L8 10 H-8 Z" fill="#c9b27f" />
              <path d="M0 10 V18" />
            </g>
          ))}
        </g>
      );
    case "crossing":
      return (
        <g {...s}>
          <path d="M-30 4 q7 -5 14 0 t14 0 t14 0 t14 0" />
          <path d="M-30 12 q7 -5 14 0 t14 0 t14 0 t14 0" strokeWidth="1" />
          <path d="M-18 -2 Q0 -18 18 -2" strokeWidth="2.2" />
          <path d="M-14 -6 v8 M-6 -11 v13 M2 -12 v14 M10 -9 v11" strokeWidth="1" />
        </g>
      );
    case "serpent":
      return (
        <g {...s}>
          <path d="M-30 12 q7 -5 14 0 t14 0 t14 0 t14 0" strokeWidth="1" />
          <path d="M-22 10 C-22 -6 -10 -6 -10 8 M-4 10 C-4 -10 10 -10 10 8" fill="#7f8f63" />
          <path d="M16 8 C16 -14 30 -16 30 -4 L36 -2 L30 2" fill="#7f8f63" />
          <circle cx="27" cy="-6" r="1.4" fill={INK} />
          <path d="M-16 -4 l-2 -4 M3 -7 l0 -5 M22 -12 l-1 -5" strokeWidth="1" />
        </g>
      );
    case "tower":
      return (
        <g {...s}>
          <path d="M-9 24 V-8 H9 V24 Z" fill="#dcc596" />
          <path d="M-12 -8 L0 -30 L12 -8 Z" fill={INK_SOFT} />
          <path d="M-3 6 h6 v8 h-6 Z M-3 -2 h6" />
          <path d="M0 -30 V-36 L8 -34 L0 -32" fill="#5b4a9a" />
        </g>
      );
    case "ruins":
      return (
        <g {...s}>
          <path d="M-26 22 H26" />
          <path d="M-20 22 V-6 h7 V22" fill="#dcc596" />
          <path d="M-4 22 V4 l3 -3 l4 4 V22" fill="#dcc596" />
          <path d="M12 22 V-14 h7 V22" fill="#dcc596" />
          <path d="M-22 -6 H-11 M10 -14 H21" />
          <path d="M2 16 l4 -2 l3 3" strokeWidth="1" />
        </g>
      );
    case "warcamp":
      return (
        <g {...s}>
          <path d="M-26 20 L-12 -6 L2 20 Z" fill="#c9b27f" />
          <path d="M0 20 L14 -10 L28 20 Z" fill="#c9b27f" />
          <path d="M-12 -6 V-18 L-2 -15 L-12 -12" fill={BLOOD} />
          <path d="M-16 20 L-12 10 L-8 20 M10 20 L14 8 L18 20" />
        </g>
      );
  }
}

function Tents() {
  return (
    <g fill="#e2cfa1" stroke={INK} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M-24 18 L-10 -8 L4 18 Z" />
      <path d="M-2 18 L10 -2 L22 18 Z" />
      <path d="M-10 -8 V-20 L0 -17 L-10 -14" fill="var(--crystal)" />
      <path d="M8 18 q2 -8 4 0" fill="none" />
    </g>
  );
}

/** The citadel. Won: gates open, the chest glows with the day's sapphire. Lost: dark, in fog. */
function Citadel({ x, y, won, lost, toWin, empty }: { x: number; y: number; won: boolean; lost: boolean; toWin: number; empty: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {won && <circle r="58" fill="url(#treasure-glow)" />}
      <g fill="#dcc596" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" opacity={lost ? 0.55 : 1}>
        <path d="M-46 30 V-6 H-40 V-12 H-34 V-6 H-28 V-12 H-22 V-6 H22 V-12 H28 V-6 H34 V-12 H40 V-6 H46 V30 Z" />
        <path d="M-40 -6 V-34 L-30 -46 L-20 -34 V-6" />
        <path d="M20 -6 V-34 L30 -46 L40 -34 V-6" />
        <path d="M-12 -6 V-40 L0 -56 L12 -40 V-6" />
        <path d="M0 -56 V-66 L12 -62 L0 -58" fill={won ? "var(--crystal)" : BLOOD} />
        <path d={won ? "M-12 30 V12 A12 12 0 0 1 12 12 V30" : "M-10 30 V14 A10 10 0 0 1 10 14 V30 Z"} fill={won ? "#2b1a0a" : INK_SOFT} />
      </g>
      {/* The chest at the gate. */}
      <g transform="translate(0 44)">
        <rect x="-15" y="-8" width="30" height="16" rx="2" fill="#6b3f1d" stroke={INK} strokeWidth="1.2" />
        <path d={won ? "M-15 -8 L-12 -20 H12 L15 -8" : "M-15 -8 Q0 -18 15 -8"} fill="#7a4a22" stroke={INK} strokeWidth="1.2" />
        <rect x="-3" y="-4" width="6" height="7" fill="#e0ac34" stroke={INK} strokeWidth="0.8" />
        {won && <path d="M-6 -14 L0 -22 L6 -14 L0 -9 Z" fill="#3d8bf0" stroke="#eef7ff" strokeWidth="0.8" />}
      </g>
      {lost && <rect x="-70" y="-80" width="140" height="150" fill="url(#fog)" />}
      <text y="80" textAnchor="middle" fontSize="12" fontWeight="700" letterSpacing="2" fill={INK} {...HALO}>
        THE CITADEL
      </text>
      <text y="94" textAnchor="middle" fontSize="8.5" fontStyle="italic" fill={won ? BLOOD : INK_SOFT} {...HALO}>
        {empty ? "Plan the day to march" : won ? "Taken — the treasure is yours" : lost ? "Holds for today" : `Take ${toWin} more to open it`}
      </text>
    </g>
  );
}

function Compass({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={INK} strokeWidth="1" fill="none" opacity="0.85">
      <circle r="22" />
      <circle r="18" strokeWidth="0.5" />
      <path d="M0 -30 L5 0 L0 30 L-5 0 Z" fill="#e9d7ab" />
      <path d="M0 -30 L5 0 L-5 0 Z" fill={BLOOD} />
      <path d="M-30 0 L0 4 L30 0 L0 -4 Z" fill="#e9d7ab" />
      <text y="-34" textAnchor="middle" fontSize="9" fontWeight="700" fill={INK} stroke="none">
        N
      </text>
    </g>
  );
}

/** Little hills, trees and waves in the margins, so the land feels lived in. */
function Scenery({ height, points, seed }: { height: number; points: { x: number; y: number }[]; seed: number }) {
  const marks = useMemo(() => {
    const out: { x: number; y: number; k: number }[] = [];
    for (let i = 0; i < Math.floor(height / 55); i++) {
      const y = 180 + i * 55 + (hash(`${seed}y${i}`) % 30);
      const x = 22 + (hash(`${seed}x${i}`) % (W - 44));
      // Keep clear of the places and the road.
      if (points.some((p) => Math.abs(p.x - x) < 70 && Math.abs(p.y - y) < 70)) continue;
      out.push({ x, y, k: hash(`${seed}k${i}`) % 3 });
    }
    return out;
  }, [height, points, seed]);
  return (
    <g stroke={INK_SOFT} strokeWidth="1" fill="none" opacity="0.55" strokeLinecap="round">
      {marks.map((m, i) =>
        m.k === 0 ? (
          <path key={i} d={`M${m.x - 8} ${m.y} q8 -10 16 0`} />
        ) : m.k === 1 ? (
          <g key={i} transform={`translate(${m.x} ${m.y})`}>
            <path d="M0 -8 L5 3 H-5 Z" />
            <path d="M0 3 V7" />
          </g>
        ) : (
          <path key={i} d={`M${m.x - 10} ${m.y} q5 -4 10 0 t10 0`} />
        ),
      )}
    </g>
  );
}

/** Aged paper: warm, grained, stained, darker at a ragged burnt edge. */
function Parchment({ height, seed }: { height: number; seed: number }) {
  const edge = useMemo(() => {
    const pts: string[] = [];
    const wob = (i: number) => (hash(`${seed}e${i}`) % 7) - 3;
    for (let x = 6, i = 0; x <= W - 6; x += 14, i++) pts.push(`${x},${6 + wob(i)}`);
    for (let y = 6, i = 100; y <= height - 6; y += 14, i++) pts.push(`${W - 6 + wob(i)},${y}`);
    for (let x = W - 6, i = 300; x >= 6; x -= 14, i++) pts.push(`${x},${height - 6 + wob(i)}`);
    for (let y = height - 6, i = 500; y >= 6; y -= 14, i++) pts.push(`${6 + wob(i)},${y}`);
    return pts.join(" ");
  }, [height, seed]);
  return (
    <>
      <defs>
        <clipPath id="paper-edge">
          <polygon points={edge} />
        </clipPath>
        <radialGradient id="paper-tone" cx="0.5" cy="0.4" r="0.75">
          <stop offset="0" stopColor="#efe0b9" />
          <stop offset="0.7" stopColor="#dcc28d" />
          <stop offset="1" stopColor="#b8925a" />
        </radialGradient>
        <radialGradient id="paper-burn" cx="0.5" cy="0.5" r="0.72">
          <stop offset="0.72" stopColor="#4a2c10" stopOpacity="0" />
          <stop offset="1" stopColor="#4a2c10" stopOpacity="0.75" />
        </radialGradient>
        <radialGradient id="treasure-glow">
          <stop offset="0" stopColor="#fff3c2" stopOpacity="0.95" />
          <stop offset="1" stopColor="#e0ac34" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fog" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9c9a3" stopOpacity="0" />
          <stop offset="0.5" stopColor="#d9c9a3" stopOpacity="0.75" />
          <stop offset="1" stopColor="#d9c9a3" stopOpacity="0.2" />
        </linearGradient>
        <filter id="paper-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed % 100} />
          <feColorMatrix values="0 0 0 0 0.29  0 0 0 0 0.18  0 0 0 0 0.07  0 0 0 0.16 0" />
        </filter>
        <filter id="paper-stain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed={(seed % 50) + 3} />
          <feColorMatrix values="0 0 0 0 0.4  0 0 0 0 0.25  0 0 0 0 0.08  0 0 0 0.5 -0.12" />
        </filter>
        <filter id="burn">
          <feColorMatrix type="saturate" values="0.2" />
        </filter>
      </defs>
      <g clipPath="url(#paper-edge)">
        <rect width={W} height={height} fill="url(#paper-tone)" />
        <rect width={W} height={height} filter="url(#paper-stain)" />
        <rect width={W} height={height} filter="url(#paper-grain)" />
        <rect width={W} height={height} fill="url(#paper-burn)" />
      </g>
      <polygon points={edge} fill="none" stroke="#3a2210" strokeOpacity="0.6" strokeWidth="1.5" />
      {/* A fine double border, inked by hand. */}
      <rect x="16" y="16" width={W - 32} height={height - 32} fill="none" stroke={INK} strokeOpacity="0.5" strokeWidth="1" />
      <rect x="20" y="20" width={W - 40} height={height - 40} fill="none" stroke={INK} strokeOpacity="0.35" strokeWidth="0.5" />
    </>
  );
}
