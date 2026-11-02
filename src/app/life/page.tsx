"use client";

import { Flame, Moon } from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";
import { AnimatedNumber, Input, ProgressBar, Segmented, Select } from "@/components/ui";
import { addDays, daysBetween, fromKey, toKey } from "@/lib/date";
import { computeLife, expectancyFor, formatNumber, LIFE_EXPECTANCY } from "@/lib/life";
import { tap } from "@/lib/motion";
import { useClock, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Mark = "used" | "wasted";
/** A used day is green; a wasted one goes dark. */
const MARK_FILL: Record<Mark, string> = { used: "var(--success)", wasted: "#000" };

const DAY = 86_400_000;

type View = "days" | "weeks" | "months" | "year";
const VIEWS: View[] = ["days", "weeks", "months", "year"];
const YEAR_DAYS = 365.2425;

/** What is left of today, this week, this month and this year. */
function useCycles(now: number) {
  return useMemo(() => {
    const d = new Date(now);
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const weekday = (d.getDay() + 6) % 7; // Monday first
    const endOfWeek = startOfDay + (7 - weekday) * DAY;
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    const endOfYear = new Date(d.getFullYear() + 1, 0, 1).getTime();
    return [
      { label: "Today", value: `${Math.ceil((startOfDay + DAY - now) / 3_600_000)}h` },
      { label: "Week", value: `${Math.ceil((endOfWeek - now) / DAY)}d` },
      { label: "Month", value: `${Math.ceil((endOfMonth - now) / DAY)}d` },
      { label: "Year", value: `${Math.ceil((endOfYear - now) / DAY)}d` },
    ];
  }, [now]);
}

/** Your time, plainly: what's left, how much is gone, and one picture of it. */
export default function LifePage() {
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const settings = useStore((s) => s.settings);
  const dayMarks = useStore((s) => s.dayMarks);
  const marks = useMemo(() => new Map(dayMarks.map((d) => [d.date, d.mark])), [dayMarks]);
  const [selected, setSelected] = useState(today);
  const updateSettings = useStore((s) => s.updateSettings);
  const [editing, setEditing] = useState(false);
  const view: View = VIEWS.includes(settings.lifeView as View) ? (settings.lifeView as View) : "weeks";
  const expectancy = expectancyFor(settings.country, settings.lifeExpectancy);
  const life = computeLife(settings.birthDate, expectancy, now);
  const cycles = useCycles(now);
  const year = new Date(now).getFullYear();
  const yearLeft = Math.ceil((new Date(year + 1, 0, 1).getTime() - now) / DAY);

  // The big number follows the picture below it.
  const headline: Record<View, [number, string]> = {
    days: [life.daysLeft, "days left"],
    weeks: [life.weeksLeft, "weeks left"],
    months: [life.monthsLeft, "months left"],
    year: [yearLeft, `days left in ${year}`],
  };
  const [count, unit] = headline[view];

  return (
    <div className="mx-auto max-w-xl">
      <section className="text-center">
        <p key={view} className="animate-fade text-[64px] leading-none font-semibold tracking-[-0.04em] tabular-nums sm:text-[80px]">
          <AnimatedNumber value={count} format={(n) => formatNumber(Math.round(n))} />
        </p>
        <p className="mt-3 text-[14px] text-muted">{unit}</p>
      </section>

      <section className="mx-auto mt-10 max-w-sm">
        <div className="mb-2 flex justify-between text-[12px] text-faint tabular-nums">
          <span>{life.pctLived.toFixed(1)}% lived</span>
          <span>{life.yearsLeft.toFixed(1)} years left</span>
        </div>
        <ProgressBar value={life.pctLived} />
      </section>

      <section className="mx-auto mt-10 grid max-w-sm grid-cols-4 text-center">
        {cycles.map((c) => (
          <div key={c.label}>
            <p className="text-[18px] font-semibold tabular-nums">{c.value}</p>
            <p className="mt-0.5 text-[11px] text-faint">{c.label}</p>
          </div>
        ))}
      </section>

      <MarkDay date={today} marks={marks} title="Today was" />

      <section className="mt-14">
        <div className="mb-5 flex justify-center">
          <Segmented<View>
            value={view}
            onChange={(lifeView) => updateSettings({ lifeView })}
            options={[
              { value: "days", label: "Days" },
              { value: "weeks", label: "Weeks" },
              { value: "months", label: "Months" },
              { value: "year", label: "This year" },
            ]}
          />
        </div>
        {view === "days" && <DayGrid total={Math.round(expectancy * YEAR_DAYS)} lived={life.daysLived} birth={settings.birthDate} marks={marks} />}
        {view === "weeks" && <Grid total={Math.ceil(expectancy) * 52} lived={life.weeksLived} cols={52} labelEvery={10 * 52} labelStep={10} />}
        {/* Two years to a row, so a decade is five rows. */}
        {view === "months" && <Grid total={Math.round(expectancy * 12)} lived={life.monthsLived} cols={24} labelEvery={120} labelStep={10} />}
        {view === "year" && <YearDays now={now} today={today} marks={marks} selected={selected} onSelect={setSelected} />}
        <p className="mt-4 text-center text-[11.5px] text-faint">
          {view === "year"
            ? "Each square is a day of this year — tap one to mark it."
            : `Each ${view === "days" ? "dot" : "square"} is one ${view.slice(0, -1)} of your life. The dim ones are gone.`}
          {(view === "year" || view === "days") && " Green: used. Dark: wasted."}
        </p>
        {view === "year" && selected !== today && <MarkDay date={selected} marks={marks} title={fromKey(selected).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} />}
        {(view === "year" || view === "days") && <MarkCounts marks={marks} today={today} />}
      </section>

      <section className="mt-12 pb-6 text-center">
        <button onClick={() => setEditing((e) => !e)} className="px-2 py-2.5 text-[12px] text-faint transition-colors hover:text-fg">
          Born {fromKey(settings.birthDate).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })} ·{" "}
          {settings.lifeExpectancy ? `${settings.lifeExpectancy} years (your estimate)` : `${settings.country}, ${expectancy} years`} ·{" "}
          <span className="underline underline-offset-4">{editing ? "done" : "change"}</span>
        </button>
        {editing && (
          <div className="animate-sheet mx-auto mt-5 grid max-w-md grid-cols-1 gap-3 text-left sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-[11px] text-faint">Born</span>
              <Input type="date" value={settings.birthDate} onChange={(e) => e.target.value && updateSettings({ birthDate: e.target.value })} />
            </label>
            <div>
              <span className="mb-1.5 block text-[11px] text-faint">Country</span>
              <Select
                label="Country"
                value={settings.country}
                onChange={(country) => updateSettings({ country })}
                options={Object.keys(LIFE_EXPECTANCY)
                  .sort()
                  .map((c) => ({ value: c, label: `${c} · ${LIFE_EXPECTANCY[c]}` }))}
                className="h-11 w-full justify-between rounded-xl border border-line bg-surface px-3.5 text-[14px]"
                menuClassName="w-full"
                wide
              />
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[11px] text-faint">Own estimate</span>
              <Input
                type="number"
                min={30}
                max={120}
                step={0.5}
                value={settings.lifeExpectancy ?? ""}
                placeholder={String(LIFE_EXPECTANCY[settings.country] ?? 72)}
                onChange={(e) => updateSettings({ lifeExpectancy: Number(e.target.value) || undefined })}
              />
            </label>
          </div>
        )}
      </section>
    </div>
  );
}

/** Width of an element, kept up to date. */
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

const DOT = 2; // whole pixels keep twenty-six thousand dots crisp
const PITCH = 3;
const LABELS = 24; // room on the left for the decade numbers

/**
 * Every day of a life, one dot each. Drawn as a few rectangles filled with repeating dot
 * patterns — so the whole life costs a handful of shapes, not 26,000 of them.
 */
function DayGrid({ total, lived, birth, marks }: { total: number; lived: number; birth: string; marks: Map<string, Mark> }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const id = useId().replace(/:/g, "");
  const cols = Math.max(40, Math.floor((width - LABELS) / PITCH));
  const rows = Math.ceil(total / cols);
  const today = Math.min(lived, total - 1);
  const tr = Math.floor(today / cols);
  const tc = today % cols;
  const fullRows = Math.floor(total / cols);
  const lastRow = total % cols;
  const W = cols * PITCH;
  const H = rows * PITCH;
  const decades = Array.from({ length: Math.floor(total / (YEAR_DAYS * 10)) + 1 }, (_, i) => i * 10);

  return (
    <div ref={ref} className="animate-fade">
      {width > 0 && (
        <div className="relative mx-auto" style={{ width: W + LABELS, paddingLeft: LABELS }}>
          {decades.map((y) => (
            <span
              key={y}
              className="absolute left-0 -translate-y-1/2 text-[10px] text-faint tabular-nums"
              style={{ top: Math.floor((y * YEAR_DAYS) / cols) * PITCH + 1 }}
            >
              {y}
            </span>
          ))}
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label={`Day ${formatNumber(lived)} of about ${formatNumber(total)}`}>
            <defs>
              <pattern id={`${id}-gone`} width={PITCH} height={PITCH} patternUnits="userSpaceOnUse">
                <rect width={DOT} height={DOT} fill="var(--surface-3)" />
              </pattern>
              <pattern id={`${id}-left`} width={PITCH} height={PITCH} patternUnits="userSpaceOnUse">
                <rect width={DOT} height={DOT} fill="var(--fg)" fillOpacity={0.42} />
              </pattern>
            </defs>
            {/* Gone: whole rows, then this row up to today. */}
            <rect width={W} height={tr * PITCH} fill={`url(#${id}-gone)`} />
            <rect y={tr * PITCH} width={tc * PITCH} height={PITCH} fill={`url(#${id}-gone)`} />
            {/* Still yours: the rest of this row, the rows after it, and the last short row. */}
            <rect x={(tc + 1) * PITCH} y={tr * PITCH} width={Math.max(0, (Math.min(cols, tr < fullRows ? cols : lastRow) - tc - 1) * PITCH)} height={PITCH} fill={`url(#${id}-left)`} />
            <rect y={(tr + 1) * PITCH} width={W} height={Math.max(0, fullRows - tr - 1) * PITCH} fill={`url(#${id}-left)`} />
            {lastRow > 0 && tr < fullRows && <rect y={fullRows * PITCH} width={lastRow * PITCH} height={PITCH} fill={`url(#${id}-left)`} />}
            {/* Today: a crystal dot with a soft ring, so one day among thousands is easy to find. */}
            <circle cx={tc * PITCH + DOT / 2} cy={tr * PITCH + DOT / 2} r={5} fill="none" stroke="var(--crystal)" strokeOpacity={0.5} strokeWidth={1}>
              <animate attributeName="stroke-opacity" values="0.6;0.15;0.6" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <rect x={tc * PITCH} y={tr * PITCH} width={DOT} height={DOT} fill="var(--crystal)" />
            {/* The days you marked: green for used, dark for wasted. */}
            {[...marks].map(([date, mark]) => {
              const i = daysBetween(birth, date);
              if (i < 0 || i >= total || i === today) return null;
              return <rect key={date} x={(i % cols) * PITCH} y={Math.floor(i / cols) * PITCH} width={DOT} height={DOT} fill={MARK_FILL[mark]} />;
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

/** One SVG for the whole grid — thousands of DOM nodes would be slow on phones. */
function Grid({ total, lived, cols, labelEvery, labelStep, big }: { total: number; lived: number; cols: number; labelEvery: number; labelStep: number; big?: boolean }) {
  const cell = big ? 24 : 10;
  const gap = big ? 6 : 3;
  const rows = Math.ceil(total / cols);
  const width = cols * (cell + gap) - gap;
  const height = rows * (cell + gap) - gap;
  const radius = big ? 5 : 2;

  const { past, future } = useMemo(() => {
    const past: string[] = [];
    const future: string[] = [];
    for (let i = 0; i < total; i++) {
      if (i === lived) continue;
      const x = (i % cols) * (cell + gap);
      const y = Math.floor(i / cols) * (cell + gap);
      (i < lived ? past : future).push(`M${x + radius},${y}h${cell - 2 * radius}a${radius},${radius} 0 0 1 ${radius},${radius}v${cell - 2 * radius}a${radius},${radius} 0 0 1 -${radius},${radius}h-${cell - 2 * radius}a${radius},${radius} 0 0 1 -${radius},-${radius}v-${cell - 2 * radius}a${radius},${radius} 0 0 1 ${radius},-${radius}z`);
    }
    return { past: past.join(""), future: future.join("") };
  }, [total, lived, cols, cell, gap, radius]);

  const cx = (lived % cols) * (cell + gap);
  const cy = Math.floor(lived / cols) * (cell + gap);
  const labels = Array.from({ length: Math.floor((total - 1) / labelEvery) + 1 }, (_, i) => i);

  return (
    <div className="animate-fade relative pl-6">
      {labels.map((i) => (
        <span
          key={i}
          className="absolute left-0 -translate-y-1/2 text-[10px] text-faint tabular-nums"
          style={{ top: `${(((Math.floor((i * labelEvery) / cols) * (cell + gap)) + cell / 2) / height) * 100}%` }}
        >
          {i * labelStep}
        </span>
      ))}
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label={`${lived} of ${total} lived`}>
        <path d={past} fill="var(--surface-2)" />
        <path d={future} fill="var(--fg)" fillOpacity={0.3} />
        {lived < total && (
          <rect x={cx} y={cy} width={cell} height={cell} rx={radius} fill="var(--crystal)">
            <animate attributeName="opacity" values="1;0.4;1" dur="2.4s" repeatCount="indefinite" />
          </rect>
        )}
      </svg>
    </div>
  );
}

/** This year as twelve rows of days: gone, today, ahead — and the days you marked. Tap a day to pick it. */
function YearDays({ now, today, marks, selected, onSelect }: { now: number; today: string; marks: Map<string, Mark>; selected: string; onSelect: (date: string) => void }) {
  const d = new Date(now);
  const year = d.getFullYear();
  const cell = 10;
  const tall = 15; // rows a little taller than wide, so the month letters breathe
  const gap = 3;
  const width = 31 * (cell + gap) - gap;
  const height = 12 * (tall + gap) - gap;
  const todayMonth = d.getMonth();
  const todayDate = d.getDate();

  const paths = useMemo(() => {
    const out: Record<"past" | "future" | Mark, string[]> = { past: [], future: [], used: [], wasted: [] };
    for (let m = 0; m < 12; m++) {
      const days = new Date(year, m + 1, 0).getDate();
      for (let day = 1; day <= days; day++) {
        if (m === todayMonth && day === todayDate) continue;
        const x = (day - 1) * (cell + gap);
        const y = m * (tall + gap);
        const isPast = m < todayMonth || (m === todayMonth && day < todayDate);
        const mark = isPast ? marks.get(toKey(new Date(year, m, day))) : undefined;
        out[mark ?? (isPast ? "past" : "future")].push(`M${x},${y}h${cell}v${tall}h-${cell}z`);
      }
    }
    return { past: out.past.join(""), future: out.future.join(""), used: out.used.join(""), wasted: out.wasted.join("") };
  }, [year, todayMonth, todayDate, marks]);

  const pick = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * width;
    const y = ((e.clientY - box.top) / box.height) * height;
    const day = Math.floor(x / (cell + gap)) + 1;
    const m = Math.floor(y / (tall + gap));
    if (m < 0 || m > 11 || day < 1 || day > new Date(year, m + 1, 0).getDate()) return;
    const date = toKey(new Date(year, m, day));
    if (date > today) return;
    tap(6);
    onSelect(date);
  };

  const sel = fromKey(selected);
  const todayMark = marks.get(today);
  const months = Array.from({ length: 12 }, (_, m) => new Date(year, m, 1).toLocaleDateString(undefined, { month: "narrow" }));
  return (
    <div className="animate-fade relative pl-6">
      {months.map((label, m) => (
        <span key={m} className="absolute left-0 -translate-y-1/2 text-[10px] text-faint" style={{ top: `${((m * (tall + gap) + tall / 2) / height) * 100}%` }}>
          {label}
        </span>
      ))}
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full cursor-pointer" role="img" aria-label={`Day ${todayDate} of month ${todayMonth + 1}`} onClick={pick}>
        <path d={paths.past} fill="var(--surface-2)" />
        <path d={paths.future} fill="var(--fg)" fillOpacity={0.3} />
        <path d={paths.used} fill={MARK_FILL.used} />
        <path d={paths.wasted} fill={MARK_FILL.wasted} stroke="var(--line-strong)" strokeWidth={0.8} />
        <rect x={(todayDate - 1) * (cell + gap)} y={todayMonth * (tall + gap)} width={cell} height={tall} rx={2} fill={todayMark ? MARK_FILL[todayMark] : "var(--crystal)"} stroke={todayMark ? "var(--crystal)" : undefined} strokeWidth={1}>
          {!todayMark && <animate attributeName="opacity" values="1;0.4;1" dur="2.4s" repeatCount="indefinite" />}
        </rect>
        {sel.getFullYear() === year && (
          <rect x={(sel.getDate() - 1) * (cell + gap) - 1.5} y={sel.getMonth() * (tall + gap) - 1.5} width={cell + 3} height={tall + 3} rx={3} fill="none" stroke="var(--fg)" strokeWidth={1.2} />
        )}
      </svg>
    </div>
  );
}

/** Used or wasted — tap again to take it back. */
function MarkDay({ date, marks, title }: { date: string; marks: Map<string, Mark>; title: string }) {
  const markDay = useStore((s) => s.markDay);
  const mark = marks.get(date);
  const set = (m: Mark) => {
    tap(m === "used" ? 12 : 24);
    markDay(date, mark === m ? undefined : m);
  };
  return (
    <section key={date} className="animate-fade mx-auto mt-6 max-w-sm">
      <p className="mb-2.5 text-center text-[13.5px] text-muted">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={mark === "used"}
          onClick={() => set("used")}
          className={cn(
            "flex h-14 items-center justify-center gap-2 rounded-2xl border text-[16px] font-semibold transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.97]",
            mark === "used" ? "border-success bg-success text-black" : "border-line-strong text-muted hover:text-fg",
          )}
        >
          <Flame className="size-5" /> Used
        </button>
        <button
          type="button"
          aria-pressed={mark === "wasted"}
          onClick={() => set("wasted")}
          className={cn(
            "flex h-14 items-center justify-center gap-2 rounded-2xl border text-[16px] font-semibold transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.97]",
            mark === "wasted" ? "border-fg/40 bg-black text-fg" : "border-line-strong text-muted hover:text-fg",
          )}
        >
          <Moon className="size-5" /> Wasted
        </button>
      </div>
    </section>
  );
}

/** This year and the last 30 days, in marks. */
function MarkCounts({ marks, today }: { marks: Map<string, Mark>; today: string }) {
  const year = today.slice(0, 4);
  const since = addDays(today, -29);
  let used = 0;
  let wasted = 0;
  let used30 = 0;
  for (const [date, mark] of marks) {
    if (date.startsWith(year)) {
      if (mark === "used") used++;
      else wasted++;
    }
    if (date >= since && date <= today && mark === "used") used30++;
  }
  if (!used && !wasted) return null;
  return (
    <p className="mt-6 text-center text-[13.5px] text-muted tabular-nums">
      <span className="font-semibold text-success">{used} used</span> · <span className="font-semibold text-fg">{wasted} wasted</span> in {year} · {used30} of the last 30 days used
    </p>
  );
}
