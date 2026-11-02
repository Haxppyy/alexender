"use client";

import { useCallback, useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Small hand-built charts in the Alexander style: one series each, thin marks, recessive axes,
 * a crosshair or per-mark tooltip on hover (and on touch — scrub with a finger).
 */

function useWidth<T extends HTMLElement>() {
  const [width, setWidth] = useState(0);
  // Measured the moment the element appears (so the first frame is already drawn), then kept up to date.
  const ref = useCallback((el: T | null) => {
    if (!el) return;
    setWidth(Math.floor(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Tooltip card that follows the hovered point and stays inside the chart. */
function Tip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  const w = 148;
  const left = Math.min(Math.max(x - w / 2, 0), Math.max(0, width - w));
  return (
    <div
      role="status"
      style={{ left, width: w }}
      className="pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-xl border border-line-strong bg-surface-2/95 px-3 py-2 text-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-md"
    >
      {children}
    </div>
  );
}

export interface TrendPoint {
  key: string;
  /** 0–100, or null for a day with nothing planned (drawn as a gap). */
  value: number | null;
  label: string;
  detail?: string;
  win?: boolean;
}

/** Daily completion as a line with a soft area, a dashed target and a scrubbing crosshair. */
export function TrendChart({ points, target, height = 190, onPick }: { points: TrendPoint[]; target?: number; height?: number; onPick?: (key: string) => void }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gradient = useId();
  const pad = { l: 30, r: 8, t: 14, b: 24 };
  const n = points.length;
  const innerW = Math.max(1, width - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;
  const step = n > 1 ? innerW / (n - 1) : 0;
  const x = (i: number) => pad.l + (n > 1 ? i * step : innerW / 2);
  const y = (v: number) => pad.t + (1 - v / 100) * innerH;

  // Split into runs of consecutive days that had tasks.
  const runs: number[][] = [];
  points.forEach((p, i) => {
    if (p.value === null) return;
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] === i - 1) last.push(i);
    else runs.push([i]);
  });
  const line = (run: number[]) => run.map((i, j) => `${j ? "L" : "M"}${x(i).toFixed(1)},${y(points[i].value!).toFixed(1)}`).join("");
  const area = (run: number[]) => `${line(run)}L${x(run[run.length - 1]).toFixed(1)},${y(0)}L${x(run[0]).toFixed(1)},${y(0)}Z`;

  // The chart fills its box, so the point under the pointer comes from the chart's own position.
  const pick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (n === 0) return null;
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - box.left - pad.l) / (step || 1));
    return Math.min(n - 1, Math.max(0, i));
  };

  const ticks = [0, Math.floor(n / 2), n - 1].filter((v, i, a) => n > 0 && a.indexOf(v) === i);
  const h = hover !== null ? points[hover] : null;
  const drawKey = points.map((p) => p.value ?? "-").join(",");

  return (
    <div ref={ref} className="relative select-none" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="block touch-pan-y"
          onPointerMove={(e) => setHover(pick(e))}
          onPointerDown={(e) => setHover(pick(e))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const i = pick(e);
            if (i !== null) onPick?.(points[i].key);
          }}
          role="img"
          aria-label="Daily completion trend"
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--crystal)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--crystal)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
              <text x={pad.l - 8} y={y(v) + 3.5} textAnchor="end" className="fill-faint font-mono text-[10px]">
                {v}
              </text>
            </g>
          ))}
          {target !== undefined && (
            <g>
              <line x1={pad.l} x2={width - pad.r} y1={y(target)} y2={y(target)} stroke="var(--crystal)" strokeOpacity="0.45" strokeDasharray="3 4" />
              <text x={pad.l + 4} y={y(target) - 5} className="fill-crystal/70 text-[10px]">
                target {target}%
              </text>
            </g>
          )}
          <g key={drawKey} className="animate-reveal">
            {runs.map((run) => (
              <path key={`a${run[0]}`} d={area(run)} fill={`url(#${gradient})`} />
            ))}
            {runs.map((run) =>
              run.length > 1 ? (
                <path
                  key={`l${run[0]}`}
                  d={line(run)}
                  fill="none"
                  stroke="var(--fg)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : (
                <circle key={`d${run[0]}`} cx={x(run[0])} cy={y(points[run[0]].value!)} r={2.5} fill="var(--fg)" />
              ),
            )}
            {/* Won days get a quiet crystal mark on the line. */}
            {points.map((p, i) =>
              p.win && p.value !== null ? <circle key={p.key} cx={x(i)} cy={y(p.value)} r={2.5} fill="var(--crystal)" /> : null,
            )}
          </g>
          {ticks.map((i) => (
            <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-faint text-[10px]">
              {points[i].label}
            </text>
          ))}
          {h && hover !== null && (
            <g className="pointer-events-none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={y(0)} stroke="var(--muted)" strokeOpacity="0.5" />
              {h.value !== null && <circle cx={x(hover)} cy={y(h.value)} r={5} fill={h.win ? "var(--crystal)" : "var(--fg)"} stroke="var(--bg)" strokeWidth={2} />}
            </g>
          )}
        </svg>
      )}
      {h && hover !== null && (
        <Tip x={x(hover)} width={width}>
          <p className="text-faint">{h.label}</p>
          <p className="mt-0.5 font-mono text-[14px] text-fg tabular-nums">
            {h.value === null ? "—" : `${h.value}%`}
            {h.win && <span className="ml-2 font-sans text-[11px] text-crystal">won</span>}
          </p>
          {h.detail && <p className="mt-0.5 text-muted">{h.detail}</p>}
        </Tip>
      )}
    </div>
  );
}

export interface Bar {
  key: string;
  value: number;
  label?: string;
  tip: ReactNode;
  tone?: "crystal" | "fg" | "muted";
}

/** Vertical bars that grow in and show a tooltip for the bar under the pointer. */
export function BarChart({ bars, height = 120, max, onPick, labelEvery = 1 }: { bars: Bar[]; height?: number; max?: number; onPick?: (key: string) => void; labelEvery?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const top = Math.max(1, max ?? Math.max(...bars.map((b) => b.value), 1));
  const hasLabels = bars.some((b) => b.label);
  const slot = bars.length ? width / bars.length : 0;
  const barAt = (e: React.PointerEvent | React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(bars.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * bars.length)));
  };

  return (
    <div ref={ref} className="relative select-none" onPointerLeave={() => setHover(null)}>
      <div
        className="flex touch-pan-y items-end gap-[3px]"
        style={{ height }}
        onPointerDown={(e) => setHover(barAt(e))}
        onPointerMove={(e) => (e.pointerType !== "mouse" || e.buttons) && setHover(barAt(e))}
        // A tap between two thin bars still picks the nearest one.
        onClick={(e) => e.target === e.currentTarget && onPick?.(bars[barAt(e)].key)}
      >
        {bars.map((b, i) => (
          <button
            key={b.key}
            type="button"
            aria-label={typeof b.tip === "string" ? b.tip : b.label}
            onPointerEnter={() => setHover(i)}
            onPointerDown={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            onClick={() => onPick?.(b.key)}
            className="flex h-full min-w-0 flex-1 items-end outline-none"
          >
            <span
              style={{ height: `${Math.max(b.value > 0 ? 4 : 2, (b.value / top) * 100)}%`, animationDelay: `${Math.min(i, 30) * 14}ms` }}
              className={cn(
                "animate-grow block w-full rounded-t-[4px] rounded-b-[1px] transition-[opacity,background-color] duration-200",
                b.value <= 0 ? "bg-surface-3" : b.tone === "crystal" ? "bg-crystal" : b.tone === "muted" ? "bg-muted/40" : "bg-fg/30 hover:bg-fg/70",
                hover !== null && hover !== i && "opacity-35",
              )}
            />
          </button>
        ))}
      </div>
      {hasLabels && (
        <div className="mt-2 flex gap-[3px]">
          {bars.map((b, i) => (
            <span key={b.key} className={cn("min-w-0 flex-1 truncate text-center text-[10px] text-faint", hover === i && "text-fg")}>
              {i % labelEvery === 0 ? b.label : ""}
            </span>
          ))}
        </div>
      )}
      {hover !== null && bars[hover] && (
        <Tip x={slot * hover + slot / 2} width={width}>
          {bars[hover].tip}
        </Tip>
      )}
    </div>
  );
}

export interface HeatCell {
  key: string;
  /** 0–100, null when nothing was planned, undefined for days outside the range. */
  value: number | null | undefined;
  win?: boolean;
  tip: string;
}

/** Weeks as columns, weekdays as rows — the last months at a glance. */
export function Heatmap({ weeks, monthLabels, onPick }: { weeks: HeatCell[][]; monthLabels: (string | null)[]; onPick?: (key: string) => void }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ w: number; d: number } | null>(null);
  const cols = weeks.length;
  const gap = 3;
  const cell = cols ? Math.max(6, Math.floor((width - gap * (cols - 1)) / cols)) : 0;
  const hc = hover ? weeks[hover.w]?.[hover.d] : null;

  const fill = (c: HeatCell) => {
    if (c.value === undefined) return "transparent";
    if (c.value === null) return "var(--surface-2)";
    return `color-mix(in oklab, ${c.win ? "var(--crystal)" : "var(--fg)"} ${c.win ? 45 + c.value * 0.45 : 8 + c.value * 0.32}%, var(--surface-2))`;
  };

  return (
    <div ref={ref} className="relative select-none" onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <>
          <div className="mb-1.5 flex text-[10px] text-faint" style={{ gap }}>
            {monthLabels.map((m, i) => (
              <span key={i} className="overflow-visible whitespace-nowrap" style={{ width: cell }}>
                {m}
              </span>
            ))}
          </div>
          <div className="flex" style={{ gap }}>
            {weeks.map((week, w) => (
              <div key={w} className="flex flex-col" style={{ gap }}>
                {week.map((c, d) => (
                  <button
                    key={c.key}
                    type="button"
                    disabled={c.value === undefined}
                    aria-label={c.tip}
                    onPointerEnter={() => setHover({ w, d })}
                    onPointerDown={() => setHover({ w, d })}
                    onClick={() => onPick?.(c.key)}
                    style={{ width: cell, height: cell, background: fill(c), animationDelay: `${w * 12}ms` }}
                    className={cn(
                      "animate-fade rounded-[3px] transition-transform duration-150 outline-none",
                      c.value !== undefined && "hover:scale-125 focus-visible:ring-1 focus-visible:ring-fg",
                      hover?.w === w && hover.d === d && "ring-1 ring-fg/70",
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </>
      )}
      {hc && hover && hc.value !== undefined && (
        <Tip x={(cell + gap) * hover.w + cell / 2} width={width}>
          {hc.tip}
        </Tip>
      )}
    </div>
  );
}
