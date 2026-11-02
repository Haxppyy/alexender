"use client";

import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BarChart,
  Heatmap,
  TrendChart,
  type HeatCell,
} from "@/components/charts";
import { Segmented } from "@/components/ui";
import { addDays, formatShort, fromKey, toKey, WEEKDAYS } from "@/lib/date";
import { currentStreak, dayResult, lastNDays, rangeSummary } from "@/lib/stats";
import { useClock, useStore } from "@/lib/store";
import { cn, formatMinutes } from "@/lib/utils";
import { minutesByDay } from "@/lib/timer";

/** Day colour: crystal for a won day, grey otherwise — stronger the more you finished. */
const dayFill = (pct: number, win: boolean) =>
  `color-mix(in oklab, ${win ? "var(--crystal)" : "var(--fg)"} ${win ? 16 + pct * 0.2 : 4 + pct * 0.1}%, transparent)`;

type Range = "7" | "30" | "90";

const longDate = (key: string) =>
  fromKey(key).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

/** The chosen day's tasks: done, or — once the day is over — not done. */
function DayTasks({ date, today }: { date: string; today: string }) {
  const all = useStore((s) => s.tasks);
  const tasks = useMemo(() => all.filter((t) => t.date === date).sort((a, b) => Number(b.done) - Number(a.done) || (a.order ?? 0) - (b.order ?? 0)), [all, date]);
  if (!tasks.length) return null;
  const over = date < today;
  return (
    <ul key={date} className="animate-fade mx-auto mt-3 max-w-md space-y-0.5 px-1">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-start gap-3 py-1.5 text-[13.5px] leading-snug">
          {t.done ? (
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-fg text-bg">
              <Check className="size-2.5" strokeWidth={3.5} />
            </span>
          ) : over || t.failed ? (
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger">
              <X className="size-2.5" strokeWidth={3.5} />
            </span>
          ) : (
            <span className="mt-0.5 size-4 shrink-0 rounded-full border-[1.5px] border-faint" />
          )}
          <span className={cn("min-w-0 flex-1 break-words", t.done ? "text-muted" : over || t.failed ? "text-faint" : "")}>{t.title}</span>
          {!t.done && (over || t.failed) && <span className="shrink-0 text-[11px] text-danger/80">Not done</span>}
        </li>
      ))}
    </ul>
  );
}

export default function CalendarPage() {
  const today = useClock((s) => s.today);
  const days = useStore((s) => s.days);
  const sessions = useStore((s) => s.timerSessions);
  const now = useClock((s) => s.now);
  const threshold = useStore((s) => s.settings.winThreshold);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [range, setRange] = useState<Range>("30");
  const touchX = useRef<number | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const shift = useCallback((dir: number) => {
    setMonth((m) => {
      const [y, mo] = m.split("-").map(Number);
      return toKey(new Date(y, mo - 1 + dir, 1)).slice(0, 7);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        /INPUT|TEXTAREA/.test(e.target.tagName)
      )
        return;
      if (e.key === "ArrowLeft") shift(-1);
      if (e.key === "ArrowRight") shift(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shift]);

  /** Jump to a day from any chart: select it and bring the calendar into view. */
  const pickDay = (date: string) => {
    setSelected(date);
    setMonth(date.slice(0, 7));
    calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Minutes timed in the Timer, per day.
  const focus = useMemo(() => minutesByDay(sessions, now), [sessions, now]);

  const stats = useMemo(() => {
    const dates = lastNDays(today, Number(range));
    const summary = rangeSummary(days, dates, today, threshold);
    let best = 0;
    let run = 0;
    for (const d of dates) {
      run = dayResult(days[d], d, today, threshold) === "win" ? run + 1 : 0;
      best = Math.max(best, run);
    }
    const focusMin = dates.reduce((s, d) => s + (focus[d] ?? 0), 0);
    const finished = dates.reduce(
      (s, d) => s + (d <= today ? (days[d]?.done ?? 0) : 0),
      0,
    );
    return {
      ...summary,
      dates,
      best,
      focusMin,
      finished,
      streak: currentStreak(days, today, threshold),
    };
  }, [days, today, threshold, range, focus]);

  const trend = stats.dates.map((date) => {
    const log = days[date];
    const has = !!log && log.total > 0;
    const result = dayResult(log, date, today, threshold);
    // A day still under way would read as a drop; it joins the line once it's won or over.
    const live = result === "live";
    return {
      key: date,
      value: has && !live ? log.pct : null,
      label:
        range === "7"
          ? fromKey(date).toLocaleDateString(undefined, { weekday: "short" })
          : formatShort(date),
      detail: has
        ? `${live ? `In progress · ${log.pct}% · ` : ""}${log.done} of ${log.total} done${focus[date] ? ` · ${formatMinutes(focus[date])}` : ""}`
        : "Nothing planned",
      win: result === "win",
    };
  });

  // Average completion by weekday over the last 12 weeks — your weekly rhythm.
  const rhythm = useMemo(() => {
    const sums = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
    for (const d of lastNDays(today, 84)) {
      const log = days[d];
      if (!log || log.total === 0 || d > today) continue;
      const w = fromKey(d).getDay();
      sums[w].sum += log.pct;
      sums[w].n++;
    }
    const avgs = sums.map((s) => (s.n ? Math.round(s.sum / s.n) : 0));
    const top = Math.max(...avgs);
    // Monday first.
    return [1, 2, 3, 4, 5, 6, 0].map((w) => ({
      key: String(w),
      value: avgs[w],
      label: WEEKDAYS[w].slice(0, 2),
      tone:
        avgs[w] > 0 && avgs[w] === top ? ("crystal" as const) : ("fg" as const),
      tip: (
        <>
          <p className="text-faint">{WEEKDAYS[w]}s</p>
          <p className="mt-0.5 font-mono text-[14px] text-fg tabular-nums">
            {sums[w].n ? `${avgs[w]}%` : "—"}
          </p>
          <p className="mt-0.5 text-muted">
            {sums[w].n
              ? `average of ${sums[w].n} day${sums[w].n > 1 ? "s" : ""}`
              : "no days yet"}
          </p>
        </>
      ),
    }));
  }, [days, today]);

  const focusBars = stats.dates.map((date) => ({
    key: date,
    value: focus[date] ?? 0,
    tone: "fg" as const,
    tip: (
      <>
        <p className="text-faint">{longDate(date)}</p>
        <p className="mt-0.5 font-mono text-[14px] text-fg tabular-nums">
          {focus[date] ? formatMinutes(focus[date]) : "—"}
        </p>
      </>
    ),
  }));

  // The last 26 weeks, Sunday to Saturday.
  const heat = useMemo(() => {
    const start = addDays(today, -fromKey(today).getDay() - 25 * 7);
    const weeks: HeatCell[][] = [];
    const labels: (string | null)[] = [];
    let lastMonth = -1;
    for (let w = 0; w < 26; w++) {
      const week: HeatCell[] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(start, w * 7 + d);
        const log = days[date];
        const future = date > today;
        const has = !!log && log.total > 0;
        week.push({
          key: date,
          value: future ? undefined : has ? log.pct : null,
          win: dayResult(log, date, today, threshold) === "win",
          tip: `${longDate(date)} · ${has ? `${log.pct}% (${log.done}/${log.total})` : "nothing planned"}`,
        });
      }
      const m = fromKey(week[0].key).getMonth();
      labels.push(
        m !== lastMonth && w < 25
          ? fromKey(week[0].key).toLocaleDateString(undefined, {
              month: "short",
            })
          : null,
      );
      lastMonth = m;
      weeks.push(week);
    }
    return { weeks, labels };
  }, [days, today, threshold]);

  const [y, mo] = month.split("-").map(Number);
  const first = toKey(new Date(y, mo - 1, 1));
  const start = addDays(first, -fromKey(first).getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));

  const selLog = days[selected];
  const selResult = dayResult(selLog, selected, today, threshold);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Headline numbers for the chosen range. */}
      <div className="mb-4 flex justify-center">
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
          ]}
        />
      </div>
      <div className="stagger grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-4">
        <Stat
          i={0}
          value={`${stats.avg}%`}
          label="average"
          accent={stats.avg >= threshold && stats.counted > 0}
        />
        <Stat
          i={1}
          value={`${stats.wins}/${stats.wins + stats.losses}`}
          label="days won"
        />
        <Stat
          i={2}
          value={`${stats.streak}`}
          unit="d"
          label={`streak · best ${stats.best}`}
        />
        <Stat
          i={3}
          value={stats.focusMin ? formatMinutes(stats.focusMin) : "0m"}
          label={`focus · ${stats.finished} done`}
        />
      </div>

      <Panel title="Completion">
        <TrendChart
          key={range}
          points={trend}
          target={threshold}
          onPick={pickDay}
        />
      </Panel>

      {/* The month. */}
      <div ref={calendarRef} className="mt-14 scroll-mt-20">
        <div className="mb-5 flex items-center justify-center gap-4">
          <button
            aria-label="Previous month"
            onClick={() => shift(-1)}
            className="flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => {
              setMonth(today.slice(0, 7));
              setSelected(today);
            }}
            title="Back to today"
            className="min-w-44 text-[19px] font-semibold tracking-tight"
          >
            {new Date(y, mo - 1, 1).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </button>
          <button
            aria-label="Next month"
            onClick={() => shift(1)}
            className="flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div
          className="mx-auto max-w-md"
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 60) shift(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <div className="grid grid-cols-7 pb-2 text-center text-[11px] text-faint">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w[0]}</span>
            ))}
          </div>
          <div key={month} className="animate-fade grid grid-cols-7 gap-1.5">
            {cells.map((date) => {
              const log = days[date];
              const has = !!log && log.total > 0 && date <= today;
              const planned = !!log && log.total > 0 && date > today;
              const r = dayResult(log, date, today, threshold);
              return (
                <button
                  key={date}
                  onClick={() => setSelected(date)}
                  aria-label={`${longDate(date)}${has ? `, ${log.pct}%` : ""}`}
                  aria-pressed={date === selected}
                  style={has ? { background: dayFill(log.pct, r === "win") } : undefined}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl transition-[box-shadow,background-color,transform] duration-200 active:scale-95",
                    !has && "hover:bg-surface",
                    date === selected && "ring-1 ring-fg/70",
                    fromKey(date).getMonth() !== mo - 1 && "opacity-25",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-[14px] tabular-nums",
                      date === today
                        ? "bg-fg font-semibold text-bg"
                        : "text-fg",
                    )}
                  >
                    {fromKey(date).getDate()}
                  </span>
                  <span
                    className={cn(
                      "flex h-3 items-center font-mono text-[10px] leading-3 tabular-nums",
                      r === "win" ? "text-crystal" : "text-muted",
                    )}
                  >
                    {has ? (
                      `${log.pct}%`
                    ) : planned ? (
                      <span className="size-1 rounded-full bg-muted" />
                    ) : (
                      ""
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* The chosen day, in numbers only. */}
        <div
          key={selected}
          className="animate-fade mx-auto mt-6 flex max-w-md items-center justify-between rounded-2xl border border-line px-5 py-4"
        >
          <div>
            <p className="text-[12px] text-faint">
              {fromKey(selected).toLocaleDateString(undefined, {
                weekday: "long",
              })}
            </p>
            <p className="text-[16px] font-medium">
              {fromKey(selected).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="text-right">
            {selLog && selLog.total > 0 ? (
              selected > today ? (
                <p className="font-mono text-[13px] text-muted">
                  {selLog.total} planned
                </p>
              ) : (
                <>
                  <p
                    className={cn(
                      "font-mono text-[20px] tabular-nums",
                      selResult === "win"
                        ? "text-crystal"
                        : selResult === "loss"
                          ? "text-muted"
                          : "text-fg",
                    )}
                  >
                    {selLog.pct}%
                  </p>
                  <p className="text-[11px] text-faint">
                    {selLog.done}/{selLog.total} done
                    {focus[selected]
                      ? ` · ${formatMinutes(focus[selected])}`
                      : ""}
                    {selResult === "win" ? " · won" : ""}
                  </p>
                </>
              )
            ) : (
              <p className="text-[13px] text-faint">Nothing planned</p>
            )}
          </div>
        </div>
        <DayTasks date={selected} today={today} />
      </div>

      <div
        className={cn(
          "mt-2 grid gap-x-10",
          stats.focusMin > 0 && "sm:grid-cols-2",
        )}
      >
        <Panel title="Weekly rhythm" note="Last 12 weeks">
          <BarChart bars={rhythm} max={100} height={130} />
        </Panel>
        {stats.focusMin > 0 && (
          <Panel title="Focus time" note={`Last ${range} days`}>
            <BarChart bars={focusBars} height={130} onPick={pickDay} />
          </Panel>
        )}
      </div>

      <Panel title="Six months" note="Blue days were won">
        <Heatmap
          weeks={heat.weeks}
          monthLabels={heat.labels}
          onPick={pickDay}
        />
      </Panel>
    </div>
  );
}

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-14">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-medium tracking-[0.24em] text-faint uppercase">
          {title}
        </h2>
        {note && <p className="text-[11px] text-faint/80">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Stat({
  value,
  unit,
  label,
  accent,
  i,
}: {
  value: string;
  unit?: string;
  label: string;
  accent?: boolean;
  i: number;
}) {
  return (
    <div
      style={{ ["--i" as string]: i }}
      className="bg-bg px-4 py-5 text-center"
    >
      <p
        className={cn(
          "font-mono text-[24px] font-medium tracking-tight tabular-nums",
          accent ? "text-crystal" : "text-fg",
        )}
      >
        {value}
        {unit && <span className="ml-0.5 text-[14px] text-faint">{unit}</span>}
      </p>
      <p className="mt-1 text-[11px] text-faint">{label}</p>
    </div>
  );
}
