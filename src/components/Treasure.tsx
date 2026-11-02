"use client";

import { useId } from "react";
import type { GemKind, Metal } from "@/lib/achievements";
import { cn } from "@/lib/utils";

/*
 * The gems and medals, drawn by hand in SVG: a brilliant-cut stone with lit and shaded facets, a
 * light that sweeps across it and a glint that twinkles; and a struck-metal medal with a laurel,
 * an enamel face and a gem set in the middle.
 */

/** Facet shades for each stone, lightest to deepest. */
export const GEM_COLORS: Record<GemKind, { glint: string; light: string; mid: string; dark: string; deep: string; glow: string }> = {
  sapphire: { glint: "#eef7ff", light: "#9fd0ff", mid: "#3d8bf0", dark: "#1d4fb8", deep: "#0c2766", glow: "#4f9dff" },
  emerald: { glint: "#eafff3", light: "#9ef2c6", mid: "#2fbf7a", dark: "#138a53", deep: "#08482b", glow: "#2fd487" },
  ruby: { glint: "#fff0f3", light: "#ffa3b6", mid: "#e8375d", dark: "#a5163a", deep: "#560a1d", glow: "#ff4d72" },
  diamond: { glint: "#ffffff", light: "#f4f9ff", mid: "#d3e6fb", dark: "#9fbbdb", deep: "#6d87a8", glow: "#cfe6ff" },
};

export const METAL_COLORS: Record<Metal, { hi: string; mid: string; lo: string; name: string }> = {
  bronze: { hi: "#ffd9b0", mid: "#c07a3e", lo: "#5e3213", name: "Bronze" },
  silver: { hi: "#ffffff", mid: "#c3cad6", lo: "#5d6676", name: "Silver" },
  gold: { hi: "#fff3c2", mid: "#e0ac34", lo: "#7a4c0c", name: "Gold" },
  platinum: { hi: "#ffffff", mid: "#d8e4f2", lo: "#7189a8", name: "Platinum" },
};

// Brilliant cut, front view: a table, a crown of five facets, a pavilion of three.
const T = [
  [25, 26],
  [50, 26],
  [75, 26],
];
const G = [
  [7, 42],
  [33, 42],
  [67, 42],
  [93, 42],
];
const P = [50, 94];
const pts = (...p: number[][]) => p.map(([x, y]) => `${x},${y}`).join(" ");
const OUTLINE = pts(G[0], T[0], T[2], G[3], P);

export function Gem({ kind, size = 64, className, animated = true }: { kind: GemKind; size?: number; className?: string; animated?: boolean }) {
  const c = GEM_COLORS[kind];
  const id = useId().replace(/:/g, "");
  const facets: [string, string][] = [
    [pts(G[0], T[0], G[1]), c.mid],
    [pts(T[0], T[1], G[1]), c.light],
    [pts(G[1], T[1], G[2]), c.glint],
    [pts(T[1], T[2], G[2]), c.light],
    [pts(T[2], G[3], G[2]), c.dark],
    [pts(G[0], G[1], P), c.dark],
    [pts(G[1], G[2], P), c.mid],
    [pts(G[2], G[3], P), c.deep],
  ];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={cn("overflow-visible", className)} style={{ filter: `drop-shadow(0 ${size / 14}px ${size / 5}px color-mix(in oklab, ${c.glow} 45%, transparent))` }} aria-hidden>
      <defs>
        <clipPath id={`${id}-clip`}>
          <polygon points={OUTLINE} />
        </clipPath>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id={`${id}-sweep`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {kind === "diamond" && (
          <linearGradient id={`${id}-prism`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffb3d9" stopOpacity="0.35" />
            <stop offset="0.35" stopColor="#b3e1ff" stopOpacity="0.3" />
            <stop offset="0.65" stopColor="#c9ffd6" stopOpacity="0.25" />
            <stop offset="1" stopColor="#ffe9a8" stopOpacity="0.3" />
          </linearGradient>
        )}
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        {facets.map(([p, fill], i) => (
          <polygon key={i} points={p} fill={fill} />
        ))}
        {kind === "diamond" && <polygon points={OUTLINE} fill={`url(#${id}-prism)`} style={{ mixBlendMode: "color" }} />}
        <polygon points={OUTLINE} fill={`url(#${id}-sheen)`} />
        {/* A band of light passing across the stone. */}
        {animated && (
          <rect x="-60" y="0" width="40" height="100" fill={`url(#${id}-sweep)`} transform="skewX(-20)">
            <animate attributeName="x" values="-60;140;140" keyTimes="0;0.45;1" dur="3.6s" repeatCount="indefinite" />
          </rect>
        )}
      </g>
      {/* Facet edges, cut fine. */}
      <g fill="none" stroke={c.glint} strokeOpacity="0.55" strokeWidth="0.8" strokeLinejoin="round">
        <polygon points={OUTLINE} strokeOpacity="0.8" />
        <polyline points={pts(G[0], G[3])} />
        <polyline points={pts(T[0], G[1], T[1], G[2], T[2])} />
        <polyline points={pts(G[1], P, G[2])} />
      </g>
      {/* The glint. */}
      <path d="M78 14 L80 21 L87 23 L80 25 L78 32 L76 25 L69 23 L76 21 Z" fill="#fff" opacity={animated ? undefined : 0.9}>
        {animated && <animate attributeName="opacity" values="0;1;0;0" keyTimes="0;0.15;0.35;1" dur="3.6s" repeatCount="indefinite" />}
      </path>
    </svg>
  );
}

/** A struck medal: metal rim, laurel, dark enamel, a gem set in the middle — dim and grey until earned. */
export function MedalBadge({ metal, gem, size = 88, locked, className }: { metal: Metal; gem: GemKind; size?: number; locked?: boolean; className?: string }) {
  const m = METAL_COLORS[metal];
  const id = useId().replace(/:/g, "");
  const leaves = Array.from({ length: 7 }, (_, i) => i);
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", locked && "opacity-35 grayscale", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="absolute inset-0 overflow-visible" aria-hidden style={locked ? undefined : { filter: `drop-shadow(0 ${size / 16}px ${size / 7}px color-mix(in oklab, ${m.mid} 35%, transparent))` }}>
        <defs>
          <linearGradient id={`${id}-metal`} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor={m.hi} />
            <stop offset="0.45" stopColor={m.mid} />
            <stop offset="0.7" stopColor={m.lo} />
            <stop offset="1" stopColor={m.mid} />
          </linearGradient>
          <radialGradient id={`${id}-enamel`} cx="0.5" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#202020" />
            <stop offset="1" stopColor="#050505" />
          </radialGradient>
        </defs>
        {/* Laurel: two branches of leaves around the lower rim. */}
        {[-1, 1].map((side) => (
          <g key={side} fill={`url(#${id}-metal)`}>
            {leaves.map((i) => {
              const a = side === -1 ? 200 - i * 16 : -20 + i * 16; // down each side of the rim
              const rad = (a * Math.PI) / 180;
              const x = 50 + Math.cos(rad) * 47;
              const y = 50 + Math.sin(rad) * 47;
              return <ellipse key={i} cx={x} cy={y} rx="3" ry="7" transform={`rotate(${a + 90 + side * 28} ${x} ${y})`} />;
            })}
          </g>
        ))}
        <circle cx="50" cy="50" r="42" fill={`url(#${id}-metal)`} />
        <circle cx="50" cy="50" r="42" fill="none" stroke={m.hi} strokeOpacity="0.6" strokeWidth="0.8" />
        <circle cx="50" cy="50" r="34" fill={`url(#${id}-enamel)`} />
        <circle cx="50" cy="50" r="31" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="1.2" strokeDasharray="1.5 2.2" />
      </svg>
      <Gem kind={gem} size={size * 0.42} animated={!locked} className="relative" />
    </span>
  );
}
