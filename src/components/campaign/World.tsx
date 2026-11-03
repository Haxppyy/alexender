"use client";

import { memo, useMemo } from "react";
import { DESERTS, distanceToRoad, FORESTS, inSea, RANGES, REGIONS, RIVERS, rng, ROAD, SEAS, SITES, toPath, WORLD, type Pt } from "@/lib/expedition";

/*
 * The land itself, drawn once: seas washed in green-grey with pale shallows along the coasts,
 * inked coastlines, rivers, shaded mountain ranges lit from the north-west, forests, deserts
 * stippled with sand, scattered hills, region names, the old road — and a ship, a sea serpent and
 * the waves, which move a little. Nothing here changes with your day, so it never re-renders.
 */

export const INK = "#3b2612";
export const INK_SOFT = "#6e4d2b";
export const BLOOD = "#8f2516";
export const PAPER = "#e9d6a7";
export const SEA = "#9fb2a2";
export const SERIF = "Georgia, 'Times New Roman', ui-serif, serif";

const near = (p: Pt, list: Pt[], r: number) => list.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < r);

/** Mountains along each range, back to front so nearer peaks overlap farther ones. */
function useMountains() {
  return useMemo(() => {
    const out: (Pt & { s: number })[] = [];
    RANGES.forEach((range, ri) => {
      const r = rng(100 + ri);
      const segs = range.pts.length - 1;
      for (let i = 0; i < range.n; i++) {
        const t = (i + r() * 0.6) / range.n;
        const si = Math.min(segs - 1, Math.floor(t * segs));
        const lt = t * segs - si;
        const a = range.pts[si];
        const b = range.pts[si + 1];
        const p = { x: a.x + (b.x - a.x) * lt + (r() - 0.5) * 30, y: a.y + (b.y - a.y) * lt + (r() - 0.5) * 34 };
        if (distanceToRoad(p) < 34 || near(p, SITES, 46)) continue;
        out.push({ ...p, s: range.size * (0.65 + r() * 0.6) });
      }
    });
    return out.sort((a, b) => a.y - b.y);
  }, []);
}

/** Forests, hills and waves, scattered where they belong and clear of the road and the cities. */
function useScatter() {
  return useMemo(() => {
    const trees: (Pt & { s: number })[] = [];
    FORESTS.forEach((f, fi) => {
      const r = rng(200 + fi);
      const n = Math.round((f.w * f.h) / 520);
      for (let i = 0; i < n; i++) {
        const p = { x: f.x + r() * f.w, y: f.y + r() * f.h };
        if (inSea(p) || distanceToRoad(p) < 30 || near(p, SITES, 44)) continue;
        trees.push({ ...p, s: 0.8 + r() * 0.5 });
      }
    });
    const hills: Pt[] = [];
    const waves: Pt[] = [];
    const r = rng(300);
    for (let i = 0; i < 520; i++) {
      const p = { x: 40 + r() * (WORLD.w - 80), y: 40 + r() * (WORLD.h - 80) };
      if (inSea(p)) {
        if (waves.length < 90) waves.push(p);
        continue;
      }
      if (hills.length > 70 || distanceToRoad(p) < 44 || near(p, SITES, 60)) continue;
      if (DESERTS.some((d) => ((p.x - d.x) / d.rx) ** 2 + ((p.y - d.y) / d.ry) ** 2 < 1)) continue;
      if (RANGES.some((g) => g.pts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 60))) continue;
      hills.push(p);
    }
    return { trees: trees.sort((a, b) => a.y - b.y), hills, waves };
  }, []);
}

export const World = memo(function World() {
  const mountains = useMountains();
  const { trees, hills, waves } = useScatter();
  const road = useMemo(() => toPath(ROAD.pts, false), []);

  return (
    <svg width={WORLD.w} height={WORLD.h} viewBox={`0 0 ${WORLD.w} ${WORLD.h}`} className="absolute inset-0 block" fontFamily={SERIF} aria-hidden>
      <defs>
        <radialGradient id="w-sea" cx="0.5" cy="0.5" r="0.7">
          <stop offset="0" stopColor="#8aa293" />
          <stop offset="1" stopColor="#a9baa8" />
        </radialGradient>
        <radialGradient id="w-sand">
          <stop offset="0" stopColor="#d6ac62" stopOpacity="0.55" />
          <stop offset="0.7" stopColor="#d9b46e" stopOpacity="0.28" />
          <stop offset="1" stopColor="#d9b46e" stopOpacity="0" />
        </radialGradient>
        <pattern id="w-stipple" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="3" r="0.9" fill="#8a6a35" opacity="0.5" />
          <circle cx="6.5" cy="7.5" r="0.7" fill="#8a6a35" opacity="0.4" />
        </pattern>
        {/* A mountain, lit from the upper left: a bright face, a shaded face, a cap of snow. */}
        <symbol id="w-mtn" viewBox="-24 -36 48 40" overflow="visible">
          <ellipse cx="3" cy="1" rx="24" ry="4.5" fill="#5a3a18" opacity="0.16" />
          <path d="M0 -32 L22 0 L0 0 Z" fill="#b08b54" />
          <path d="M0 -32 L-22 0 L0 0 Z" fill="#efe1bd" />
          <path d="M0 -32 L-6 -22 L-2 -24 L1 -19 L5 -23 Z" fill="#fffaf0" />
          <path d="M-22 0 L0 -32 L22 0" fill="none" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M5 -22 L11 -12 M9 -15 L15 -6 M3 -12 L8 -4" stroke={INK} strokeWidth="0.6" opacity="0.7" />
        </symbol>
        <symbol id="w-tree" viewBox="-9 -20 18 22" overflow="visible">
          <ellipse cx="2" cy="1" rx="7" ry="2" fill="#5a3a18" opacity="0.18" />
          <path d="M0 0 V-7" stroke={INK} strokeWidth="1.1" />
          <circle cy="-12" r="7" fill="#8f8c55" stroke={INK} strokeWidth="1" />
          <circle cx="-2.4" cy="-14" r="3" fill="#b6b173" />
        </symbol>
      </defs>

      {/* Deserts: a wash of sand, stippled. */}
      {DESERTS.map((d, i) => (
        <g key={i}>
          <ellipse cx={d.x} cy={d.y} rx={d.rx} ry={d.ry} fill="url(#w-sand)" />
          <ellipse cx={d.x} cy={d.y} rx={d.rx * 0.8} ry={d.ry * 0.8} fill="url(#w-stipple)" opacity="0.7" />
          {[-0.4, 0, 0.35].map((k, j) => (
            <path key={j} d={`M${d.x + k * d.rx - 26} ${d.y + (j - 1) * d.ry * 0.35} q13 -8 26 0 q13 -8 26 0`} fill="none" stroke={INK_SOFT} strokeWidth="0.9" opacity="0.5" />
          ))}
          {d.name && (
            <text x={d.x} y={d.y + d.ry * 0.62} textAnchor="middle" fontSize="15" letterSpacing="6" fill={INK_SOFT} opacity="0.45">
              {d.name}
            </text>
          )}
        </g>
      ))}

      {/* The seas: deep water, pale shallows along the coast, an inked shore. */}
      {SEAS.map((sea, i) => {
        const d = toPath(sea.pts);
        return (
          <g key={sea.name}>
            <clipPath id={`w-sea-clip-${i}`}>
              <path d={d} />
            </clipPath>
            <path d={d} fill="url(#w-sea)" />
            <g clipPath={`url(#w-sea-clip-${i})`} fill="none">
              <path d={d} stroke="#d3dcc6" strokeWidth="30" opacity="0.45" />
              <path d={d} stroke="#e8eddc" strokeWidth="12" opacity="0.45" />
              <path d={d} stroke="#5f7c71" strokeWidth="44" opacity="0.12" strokeDasharray="1 9" />
            </g>
            <path d={d} fill="none" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
            {sea.label && (
              <text x={sea.label.x} y={sea.label.y} transform={sea.label.r ? `rotate(${sea.label.r} ${sea.label.x} ${sea.label.y})` : undefined} textAnchor="middle" fontSize="19" fontStyle="italic" letterSpacing="5" fill="#3f5d55" opacity="0.7">
                {sea.name}
              </text>
            )}
          </g>
        );
      })}

      {/* Waves, rising and falling. */}
      <g className="w-waves" stroke="#4b6a61" strokeWidth="1" fill="none" opacity="0.55" strokeLinecap="round">
        {waves.map((w, i) => (
          <path key={i} d={`M${w.x - 9} ${w.y} q4.5 -4 9 0 t9 0`} style={{ animationDelay: `${(i % 9) * -0.7}s` }} />
        ))}
      </g>

      {/* Rivers. */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {RIVERS.map((r, i) => (
          <g key={i}>
            <path d={toPath(r.pts, false)} stroke="#e7ecdc" strokeWidth={r.w + 3} opacity="0.6" />
            <path d={toPath(r.pts, false)} stroke="#4d7068" strokeWidth={r.w} />
          </g>
        ))}
      </g>

      {/* Hills. */}
      <g fill="none" stroke={INK_SOFT} strokeWidth="1" strokeLinecap="round" opacity="0.55">
        {hills.map((h, i) => (
          <g key={i}>
            <path d={`M${h.x - 11} ${h.y} Q${h.x} ${h.y - 10} ${h.x + 11} ${h.y}`} />
            <path d={`M${h.x + 2} ${h.y - 4} l4 4 M${h.x + 5} ${h.y - 6} l4 5`} strokeWidth="0.6" />
          </g>
        ))}
      </g>

      {/* Region names, faint and wide. */}
      {REGIONS.map((r) => (
        <text key={r.name} x={r.x} y={r.y} textAnchor="middle" fontSize="17" letterSpacing="9" fill={INK_SOFT} opacity="0.32">
          {r.name}
        </text>
      ))}

      {/* The old road, dotted all the way. */}
      <path d={road} fill="none" stroke={INK_SOFT} strokeWidth="2.4" strokeDasharray="1.5 8" strokeLinecap="round" opacity="0.75" />

      {/* Forests and mountains, back to front. */}
      {trees.map((t, i) => (
        <use key={`t${i}`} href="#w-tree" x={t.x - 9 * t.s} y={t.y - 20 * t.s} width={18 * t.s} height={22 * t.s} />
      ))}
      {mountains.map((m, i) => (
        <use key={`m${i}`} href="#w-mtn" x={m.x - m.s * 0.75} y={m.y - m.s * 1.12} width={m.s * 1.5} height={m.s * 1.25} />
      ))}

      {/* A ship under sail, crossing the sea. */}
      <g>
        <g>
          <path d="M-18 4 H18 L12 12 H-12 Z" fill="#a6784a" stroke={INK} strokeWidth="1.1" />
          <path d="M0 4 V-24" stroke={INK} strokeWidth="1.2" />
          <path d="M1 -22 Q14 -13 1 -3 Z" fill="#f0e3c2" stroke={INK} strokeWidth="1" />
          <path d="M-1 -19 Q-12 -11 -1 -2 Z" fill="#f0e3c2" stroke={INK} strokeWidth="1" />
          <path d="M0 -24 l7 2.5 l-7 2.5" fill={BLOOD} />
          <animateMotion dur="70s" repeatCount="indefinite" path="M180 640 C320 600 520 640 640 700 C540 760 300 780 180 740 C120 700 120 670 180 640 Z" />
        </g>
      </g>

      {/* Here be dragons: a serpent in the far ocean. */}
      <g className="w-serpent" transform="translate(1540 1130)" fill="#7f8b5d" stroke={INK} strokeWidth="1.2">
        <path d="M-50 0 C-50 -26 -26 -26 -26 0" />
        <path d="M-14 0 C-14 -32 14 -32 14 0" />
        <path d="M26 0 C26 -34 52 -36 52 -14 L62 -12 L52 -6" />
        <circle cx="49" cy="-18" r="1.8" fill={INK} stroke="none" />
        <path d="M-60 4 q8 -5 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" fill="none" strokeWidth="0.9" />
      </g>

      {/* A compass rose in the open ocean. */}
      <g transform="translate(1830 1110)" opacity="0.85">
        <circle r="54" fill="none" stroke={INK} strokeWidth="1" />
        <circle r="46" fill="none" stroke={INK} strokeWidth="0.5" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <path d={`M0 ${a % 90 ? -38 : -60} L${a % 90 ? 5 : 8} 0 L0 0 Z`} fill={a % 90 ? PAPER : INK} stroke={INK} strokeWidth="0.7" />
            <path d={`M0 ${a % 90 ? -38 : -60} L${a % 90 ? -5 : -8} 0 L0 0 Z`} fill={a % 90 ? INK : PAPER} stroke={INK} strokeWidth="0.7" />
          </g>
        ))}
        <circle r="4" fill={BLOOD} stroke={INK} />
        <text y="-66" textAnchor="middle" fontSize="15" fontWeight="700" fill={INK}>
          N
        </text>
      </g>

      {/* The cartographer's border. */}
      <rect x="10" y="10" width={WORLD.w - 20} height={WORLD.h - 20} fill="none" stroke={INK} strokeWidth="2" opacity="0.55" />
      <rect x="18" y="18" width={WORLD.w - 36} height={WORLD.h - 36} fill="none" stroke={INK} strokeWidth="0.8" opacity="0.4" />
    </svg>
  );
});
