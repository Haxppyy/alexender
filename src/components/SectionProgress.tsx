import { AnimatedNumber, ProgressBar } from "./ui";

/** Each section's own progress, the same quiet way everywhere: a thin bar and one line of numbers. */
export function SectionProgress({ value, label, detail }: { value: number; label: string; detail?: string }) {
  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
        <span className="text-muted">
          <span className="text-[18px] font-semibold text-fg tabular-nums">
            <AnimatedNumber value={Math.round(value)} />%
          </span>{" "}
          {label}
        </span>
        {detail && <span className="text-faint tabular-nums">{detail}</span>}
      </div>
      <ProgressBar value={value} tone="crystal" className="mt-2.5 h-1.5" />
    </div>
  );
}
