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

/** One sword, point up: a steel blade with a ridge, a gold guard, a wrapped grip and a pommel. */
function Sword({ id, angle }: { id: string; angle: number }) {
  return (
    <g transform={`rotate(${angle} 60 60) translate(60 60) scale(1.32) translate(-60 -60)`}>
      <polygon points="60,6 64.5,16 64.5,78 60,82 55.5,78 55.5,16" fill={`url(#${id}-steel)`} />
      <line x1="60" y1="10" x2="60" y2="78" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.8" />
      <rect x="44" y="78" width="32" height="5" rx="2.5" fill={`url(#${id}-gold)`} />
      <rect x="57" y="83" width="6" height="16" rx="2" fill="#3a2414" />
      <circle cx="60" cy="102" r="4.2" fill={`url(#${id}-gold)`} />
    </g>
  );
}

/** Victory: two crossed swords behind a gold-rimmed shield, the prize set in its face. */
export function VictoryEmblem({ gem, size = 200 }: { gem: GemKind; size?: number }) {
  const id = useId().replace(/:/g, "");
  const shield = "M60 18 L96 30 V58 C96 84 78 100 60 108 C42 100 24 84 24 58 V30 Z";
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} className="absolute inset-0 overflow-visible" aria-hidden style={{ filter: "drop-shadow(0 10px 30px rgb(0 0 0 / 0.6))" }}>
        <defs>
          <linearGradient id={`${id}-steel`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7d8794" />
            <stop offset="0.45" stopColor="#f4f7fb" />
            <stop offset="0.55" stopColor="#c9d0da" />
            <stop offset="1" stopColor="#5b6470" />
          </linearGradient>
          <linearGradient id={`${id}-gold`} x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor="#fff3c2" />
            <stop offset="0.45" stopColor="#e0ac34" />
            <stop offset="0.75" stopColor="#7a4c0c" />
            <stop offset="1" stopColor="#d79f2c" />
          </linearGradient>
          <radialGradient id={`${id}-enamel`} cx="0.5" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#24201a" />
            <stop offset="1" stopColor="#060504" />
          </radialGradient>
        </defs>
        <Sword id={id} angle={-44} />
        <Sword id={id} angle={44} />
        <path d={shield} fill={`url(#${id}-gold)`} />
        <path d={shield} fill={`url(#${id}-enamel)`} transform="translate(60 63) scale(0.84) translate(-60 -63)" />
        <path d={shield} fill="none" stroke={`url(#${id}-gold)`} strokeWidth="1.2" strokeDasharray="1.6 2.4" transform="translate(60 63) scale(0.74) translate(-60 -63)" />
      </svg>
      <Gem kind={gem} size={size * 0.34} className="relative mt-[6%]" />
    </span>
  );
}

/**
 * A treasure chest, drawn with some care: oak planks with grain, iron corners and rivets, gold
 * bands and a lock plate. Open, the lid tips back and the inside glows with coins and light.
 */
export function Chest({ size = 72, open, className }: { size?: number; open?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const rivets = [16, 84];
  return (
    <svg viewBox="0 0 100 90" width={size} height={size * 0.9} className={cn("overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a4822" />
          <stop offset="0.55" stopColor="#5a3214" />
          <stop offset="1" stopColor="#2b1608" />
        </linearGradient>
        <linearGradient id={`${id}-lid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a5428" />
          <stop offset="1" stopColor="#4a2810" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1b8" />
          <stop offset="0.45" stopColor="#e0ac34" />
          <stop offset="0.8" stopColor="#8a5a12" />
          <stop offset="1" stopColor="#c9952a" />
        </linearGradient>
        <linearGradient id={`${id}-iron`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9aa2ad" />
          <stop offset="0.5" stopColor="#4d535c" />
          <stop offset="1" stopColor="#2a2e33" />
        </linearGradient>
        <radialGradient id={`${id}-light`} cx="0.5" cy="1" r="1">
          <stop offset="0" stopColor="#fff6d6" stopOpacity="1" />
          <stop offset="0.35" stopColor="#f5c95a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#e0ac34" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Light pouring out when open. */}
      <g style={{ opacity: open ? 1 : 0, transition: "opacity 0.6s ease-out" }}>
        <ellipse cx="50" cy="30" rx="58" ry="44" fill={`url(#${id}-light)`} />
        {[-36, -18, 0, 18, 36].map((a) => (
          <path key={a} d="M50 40 L44 -30 L56 -30 Z" fill="#fff3c2" opacity="0.22" transform={`rotate(${a} 50 40)`} />
        ))}
      </g>

      {/* The inside: dark, heaped with gold. */}
      {open && (
        <g>
          <rect x="12" y="34" width="76" height="12" rx="2" fill="#1a0d04" />
          {[20, 30, 40, 50, 60, 70, 80].map((x, i) => (
            <ellipse key={x} cx={x} cy={38 + (i % 2) * 2} rx="6" ry="3" fill={`url(#${id}-gold)`} stroke="#8a5a12" strokeWidth="0.5" />
          ))}
          <ellipse cx="44" cy="33" rx="5" ry="2.6" fill={`url(#${id}-gold)`} stroke="#8a5a12" strokeWidth="0.5" />
          <ellipse cx="58" cy="32" rx="5" ry="2.6" fill={`url(#${id}-gold)`} stroke="#8a5a12" strokeWidth="0.5" />
        </g>
      )}

      {/* Body: planks with grain. */}
      <rect x="10" y="42" width="80" height="42" rx="4" fill={`url(#${id}-wood)`} />
      <g stroke="#2b1608" strokeOpacity="0.55" strokeWidth="0.8">
        <line x1="10" y1="56" x2="90" y2="56" />
        <line x1="10" y1="70" x2="90" y2="70" />
      </g>
      <g stroke="#a06a38" strokeOpacity="0.35" strokeWidth="0.5" fill="none">
        <path d="M32 48 q8 2 16 0 t16 0" />
        <path d="M34 62 q8 -2 16 0 t14 0" />
        <path d="M32 77 q9 2 18 0 t12 0" />
      </g>
      <rect x="10" y="42" width="80" height="5" fill={`url(#${id}-gold)`} />
      <rect x="21" y="42" width="7" height="42" fill={`url(#${id}-gold)`} />
      <rect x="72" y="42" width="7" height="42" fill={`url(#${id}-gold)`} />
      {/* Iron corners and rivets. */}
      <path d="M10 72 V84 H22 Z M90 72 V84 H78 Z" fill={`url(#${id}-iron)`} />
      {rivets.map((x) => (
        <g key={x} fill="#f6e3a6">
          <circle cx={x === 16 ? 24.5 : 75.5} cy="50" r="1.1" />
          <circle cx={x === 16 ? 24.5 : 75.5} cy="64" r="1.1" />
          <circle cx={x === 16 ? 24.5 : 75.5} cy="78" r="1.1" />
        </g>
      ))}
      {/* Lock plate. */}
      <path d="M42 47 h16 v14 q0 5 -8 7 q-8 -2 -8 -7 Z" fill={`url(#${id}-gold)`} stroke="#6b4310" strokeWidth="0.6" />
      <path d="M50 53 a2.3 2.3 0 1 1 0.01 0 M49 55 h2 l0.6 5 h-3.2 Z" fill="#2b1608" />

      {/* Lid: closed, or tipped back on its hinge. */}
      <g style={{ transformOrigin: "12px 42px", transformBox: "view-box", transform: open ? "translateY(-6px) rotate(-22deg)" : "none", transition: "transform 0.55s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <path d="M10 42 V30 Q10 13 50 13 Q90 13 90 30 V42 Z" fill={`url(#${id}-lid)`} />
        <path d="M14 30 Q14 18 50 18 Q86 18 86 30" fill="none" stroke="#a06a38" strokeOpacity="0.35" strokeWidth="0.6" />
        <path d="M10 30 Q10 13 50 13 Q90 13 90 30" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="4" />
        <rect x="21" y="15" width="7" height="27" fill={`url(#${id}-gold)`} />
        <rect x="72" y="15" width="7" height="27" fill={`url(#${id}-gold)`} />
        <rect x="10" y="38" width="80" height="4" fill={`url(#${id}-gold)`} />
        <path d="M30 20 Q50 15 70 20" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
