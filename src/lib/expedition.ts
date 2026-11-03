import type { Task } from "./types";

/*
 * The world of the campaign: a hand-drawn map of the lands Alexander marched through, from Pella
 * to the edge of the known world. Everything here is geometry and numbers — where the seas,
 * rivers, mountains and deserts lie, the road itself, where each of the day's tasks sits on it,
 * and the experience you've earned. Deterministic: the same world every time.
 */

export const WORLD = { w: 2000, h: 1250 };

export interface Pt {
  x: number;
  y: number;
}

/** Alexander's road, in order. The first is camp; the last is the treasure. */
export const SITES: (Pt & { name: string; note: string })[] = [
  { x: 260, y: 330, name: "Pella", note: "where the march begins" },
  { x: 430, y: 365, name: "The Granicus", note: "the first river crossed" },
  { x: 485, y: 470, name: "Sardis", note: "the golden city" },
  { x: 640, y: 420, name: "Gordium", note: "the knot that could not be untied" },
  { x: 800, y: 560, name: "Issus", note: "the narrow plain" },
  { x: 790, y: 690, name: "Tyre", note: "the island fortress" },
  { x: 755, y: 800, name: "Gaza", note: "the walls on the hill" },
  { x: 575, y: 860, name: "Alexandria", note: "a city by the sea" },
  { x: 390, y: 965, name: "The Oracle of Siwa", note: "the voice in the desert" },
  { x: 650, y: 965, name: "Memphis", note: "the crown of Egypt" },
  { x: 1010, y: 520, name: "Gaugamela", note: "the great battle" },
  { x: 1045, y: 690, name: "Babylon", note: "the hanging gardens" },
  { x: 1165, y: 700, name: "Susa", note: "the royal treasury" },
  { x: 1295, y: 805, name: "Persepolis", note: "the palace of kings" },
  { x: 1205, y: 560, name: "Ecbatana", note: "the summer capital" },
  { x: 1500, y: 430, name: "Bactra", note: "mother of cities" },
  { x: 1575, y: 300, name: "Maracanda", note: "the far city" },
  { x: 1760, y: 560, name: "The Hydaspes", note: "the river of elephants" },
  { x: 1890, y: 760, name: "The Edge of the World", note: "where the treasure lies" },
];

/** A small seeded random, so the coastlines wobble the same way every time. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Roughen a coarse outline into a natural coast: split every edge and nudge the middle sideways. */
function roughen(points: Pt[], closed: boolean, seed: number, depth = 4, amp = 0.2): Pt[] {
  const r = rng(seed);
  let pts = points;
  for (let d = 0; d < depth; d++) {
    const out: Pt[] = [];
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const off = (r() - 0.5) * len * amp;
      const nx = -(b.y - a.y) / (len || 1);
      const ny = (b.x - a.x) / (len || 1);
      out.push(a, { x: (a.x + b.x) / 2 + nx * off, y: (a.y + b.y) / 2 + ny * off });
    }
    if (!closed) out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

const P = (pairs: [number, number][]): Pt[] => pairs.map(([x, y]) => ({ x, y }));
export const toPath = (pts: Pt[], closed = true) => `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L")}${closed ? "Z" : ""}`;

/** The waters, coarse first, then roughened into coasts. */
export const SEAS: { name: string; label?: Pt & { r?: number }; pts: Pt[] }[] = [
  { name: "MARE NOSTRUM", label: { x: 330, y: 700 }, pts: roughen(P([[-40, 560], [120, 520], [260, 565], [380, 520], [470, 560], [560, 600], [700, 630], [765, 650], [745, 740], [665, 800], [560, 820], [420, 850], [300, 840], [160, 865], [-40, 890]]), true, 11) },
  { name: "PONTUS EUXINUS", label: { x: 640, y: 262 }, pts: roughen(P([[470, 240], [600, 198], [760, 210], [822, 258], [760, 312], [600, 322], [482, 302]]), true, 12) },
  { name: "MARE CASPIUM", label: { x: 1222, y: 330, r: -78 }, pts: roughen(P([[1160, 228], [1232, 208], [1282, 280], [1272, 400], [1232, 462], [1182, 420], [1168, 320]]), true, 13) },
  { name: "SINUS PERSICUS", label: { x: 1255, y: 862, r: 24 }, pts: roughen(P([[1120, 782], [1200, 800], [1300, 852], [1380, 900], [1342, 932], [1240, 884], [1150, 842]]), true, 14) },
  { name: "MARE RUBRUM", label: { x: 905, y: 1060, r: 62 }, pts: roughen(P([[790, 880], [832, 870], [912, 1000], [972, 1120], [995, 1290], [900, 1290], [862, 1080], [812, 962]]), true, 15) },
  { name: "OCEANUS", label: { x: 1660, y: 1100 }, pts: roughen(P([[1290, 1290], [1350, 1020], [1450, 980], [1600, 958], [1750, 900], [1880, 822], [2040, 800], [2040, 1290]]), true, 16) },
];

export const RIVERS: { pts: Pt[]; w: number }[] = [
  { pts: roughen(P([[702, 1260], [690, 1150], [655, 1060], [642, 965], [612, 900], [588, 835]]), false, 21, 3, 0.25), w: 3 },
  { pts: roughen(P([[880, 430], [930, 520], [990, 610], [1040, 690], [1100, 760], [1150, 806]]), false, 22, 3, 0.25), w: 2.6 },
  { pts: roughen(P([[960, 420], [1000, 500], [1052, 580], [1110, 660], [1140, 740], [1162, 800]]), false, 23, 3, 0.25), w: 2.2 },
  { pts: roughen(P([[1680, 320], [1720, 420], [1760, 560], [1800, 680], [1852, 818]]), false, 24, 3, 0.25), w: 2.8 },
  { pts: roughen(P([[1600, 380], [1520, 332], [1420, 302], [1282, 330]]), false, 25, 3, 0.25), w: 2 },
];

export const RANGES: { pts: Pt[]; n: number; size: number }[] = [
  { pts: P([[150, 262], [250, 250], [380, 282]]), n: 9, size: 26 },
  { pts: P([[515, 520], [650, 505], [780, 505], [880, 470]]), n: 15, size: 30 },
  { pts: P([[840, 228], [980, 238], [1120, 250]]), n: 12, size: 30 },
  { pts: P([[1080, 590], [1160, 640], [1250, 715], [1340, 765]]), n: 13, size: 28 },
  { pts: P([[1290, 480], [1370, 460], [1450, 478]]), n: 7, size: 26 },
  { pts: P([[1440, 372], [1560, 352], [1660, 348], [1770, 380]]), n: 16, size: 34 },
];

export const FORESTS: { x: number; y: number; w: number; h: number }[] = [
  { x: 150, y: 380, w: 200, h: 90 },
  { x: 560, y: 335, w: 190, h: 50 },
  { x: 1290, y: 405, w: 110, h: 50 },
  { x: 1700, y: 610, w: 180, h: 120 },
];

export const DESERTS: { x: number; y: number; rx: number; ry: number; name?: string }[] = [
  { x: 330, y: 1100, rx: 230, ry: 110, name: "LIBYA" },
  { x: 1065, y: 1000, rx: 150, ry: 190, name: "ARABIA" },
  { x: 900, y: 650, rx: 70, ry: 60 },
  { x: 1400, y: 630, rx: 120, ry: 66 },
  { x: 1580, y: 870, rx: 170, ry: 70, name: "GEDROSIA" },
];

export const REGIONS: (Pt & { name: string })[] = [
  { x: 300, y: 450, name: "MACEDONIA" },
  { x: 600, y: 470, name: "ANATOLIA" },
  { x: 560, y: 1040, name: "AEGYPTUS" },
  { x: 1120, y: 470, name: "MESOPOTAMIA" },
  { x: 1380, y: 700, name: "PERSIS" },
  { x: 1500, y: 250, name: "BACTRIA" },
  { x: 1840, y: 430, name: "INDIA" },
];

/** True when a point is out at sea. */
export function inSea(p: Pt) {
  return SEAS.some(({ pts }) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i];
      const b = pts[j];
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  });
}

/** The road: a smooth curve through every site, sampled finely, with distance along it. */
const PER = 24;
export const ROAD = (() => {
  const s = SITES;
  const pts: Pt[] = [];
  for (let i = 0; i < s.length - 1; i++) {
    const p0 = s[Math.max(0, i - 1)];
    const p1 = s[i];
    const p2 = s[i + 1];
    const p3 = s[Math.min(s.length - 1, i + 2)];
    for (let k = 0; k < PER; k++) {
      const t = k / PER;
      const t2 = t * t;
      const t3 = t2 * t;
      pts.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  pts.push(s[s.length - 1]);
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, len, total: len[len.length - 1], siteAt: (i: number) => len[i * PER] };
})();

/** The point (and heading) a given distance along the road. */
export function along(d: number): Pt & { angle: number } {
  const { pts, len } = ROAD;
  const x = Math.max(0, Math.min(ROAD.total, d));
  let i = 1;
  while (i < len.length - 1 && len[i] < x) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const t = len[i] === len[i - 1] ? 0 : (x - len[i - 1]) / (len[i] - len[i - 1]);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

/** The road from one distance to another, as a path. */
export function roadPath(from: number, to: number) {
  const { pts, len } = ROAD;
  const out: Pt[] = [along(from)];
  for (let i = 0; i < pts.length; i++) if (len[i] > from && len[i] < to) out.push(pts[i]);
  out.push(along(to));
  return toPath(out, false);
}

/** Distance to the road from a point (for keeping scenery off it). */
export function distanceToRoad(p: Pt) {
  let best = Infinity;
  for (let i = 0; i < ROAD.pts.length; i += 3) best = Math.min(best, Math.hypot(ROAD.pts[i].x - p.x, ROAD.pts[i].y - p.y));
  return best;
}

/**
 * Where each of the day's tasks sits: at the historic sites along the road, spread out evenly
 * from the first to the last before the treasure. More tasks than sites share the road between.
 */
export function stationsFor(count: number): { d: number; name: string; note: string }[] {
  const inner = SITES.length - 2; // between camp and the treasure
  if (count <= 0) return [];
  if (count <= inner) {
    const picks = count === 1 ? [Math.round(inner / 2)] : Array.from({ length: count }, (_, i) => 1 + Math.round((i * (inner - 1)) / (count - 1)));
    return picks.map((k) => ({ d: ROAD.siteAt(k), name: SITES[k].name, note: SITES[k].note }));
  }
  return Array.from({ length: count }, (_, i) => {
    const d = ((i + 1) / (count + 1)) * ROAD.total;
    const k = Math.min(SITES.length - 2, Math.max(1, Math.round((d / ROAD.total) * (SITES.length - 1))));
    return { d, name: `Road to ${SITES[k].name.replace(/^The /, "")}`, note: "a camp on the march" };
  });
}

/** Conquered first (in the order taken), then fallen, then what's ahead (in your order). */
export function campaignOrder(tasks: Task[]) {
  const rank = (t: Task) => (t.done ? 0 : t.failed ? 1 : 2);
  return [...tasks].sort((a, b) => rank(a) - rank(b) || (a.done ? (a.completedAt ?? 0) - (b.completedAt ?? 0) : (a.order ?? a.createdAt) - (b.order ?? b.createdAt)));
}

/** Experience: every task taken, ever, and every perfect day. */
export const XP_PER_TASK = 100;
export const XP_PER_PERFECT_DAY = 250;
const TITLES = ["Recruit", "Hoplite", "Companion", "Captain", "Commander", "General", "Satrap", "King", "Pharaoh", "Great King", "Conqueror", "Legend"];

export function experience(doneTasks: number, perfectDays: number) {
  const xp = doneTasks * XP_PER_TASK + perfectDays * XP_PER_PERFECT_DAY;
  const level = Math.floor(Math.sqrt(xp / 250)) + 1;
  const from = 250 * (level - 1) ** 2;
  const to = 250 * level ** 2;
  return { xp, level, title: TITLES[Math.min(level - 1, TITLES.length - 1)], into: xp - from, span: to - from, nextTitle: TITLES[Math.min(level, TITLES.length - 1)] };
}
