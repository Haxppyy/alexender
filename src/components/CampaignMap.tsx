"use client";

import { Swords } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fromKey } from "@/lib/date";
import { smooth, tap } from "@/lib/motion";
import { useClock, useStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { openRewards, useUnclaimed } from "./Ceremony";
import { Modal } from "./ui";

/*
 * The day as an old treasure map. A dotted trail winds down the middle of a sheet of aged, folded,
 * stained paper, from your camp to the island where the day's treasure is buried. Every task is a
 * place along it — a fortress, a pass, a serpent's water — drawn in ink beside the trail, its name
 * written underneath. The ground you've taken is inked over in red; a place you gave up on is
 * scorched and crossed out; the X opens on a chest of gold only when every place is taken.
 *
 * Laid out so nothing overlaps: the trail keeps to a band down the centre, places and their names
 * keep to their own side, and the scenery only fills the gaps between rows.
 */

const INK = "#3b2612";
const INK_SOFT = "#6e4d2b";
const BLOOD = "#8f2516";
const PAPER = "#e8d5a6";
const SERIF = "Georgia, 'Times New Roman', ui-serif, serif";
const W = 360;
const MID = W / 2;
const SIDE_X = 92; // how far a place sits from the trail
const STEP = 132;
const TOP = 176;
const HALO = { stroke: PAPER, strokeWidth: 3.5, strokeLinejoin: "round" as const, paintOrder: "stroke" as const };

type Kind = "fortress" | "peaks" | "forest" | "crossing" | "serpent" | "tower" | "ruins" | "warcamp";
const KINDS: Kind[] = ["fortress", "peaks", "forest", "crossing", "serpent", "tower", "ruins", "warcamp"];
const PLACES: Record<Kind, string[]> = {
  fortress: ["The Iron Keep", "Fort Gloom", "The Black Bastion"],
  peaks: ["The Misty Peaks", "Wolf's Pass", "The Frozen Teeth"],
  forest: ["The Dark Wood", "Thornwood", "Whispering Pines"],
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

/** A name in at most two lines of about `width` characters, so it stays on its own side. */
function wrap(text: string, width = 19): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [""];
  for (const w of words) {
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
  const lost = fallen > 0;
  const seed = hash(date);

  // Nodes on the trail: camp, every task, the treasure. The trail wanders a little around the
  // centre; places sit to the side, alternating.
  const nodes = useMemo(() => {
    const n = tasks.length + 2;
    return Array.from({ length: n }, (_, i) => {
      const wiggle = i === 0 || i === n - 1 ? 0 : ((hash(`${seed}:${i}`) % 30) - 15);
      return { x: MID + wiggle, y: TOP + i * STEP, side: i % 2 === 0 ? -1 : 1 };
    });
  }, [tasks.length, seed]);
  const end = nodes[nodes.length - 1];
  const H = end.y + 210;
  const hero = Math.min(resolved, tasks.length);

  const trail = (from: number, to: number) => {
    let d = `M${nodes[from].x},${nodes[from].y}`;
    for (let i = from + 1; i <= to; i++) {
      const a = nodes[i - 1];
      const b = nodes[i];
      const bend = (i % 2 ? 1 : -1) * 22; // a gentle S between nodes, never far from the centre
      d += ` C${a.x + bend},${a.y + STEP * 0.45} ${b.x - bend},${b.y - STEP * 0.45} ${b.x},${b.y}`;
    }
    return d;
  };
  const fullTrail = trail(0, nodes.length - 1);
  const marched = hero > 0 ? trail(0, hero) : "";

  useEffect(() => {
    const t = setTimeout(() => heroRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 900);
    return () => clearTimeout(t);
  }, [date]);

  const title = date === today ? "Today's Campaign" : `${fromKey(date).toLocaleDateString(undefined, { weekday: "long" })}'s Campaign`;

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
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" style={{ filter: "drop-shadow(0 24px 40px rgb(0 0 0 / 0.75))" }} fontFamily={SERIF}>
          <Paper height={H} seed={seed} />

          {/* Title ribbon and compass rose. */}
          <Ribbon y={62} title={title} date={fromKey(date).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })} />
          <Compass x={298} y={132} />
          <Scenery nodes={nodes} seed={seed} />

          {/* The trail: dotted where you've yet to go, red where you've marched. */}
          <g filter="url(#ink)">
            <path d={fullTrail} fill="none" stroke={INK_SOFT} strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" opacity="0.8" />
            {marched && (
              <>
                <mask id="march-mask">
                  <path d={marched} fill="none" stroke="#fff" strokeWidth="10" pathLength={1} strokeDasharray="1 1" className="map-draw" />
                </mask>
                <path d={marched} fill="none" stroke={BLOOD} strokeWidth="3" strokeDasharray="8 6" strokeLinecap="round" mask="url(#march-mask)" />
              </>
            )}
          </g>

          {/* Camp. */}
          <Stop node={nodes[0]} state="won" label={["Your Camp"]} sub="where the day begins">
            <Tents />
          </Stop>

          {tasks.map((t, i) => {
            const node = nodes[i + 1];
            const kind = KINDS[hash(t.id) % KINDS.length];
            const place = PLACES[kind][hash(`${t.id}#`) % PLACES[kind].length];
            const state = t.done ? "won" : t.failed ? "fallen" : "ahead";
            return (
              <g key={t.id} role="button" tabIndex={0} aria-label={`${t.title} — ${t.done ? "conquered" : t.failed ? "fallen" : "ahead"}`} onClick={() => setPicked(t)} className="cursor-pointer outline-none">
                <Stop node={node} state={state} next={state === "ahead" && i === resolved} label={wrap(t.title)} sub={place}>
                  <Glyph kind={kind} />
                </Stop>
              </g>
            );
          })}

          <Treasure x={end.x} y={end.y} won={won} lost={lost} left={total - done} empty={total === 0} />

          {/* You are here: a small flag on the trail. */}
          <g ref={heroRef} transform={`translate(${nodes[hero].x} ${nodes[hero].y})`} className="map-hero">
            <line x1="0" y1="2" x2="0" y2="-24" stroke={INK} strokeWidth="1.6" />
            <path d="M0 -24 L17 -19 L0 -14 Z" fill="var(--crystal)" stroke={INK} strokeWidth="0.9" />
            <circle r="3.2" fill={INK} />
            <text x={nodes[hero].side < 0 ? 6 : -6} y="-28" textAnchor={nodes[hero].side < 0 ? "start" : "end"} fontSize="9" fontStyle="italic" fontWeight="700" fill={INK} {...HALO}>
              you
            </text>
          </g>
        </svg>

        {total > 0 && (
          <p className="mt-5 text-center text-[14px] leading-relaxed text-muted">
            {won ? "Every place taken. The treasure is yours." : lost ? "A place has fallen — the treasure is lost for today." : `${total - done} more ${total - done === 1 ? "place" : "places"} to the treasure.`}
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

type Node = { x: number; y: number; side: number };

/**
 * One stop on the trail: a mark on the trail itself, and beside it — on its own side — the
 * place drawn in ink with its name written beneath. Taken places get a red seal; fallen ones are
 * scorched and struck through.
 */
function Stop({ node, state, next, label, sub, children }: { node: Node; state: "won" | "fallen" | "ahead"; next?: boolean; label: string[]; sub: string; children: React.ReactNode }) {
  const cx = MID + node.side * SIDE_X;
  const cy = node.y - 8;
  return (
    <g>
      {/* A dotted spur from the trail to the place. */}
      <path d={`M${node.x + node.side * 8},${node.y} Q${(node.x + cx) / 2},${node.y + 6} ${cx - node.side * 34},${cy + 4}`} fill="none" stroke={INK_SOFT} strokeWidth="1.1" strokeDasharray="1 4" strokeLinecap="round" opacity="0.7" />

      {/* The mark on the trail. */}
      {next && <circle cx={node.x} cy={node.y} r="12" fill="none" stroke={BLOOD} strokeWidth="1.3" strokeDasharray="2.5 3" className="map-next" />}
      {state === "fallen" ? (
        <g stroke={INK} strokeWidth="2" strokeLinecap="round">
          <line x1={node.x - 5} y1={node.y - 5} x2={node.x + 5} y2={node.y + 5} />
          <line x1={node.x + 5} y1={node.y - 5} x2={node.x - 5} y2={node.y + 5} />
        </g>
      ) : (
        <circle cx={node.x} cy={node.y} r="4.6" fill={state === "won" ? BLOOD : PAPER} stroke={state === "won" ? "#5e130a" : INK} strokeWidth="1.3" />
      )}

      {/* The place. */}
      <g transform={`translate(${cx} ${cy})`}>
        <g filter={state === "fallen" ? "url(#scorch)" : "url(#ink)"} opacity={state === "fallen" ? 0.75 : 1}>
          {children}
        </g>
        {state === "won" && <Seal />}
        {state === "fallen" && (
          <g stroke={BLOOD} strokeWidth="3.2" strokeLinecap="round" opacity="0.85" filter="url(#ink)">
            <line x1="-18" y1="-18" x2="18" y2="18" />
            <line x1="18" y1="-18" x2="-18" y2="18" />
          </g>
        )}
        {label.map((line, i) => (
          <text key={i} y={42 + i * 13} textAnchor="middle" fontSize="12" fontWeight="700" fill={INK} textDecoration={state === "fallen" ? "line-through" : undefined} {...HALO}>
            {line}
          </text>
        ))}
        <text y={42 + label.length * 13} textAnchor="middle" fontSize="9" fontStyle="italic" letterSpacing="0.4" fill={INK_SOFT} {...HALO}>
          {state === "won" ? `${sub} — taken` : state === "fallen" ? `${sub} — fallen` : sub}
        </text>
      </g>
    </g>
  );
}

/** A red wax seal pressed over a taken place. */
function Seal() {
  return (
    <g transform="translate(24 -20)">
      <path d="M0 -13 C7 -15 14 -8 13 0 C15 7 8 14 0 13 C-8 15 -14 7 -13 0 C-15 -8 -7 -14 0 -13 Z" fill="#9b2617" />
      <path d="M0 -13 C7 -15 14 -8 13 0" fill="none" stroke="#c9563f" strokeWidth="1.2" opacity="0.7" />
      <circle r="8.5" fill="none" stroke="#6e150a" strokeWidth="0.9" />
      <path d="M-4.5 0 L-1.2 3.5 L5 -3.8" fill="none" stroke="#f1c7a2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** Ink drawings of the places, each about 56 units across, centred on 0,0. */
function Glyph({ kind }: { kind: Kind }) {
  const s = { fill: "none", stroke: INK, strokeWidth: 1.4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  const shade = "#cdb27c";
  switch (kind) {
    case "fortress":
      return (
        <g {...s}>
          <path d="M-26 22 V-4 H-20 V-11 H-14 V-4 H-8 V-11 H8 V-4 H14 V-11 H20 V-4 H26 V22 Z" fill={shade} />
          <path d="M-8 -11 V-24 H8 V-11" fill={shade} />
          <path d="M-8 -24 h3 v-3 h3 v3 h4 v-3 h3 v3 h3" />
          <path d="M-6 22 V11 A6 6 0 0 1 6 11 V22" fill={INK_SOFT} />
          <path d="M0 -27 V-38 L11 -35 L0 -32" fill={BLOOD} />
          <path d="M-20 6 h4 M16 6 h4 M-3 -18 h6" />
          <path d="M-26 22 h52" strokeWidth="2" />
          <path d="M-22 12 l3 -2 M18 14 l3 -3" strokeWidth="0.7" />
        </g>
      );
    case "peaks":
      return (
        <g {...s}>
          <path d="M-30 20 L-12 -16 L0 4 L12 -26 L32 20 Z" fill={shade} />
          <path d="M-16 -8 L-12 -16 L-8 -8 L-6 -10 M8 -18 L12 -26 L16 -18 L18 -20" fill="#f3e7cb" />
          <path d="M-4 16 l6 -9 M18 15 l5 -11 M-22 17 l4 -7 M4 14 l3 -5" strokeWidth="0.8" />
          <path d="M-36 20 h72" strokeWidth="1.8" />
        </g>
      );
    case "forest":
      return (
        <g {...s}>
          {[-20, 0, 20].map((dx, i) => (
            <g key={dx} transform={`translate(${dx} ${i === 1 ? -6 : 2})`}>
              <path d="M0 -22 L12 4 H-12 Z" fill={shade} />
              <path d="M0 -12 L9 10 H-9 Z" fill={shade} />
              <path d="M0 10 V18" />
              <path d="M-4 -4 l3 -3 M2 2 l3 -3" strokeWidth="0.6" />
            </g>
          ))}
          <path d="M-32 20 h64" strokeWidth="1.6" />
        </g>
      );
    case "crossing":
      return (
        <g {...s}>
          <path d="M-32 6 q8 -5 16 0 t16 0 t16 0 t16 0" />
          <path d="M-32 14 q8 -5 16 0 t16 0 t16 0 t16 0" strokeWidth="0.9" />
          <path d="M-32 22 q8 -5 16 0 t16 0 t16 0 t16 0" strokeWidth="0.6" />
          <path d="M-20 0 Q0 -20 20 0" strokeWidth="2.4" />
          <path d="M-20 0 Q0 -14 20 0" strokeWidth="1" />
          <path d="M-14 -5 v8 M-6 -10 v13 M2 -11 v14 M10 -8 v11" strokeWidth="1" />
        </g>
      );
    case "serpent":
      return (
        <g {...s}>
          <path d="M-34 14 q8 -5 16 0 t16 0 t16 0 t16 0" strokeWidth="0.9" />
          <path d="M-26 12 C-26 -6 -12 -6 -12 10" fill="#8c9466" />
          <path d="M-6 12 C-6 -12 10 -12 10 10" fill="#8c9466" />
          <path d="M16 10 C16 -16 32 -18 32 -6 L39 -4 L32 1" fill="#8c9466" />
          <circle cx="29" cy="-8" r="1.5" fill={INK} />
          <path d="M-20 -4 l-2 -5 M2 -8 v-6 M24 -14 l-1 -6" strokeWidth="1" />
          <path d="M-20 4 q2 -2 4 0 M0 2 q2 -2 4 0" strokeWidth="0.6" />
        </g>
      );
    case "tower":
      return (
        <g {...s}>
          <path d="M-10 24 V-8 H10 V24 Z" fill={shade} />
          <path d="M-13 -8 L0 -32 L13 -8 Z" fill={INK_SOFT} />
          <path d="M-3 8 h6 v9 h-6 Z M-3 -1 h6" />
          <path d="M0 -32 V-40 L9 -37 L0 -35" fill="#4e4290" />
          <path d="M-10 4 h4 M6 14 h4 M-8 -4 l2 0" strokeWidth="0.6" />
          <path d="M-22 24 h44" strokeWidth="1.8" />
        </g>
      );
    case "ruins":
      return (
        <g {...s}>
          <path d="M-28 22 H28" strokeWidth="1.8" />
          <path d="M-22 22 V-6 h8 V22" fill={shade} />
          <path d="M-4 22 V4 l3 -4 l5 5 V22" fill={shade} />
          <path d="M13 22 V-15 h8 V22" fill={shade} />
          <path d="M-24 -6 H-12 M11 -15 H23" strokeWidth="1.8" />
          <path d="M-20 4 h4 M15 0 h4 M-18 14 h4" strokeWidth="0.6" />
          <path d="M2 18 l5 -3 l3 3" strokeWidth="0.9" />
        </g>
      );
    case "warcamp":
      return (
        <g {...s}>
          <path d="M-28 20 L-13 -8 L2 20 Z" fill="#c8ad79" />
          <path d="M0 20 L15 -12 L30 20 Z" fill="#c8ad79" />
          <path d="M-13 -8 V-21 L-2 -18 L-13 -15" fill={BLOOD} />
          <path d="M-17 20 L-13 10 L-9 20 M11 20 L15 8 L19 20" />
          <path d="M-34 20 h68" strokeWidth="1.6" />
          <path d="M-36 12 l4 -4 l4 4 M32 14 l3 -4 l3 4" strokeWidth="0.8" />
        </g>
      );
  }
}

function Tents() {
  return (
    <g fill="#d9c294" stroke={INK} strokeWidth="1.4" strokeLinejoin="round">
      <path d="M-26 18 L-11 -10 L4 18 Z" />
      <path d="M-3 18 L10 -4 L23 18 Z" />
      <path d="M-11 -10 V-23 L0 -20 L-11 -17" fill="var(--crystal)" />
      <path d="M7 18 q3 -9 6 0" fill="none" />
      <path d="M-32 18 h60" fill="none" strokeWidth="1.6" />
      <path d="M-18 24 q2 -6 4 0 q2 -6 4 0" fill="none" stroke={BLOOD} strokeWidth="1" />
    </g>
  );
}

/**
 * The end of the trail: an island, a palm, a big red X — and the chest buried under it, which
 * comes up open and full of gold only when every place has been taken.
 */
function Treasure({ x, y, won, lost, left, empty }: { x: number; y: number; won: boolean; lost: boolean; left: number; empty: boolean }) {
  return (
    <g>
      {/* The sea around the island. */}
      <g stroke={INK_SOFT} strokeWidth="0.9" fill="none" opacity="0.55">
        {[-1, 1].map((d) =>
          [0, 1, 2].map((i) => <path key={`${d}${i}`} d={`M${x + d * (112 + i * 14)} ${y - 18 + i * 22} q6 -4 12 0 t12 0`} />),
        )}
      </g>
      <Ship x={x - 128} y={y + 66} />
      {/* The island. */}
      <path
        d={`M${x - 96} ${y + 10} C${x - 100} ${y - 34} ${x - 40} ${y - 52} ${x + 6} ${y - 46} C${x + 62} ${y - 52} ${x + 104} ${y - 22} ${x + 96} ${y + 14} C${x + 92} ${y + 50} ${x + 30} ${y + 62} ${x - 14} ${y + 58} C${x - 66} ${y + 60} ${x - 94} ${y + 44} ${x - 96} ${y + 10} Z`}
        fill="#dcc08a"
        stroke={INK}
        strokeWidth="1.5"
        filter="url(#ink)"
      />
      <path d={`M${x - 84} ${y + 14} C${x - 80} ${y - 22} ${x - 30} ${y - 38} ${x + 6} ${y - 34} C${x + 52} ${y - 38} ${x + 88} ${y - 14} ${x + 84} ${y + 14}`} fill="none" stroke={INK_SOFT} strokeWidth="0.7" strokeDasharray="2 3" />
      {/* A palm. */}
      <g transform={`translate(${x + 52} ${y - 2})`} stroke={INK} strokeWidth="1.3" fill="none" strokeLinecap="round" filter="url(#ink)">
        <path d="M0 20 C2 8 4 -6 0 -20" strokeWidth="2" />
        <path d="M0 -20 C-10 -26 -20 -22 -24 -14 M0 -20 C10 -27 20 -24 24 -15 M0 -20 C-6 -30 -14 -32 -18 -30 M0 -20 C6 -30 14 -32 18 -29" />
        <circle cx="-2" cy="-17" r="2" fill={INK_SOFT} />
        <circle cx="2" cy="-16" r="2" fill={INK_SOFT} />
      </g>
      {/* The glow, the chest, the X. */}
      {won && <circle cx={x - 18} cy={y + 4} r="46" fill="url(#gold-glow)" className="map-glow" />}
      <g transform={`translate(${x - 18} ${y + 10})`}>
        {won ? (
          <g>
            <path d="M-16 -2 L-12 -18 H12 L16 -2" fill="#7a4a22" stroke={INK} strokeWidth="1.2" />
            <rect x="-16" y="-2" width="32" height="18" rx="2" fill="#6b3f1d" stroke={INK} strokeWidth="1.2" />
            <ellipse cx="0" cy="-3" rx="13" ry="4" fill="#e0ac34" stroke="#8a5a12" strokeWidth="0.8" />
            <circle cx="-6" cy="-6" r="2.4" fill="#f5cf62" stroke="#8a5a12" strokeWidth="0.6" />
            <circle cx="4" cy="-7" r="2.4" fill="#f5cf62" stroke="#8a5a12" strokeWidth="0.6" />
            <path d="M-2 -12 L1 -16 L4 -12 L1 -9 Z" fill="#3d8bf0" stroke="#eef7ff" strokeWidth="0.6" />
            <rect x="-3" y="2" width="6" height="7" fill="#e0ac34" stroke={INK} strokeWidth="0.7" />
          </g>
        ) : (
          <path d="M-18 8 q18 -12 36 0" fill="#c9a86d" stroke={INK_SOFT} strokeWidth="1" />
        )}
      </g>
      <g stroke={BLOOD} strokeWidth="4.5" strokeLinecap="round" opacity={lost ? 0.35 : 0.9} filter="url(#ink)">
        <line x1={x - 32} y1={y - 22} x2={x - 4} y2={y + 6} />
        <line x1={x - 4} y1={y - 22} x2={x - 32} y2={y + 6} />
      </g>
      <text x={x} y={y + 86} textAnchor="middle" fontSize="13" fontWeight="700" fontStyle="italic" letterSpacing="1" fill={INK} {...HALO}>
        Here lies the treasure
      </text>
      <text x={x} y={y + 101} textAnchor="middle" fontSize="9.5" fontStyle="italic" fill={won ? BLOOD : INK_SOFT} {...HALO}>
        {empty ? "plan the day to set out" : won ? "taken — it is yours" : lost ? "lost for today" : `${left} more ${left === 1 ? "place" : "places"} to reach it`}
      </text>
    </g>
  );
}

function Ship({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={INK} strokeWidth="1.1" fill="none" strokeLinejoin="round" opacity="0.85" filter="url(#ink)">
      <path d="M-16 4 H16 L11 11 H-11 Z" fill="#a77a48" />
      <path d="M0 4 V-20" />
      <path d="M1 -19 Q11 -12 1 -4 Z M-1 -16 Q-10 -10 -1 -3 Z" fill="#efe1bf" />
      <path d="M0 -20 l6 2 l-6 2" fill={BLOOD} />
      <path d="M-22 14 q5 -3 10 0 t10 0 t10 0 t10 0" strokeWidth="0.8" />
    </g>
  );
}

/** A sixteen-point compass rose with its rings and the four winds. */
function Compass({ x, y }: { x: number; y: number }) {
  const long = [0, 90, 180, 270];
  const mid = [45, 135, 225, 315];
  const short = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];
  const point = (a: number, len: number, w: number, dark: boolean) => (
    <g key={`${a}-${len}`} transform={`rotate(${a})`}>
      <path d={`M0 ${-len} L${w} 0 L0 0 Z`} fill={dark ? INK : PAPER} stroke={INK} strokeWidth="0.6" />
      <path d={`M0 ${-len} L${-w} 0 L0 0 Z`} fill={dark ? PAPER : INK} stroke={INK} strokeWidth="0.6" />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y})`} opacity="0.9">
      <circle r="27" fill="none" stroke={INK} strokeWidth="0.8" />
      <circle r="23" fill="none" stroke={INK} strokeWidth="0.4" />
      {Array.from({ length: 32 }, (_, i) => (
        <line key={i} y1="-27" y2={i % 4 ? "-25" : "-23"} stroke={INK} strokeWidth="0.5" transform={`rotate(${i * 11.25})`} />
      ))}
      {short.map((a) => point(a, 13, 2.2, false))}
      {mid.map((a) => point(a, 19, 3, true))}
      {long.map((a) => point(a, 30, 4, a === 0))}
      <circle r="2.4" fill={BLOOD} stroke={INK} strokeWidth="0.6" />
      <text y="-34" textAnchor="middle" fontSize="10" fontWeight="700" fill={INK}>N</text>
      <text x="37" y="3.5" textAnchor="middle" fontSize="7.5" fill={INK_SOFT}>E</text>
      <text y="42" textAnchor="middle" fontSize="7.5" fill={INK_SOFT}>S</text>
      <text x="-37" y="3.5" textAnchor="middle" fontSize="7.5" fill={INK_SOFT}>W</text>
    </g>
  );
}

/** The title on a ribbon with folded tails. */
function Ribbon({ y, title, date }: { y: number; title: string; date: string }) {
  return (
    <g transform={`translate(${MID} ${y})`}>
      <path d="M-138 -6 L-118 -6 L-118 18 L-138 18 L-128 6 Z" fill="#c9ac72" stroke={INK} strokeWidth="1" />
      <path d="M138 -6 L118 -6 L118 18 L138 18 L128 6 Z" fill="#c9ac72" stroke={INK} strokeWidth="1" />
      <path d="M-118 18 L-108 24 L-108 14 Z M118 18 L108 24 L108 14 Z" fill="#a98a52" stroke={INK} strokeWidth="0.8" />
      <path d="M-112 -20 Q0 -30 112 -20 L112 14 Q0 4 -112 14 Z" fill="#e3cd98" stroke={INK} strokeWidth="1.2" />
      <path d="M-104 -15 Q0 -24 104 -15 M-104 9 Q0 0 104 9" fill="none" stroke={INK_SOFT} strokeWidth="0.5" />
      <text y="-3" textAnchor="middle" fontSize="15" fontWeight="700" letterSpacing="2.5" fill={INK}>
        {title.toUpperCase()}
      </text>
      <text y="38" textAnchor="middle" fontSize="9.5" fontStyle="italic" letterSpacing="0.6" fill={INK_SOFT}>
        {date}
      </text>
    </g>
  );
}

/**
 * Hills, woods, rocks and waves — only in the gaps between rows, and only clear of the trail
 * band, so they never sit on a place, a name or the road.
 */
function Scenery({ nodes, seed }: { nodes: Node[]; seed: number }) {
  const items = useMemo(() => {
    const out: { x: number; y: number; k: number }[] = [];
    // Up top, beside the title: a range of mountains on the left.
    out.push({ x: 74, y: 128, k: 4 });
    for (let i = 0; i < nodes.length - 2; i++) {
      const y = nodes[i].y + 82;
      for (const side of [-1, 1]) {
        const r = hash(`${seed}:${i}:${side}`);
        if (r % 3 === 0) continue; // leave some gaps empty
        const x = MID + side * (64 + (r % 70));
        out.push({ x, y: y + ((r >> 3) % 8), k: r % 4 });
      }
    }
    return out;
  }, [nodes, seed]);
  return (
    <g stroke={INK_SOFT} strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.6" filter="url(#ink)" style={{ pointerEvents: "none" }}>
      {items.map((m, i) =>
        m.k === 0 ? (
          <path key={i} d={`M${m.x - 12} ${m.y} q6 -9 12 0 q6 -7 12 0`} />
        ) : m.k === 1 ? (
          <g key={i} transform={`translate(${m.x} ${m.y})`}>
            <path d="M-6 0 L-2 -9 L2 0 Z M3 0 L6 -7 L9 0 Z" fill="#cdb27c" />
          </g>
        ) : m.k === 2 ? (
          <path key={i} d={`M${m.x - 12} ${m.y} q6 -4 12 0 t12 0`} />
        ) : m.k === 3 ? (
          <g key={i} transform={`translate(${m.x} ${m.y})`}>
            <ellipse rx="5" ry="2.5" fill="#cdb27c" />
            <ellipse cx="7" cy="1" rx="3" ry="1.8" fill="#cdb27c" />
          </g>
        ) : (
          <g key={i} transform={`translate(${m.x} ${m.y})`}>
            <path d="M-34 10 L-22 -10 L-14 2 L-4 -16 L8 4 L16 -6 L30 10 Z" fill="#d6bd86" />
            <path d="M-26 -3 L-22 -10 L-18 -4 M-8 -9 L-4 -16 L0 -10" fill="#f0e3c3" />
          </g>
        ),
      )}
    </g>
  );
}

/**
 * Old paper: warm and uneven, mottled and grained, with paper fibres, two folds, a coffee ring,
 * and a scorched, ragged edge. Also the ink filters everything else is drawn with.
 */
function Paper({ height, seed }: { height: number; seed: number }) {
  const edge = useMemo(() => {
    const pts: string[] = [];
    const wob = (i: number) => (hash(`${seed}e${i}`) % 11) - 5;
    for (let x = 4, i = 0; x <= W - 4; x += 9, i++) pts.push(`${x},${7 + wob(i)}`);
    for (let y = 4, i = 200; y <= height - 4; y += 9, i++) pts.push(`${W - 7 + wob(i)},${y}`);
    for (let x = W - 4, i = 600; x >= 4; x -= 9, i++) pts.push(`${x},${height - 7 + wob(i)}`);
    for (let y = height - 4, i = 900; y >= 4; y -= 9, i++) pts.push(`${7 + wob(i)},${y}`);
    return pts.join(" ");
  }, [height, seed]);
  const stain = { x: 40 + (seed % 60), y: 260 + (seed % 300) };
  return (
    <>
      <defs>
        <clipPath id="paper-edge">
          <polygon points={edge} />
        </clipPath>
        <radialGradient id="paper-tone" cx="0.5" cy="0.42" r="0.8">
          <stop offset="0" stopColor="#f1e2bd" />
          <stop offset="0.6" stopColor="#e0c792" />
          <stop offset="1" stopColor="#bb9459" />
        </radialGradient>
        <radialGradient id="paper-burn" cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.7" stopColor="#3e2108" stopOpacity="0" />
          <stop offset="0.93" stopColor="#3e2108" stopOpacity="0.45" />
          <stop offset="1" stopColor="#24120a" stopOpacity="0.9" />
        </radialGradient>
        <radialGradient id="gold-glow">
          <stop offset="0" stopColor="#fff3c2" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#f2cb5c" stopOpacity="0.45" />
          <stop offset="1" stopColor="#e0ac34" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fold-v" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5a3a18" stopOpacity="0" />
          <stop offset="0.48" stopColor="#5a3a18" stopOpacity="0.16" />
          <stop offset="0.52" stopColor="#fff6dc" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fold-h" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a3a18" stopOpacity="0" />
          <stop offset="0.48" stopColor="#5a3a18" stopOpacity="0.14" />
          <stop offset="0.52" stopColor="#fff6dc" stopOpacity="0.3" />
          <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
        </linearGradient>
        {/* Large blotches where the paper has aged unevenly. */}
        <filter id="paper-mottle" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="4" seed={seed % 97} />
          <feColorMatrix values="0 0 0 0 0.36  0 0 0 0 0.22  0 0 0 0 0.07  0 0 0 0.62 -0.18" />
        </filter>
        {/* Fine grain. */}
        <filter id="paper-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed={(seed % 53) + 1} />
          <feColorMatrix values="0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0 0.05  0 0 0 0.2 0" />
        </filter>
        {/* Long paper fibres, laid across the sheet. */}
        <filter id="paper-fibre" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.32" numOctaves="2" seed={(seed % 31) + 2} />
          <feColorMatrix values="0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0 0.08  0 0 0 0.35 -0.12" />
        </filter>
        <filter id="soft">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <filter id="char">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        {/* Ink that bleeds a little, like a quill on rag paper. */}
        <filter id="ink" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed={7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="scorch" x="-10%" y="-10%" width="120%" height="120%">
          <feColorMatrix type="matrix" values="0.25 0.25 0.1 0 0  0.18 0.2 0.08 0 0  0.1 0.12 0.06 0 0  0 0 0 1 0" />
          <feGaussianBlur stdDeviation="0.4" />
        </filter>
      </defs>
      <g clipPath="url(#paper-edge)">
        <rect width={W} height={height} fill="url(#paper-tone)" />
        <rect width={W} height={height} filter="url(#paper-mottle)" />
        <rect width={W} height={height} filter="url(#paper-fibre)" />
        <rect width={W} height={height} filter="url(#paper-grain)" />
        {/* Folds: once down the middle, and across in thirds. */}
        <rect x={MID - 6} y="0" width="12" height={height} fill="url(#fold-v)" />
        <rect x="0" y={height / 3 - 6} width={W} height="12" fill="url(#fold-h)" />
        <rect x="0" y={(height * 2) / 3 - 6} width={W} height="12" fill="url(#fold-h)" />
        {/* A coffee ring someone left on it, long ago. */}
        <ellipse cx={stain.x} cy={stain.y} rx="26" ry="24" fill="none" stroke="#7a4f22" strokeOpacity="0.22" strokeWidth="2.5" filter="url(#soft)" />
        <ellipse cx={stain.x + 2} cy={stain.y + 1} rx="22" ry="20" fill="#7a4f22" fillOpacity="0.05" filter="url(#soft)" />
        <rect width={W} height={height} fill="url(#paper-burn)" />
      </g>
      {/* The scorched rim. */}
      <polygon points={edge} fill="none" stroke="#2a1306" strokeOpacity="0.7" strokeWidth="5" filter="url(#char)" clipPath="url(#paper-edge)" />
      <polygon points={edge} fill="none" stroke="#2a1306" strokeOpacity="0.55" strokeWidth="1.2" />
      {/* A hand-ruled double border. */}
      <rect x="18" y="18" width={W - 36} height={height - 36} fill="none" stroke={INK} strokeOpacity="0.45" strokeWidth="1" filter="url(#ink)" />
      <rect x="22" y="22" width={W - 44} height={height - 44} fill="none" stroke={INK} strokeOpacity="0.3" strokeWidth="0.5" />
    </>
  );
}
