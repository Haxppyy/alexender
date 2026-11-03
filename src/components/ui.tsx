"use client";

import { Check, ChevronDown, ImagePlus, Plus, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { saveImages, useImageUrl } from "@/lib/images";
import { useBackToClose } from "@/lib/useBackToClose";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline" | "danger";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl font-medium transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35",
        size === "sm" ? "h-9 px-3.5 text-[13px]" : "h-12 px-5 text-[15px]",
        variant === "primary" && "bg-fg text-bg hover:bg-white",
        variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-fg",
        variant === "outline" && "border border-line-strong text-fg hover:border-faint hover:bg-surface-2",
        variant === "danger" && "text-danger hover:bg-danger/10",
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({ className, label, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-faint transition-[background-color,color,transform] duration-150 hover:bg-surface-2 hover:text-fg active:scale-90 disabled:opacity-25",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, children, ...props }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface p-5 sm:p-6", className)} {...props}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex min-h-8 items-center justify-between gap-2">
      <h2 className="text-[11px] font-medium tracking-[0.2em] text-faint uppercase">{children}</h2>
      {action}
    </div>
  );
}

const field =
  "w-full rounded-xl border border-line bg-surface text-fg outline-none transition-[border-color,background-color,box-shadow] duration-150 placeholder:text-faint focus:border-line-strong focus:bg-surface-2 focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--crystal)_10%,transparent)]";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, "h-11 px-3.5", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "resize-none p-3.5", className)} {...props} />;
}

export function Checkbox({ checked, onChange, label, size = "md" }: { checked: boolean; onChange: () => void; label: string; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        // A larger invisible hit area keeps small circles easy to tap.
        "relative flex shrink-0 items-center justify-center rounded-full border-[1.5px] transition-[background-color,border-color] duration-200 before:absolute before:-inset-2.5 before:content-['']",
        size === "sm" ? "size-4" : "size-6",
        checked ? "animate-ring border-fg bg-fg text-bg" : "border-faint hover:border-fg",
      )}
    >
      {checked && <Check className={cn("animate-check", size === "sm" ? "size-2.5" : "size-4")} strokeWidth={3.2} />}
    </button>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useBackToClose(open, onClose, { lockScroll: true });

  if (!open) return null;
  // Portal to <body> so animated (transformed) page containers can't trap the fixed overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="animate-fade absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line-strong bg-surface shadow-[0_-20px_60px_rgba(0,0,0,0.6)] sm:rounded-3xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line-strong sm:hidden" />
        <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-2 sm:pt-4">
          <div className="min-w-0 flex-1 text-[17px] font-semibold">{title}</div>
          <IconButton label="Close" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 pt-1 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function ProgressBar({ value, className, tone }: { value: number; className?: string; tone?: "success" | "crystal" }) {
  const full = value >= 100;
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 ease-out",
          tone === "success" ? "bg-success" : tone === "crystal" ? "bg-crystal" : "bg-fg",
          // A light sweeps across once when a bar fills up.
          full && "bar-shine",
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/**
 * A number that glides to its new value instead of jumping — 42 → 57 counts up in half a second.
 * `from` lets a number count up when it first appears.
 */
export function AnimatedNumber({ value, from, format = (n: number) => String(Math.round(n)), duration = 650 }: { value: number; from?: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(from ?? value);
  const at = useRef(from ?? value);
  useEffect(() => {
    const start = at.current;
    if (start === value) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const began = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const k = reduce ? 1 : Math.min(1, (now - began) / duration);
      const next = start + (value - start) * (1 - Math.pow(1 - k, 3));
      at.current = next;
      setShown(next);
      if (k < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return <>{format(shown)}</>;
}

/** The same calm empty state everywhere: a soft icon, one line of what this is, one of how to start. */
export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="animate-rise flex items-start gap-4 py-2">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-crystal">{icon}</span>
      <span className="min-w-0 pt-0.5">
        <span className="block text-[17px] font-semibold">{title}</span>
        <span className="mt-1 block text-[14.5px] leading-relaxed text-faint">{hint}</span>
      </span>
    </div>
  );
}

/** Segmented control with a sliding highlight. */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className="relative inline-grid rounded-xl border border-line bg-surface p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-lg bg-surface-3 transition-transform duration-300"
        style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${index * 100}%)`, transitionTimingFunction: "var(--ease-out)" }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn("relative z-10 rounded-lg px-3 py-2 text-[14px] font-medium whitespace-nowrap sm:px-4 transition-colors", value === o.value ? "text-fg" : "text-muted hover:text-fg")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A dark dropdown that matches the app — the browser's own list is white on Windows and
 * can't be styled. Arrow keys, Enter and Escape work; a tap outside closes it.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  menuClassName,
  wide,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; dot?: string }[];
  label: string;
  className?: string;
  menuClassName?: string;
  /** Fill the width of its container, like a form field. */
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const show = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const pick = (v: T) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={root} className={cn("relative", wide ? "flex w-full" : "inline-flex")}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) return show();
            setActive((i) => (i + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
          } else if ((e.key === "Enter" || e.key === " ") && open) {
            e.preventDefault();
            pick(options[active].value);
          }
        }}
        className={cn("inline-flex items-center gap-1.5 text-fg outline-none", className)}
      >
        {current?.dot && <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: current.dot }} />}
        <span className="truncate">{current?.label}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-faint transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <ul
          ref={list}
          role="listbox"
          aria-label={label}
          className={cn(
            "animate-fade absolute top-[calc(100%+0.5rem)] left-0 z-40 max-h-72 min-w-[10rem] overflow-y-auto rounded-xl border border-line-strong bg-surface-2 p-1 shadow-[0_12px_40px_rgba(0,0,0,0.6)]",
            menuClassName,
          )}
        >
          {options.map((o, i) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                tabIndex={-1}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13.5px] whitespace-nowrap transition-colors",
                  i === active ? "bg-surface-3 text-fg" : "text-muted",
                )}
              >
                {o.dot && <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: o.dot }} />}
                <span className="flex-1">{o.label}</span>
                {o.value === value && <Check className="size-3.5 text-crystal" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StoredImage({ id, className, alt = "" }: { id?: string; className?: string; alt?: string }) {
  const url = useImageUrl(id);
  if (!url) return <div className={cn("animate-pulse bg-surface-2", className)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={cn("animate-fade object-cover", className)} />;
}

export function ImageUploadButton({
  onAdd,
  multiple = true,
  className,
  children,
  plain,
}: {
  onAdd: (ids: string[]) => void;
  multiple?: boolean;
  className?: string;
  children?: ReactNode;
  plain?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={async (e) => {
          if (e.target.files?.length) onAdd(await saveImages(e.target.files));
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          ref.current?.click();
        }}
        className={cn(
          "flex items-center justify-center gap-2 rounded-2xl text-sm transition-colors",
          !plain && "border border-dashed border-line-strong text-muted hover:border-crystal/60 hover:text-fg",
          className,
        )}
      >
        {children ?? (
          <>
            <ImagePlus className="size-4" /> Add images
          </>
        )}
      </button>
    </>
  );
}

/** Text that turns into an input on click; saves on Enter or blur, cancels on Escape. */
export function EditableText({ value, onSave, className, placeholder }: { value: string; onSave: (value: string) => void; className?: string; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  // Set once Enter or Escape has handled the edit, so the blur that follows doesn't act again.
  const handled = useRef(false);
  if (editing) {
    const finish = (input: HTMLInputElement) => {
      if (handled.current) return;
      handled.current = true;
      setEditing(false);
      const next = input.value.trim();
      if (next !== value) onSave(next);
    };
    return (
      <input
        autoFocus
        defaultValue={value}
        placeholder={placeholder}
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => finish(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === "Enter") finish(e.currentTarget);
          if (e.key === "Escape") {
            e.preventDefault(); // cancels this edit only, not a view it sits in
            handled.current = true;
            setEditing(false);
          }
        }}
        className={cn("-mx-1 w-full rounded-md bg-surface-2 px-1 outline-none", className)}
      />
    );
  }
  return (
    <button
      type="button"
      title="Click to edit"
      onClick={(e) => {
        e.stopPropagation();
        handled.current = false;
        setEditing(true);
      }}
      // A taller invisible tap area than the line of text, without changing the layout.
      className={cn("relative block max-w-full cursor-text text-left before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']", !value && "text-faint", className)}
    >
      {value || placeholder}
    </button>
  );
}

/** The small round "+ Add …" button used at the top of sections. */
export function PillButton({ active, children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      className={cn(
        "group inline-flex h-11 items-center gap-2 rounded-full border px-5 text-[14.5px] font-medium transition-[border-color,color,background-color,transform] duration-200 active:scale-[0.97]",
        active ? "border-crystal/70 bg-crystal-soft text-fg" : "border-line-strong text-muted hover:border-faint hover:text-fg",
        className,
      )}
    >
      <Plus className={cn("size-4 transition-transform duration-300", active ? "rotate-45 text-crystal" : "group-hover:rotate-90")} />
      {children}
    </button>
  );
}

export interface AddAction {
  label: string;
  placeholder: string;
  onAdd: (text: string) => void;
  /** Keep the input open after adding, for entering several in a row. */
  keepOpen?: boolean;
}

/**
 * The one box for adding things, the same in every section: type, press Enter or +. It stays
 * focused, so several go in one after another. Anything extra (a topic, a source) sits beneath.
 */
export function AddBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  footer,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  label: string;
  footer?: ReactNode;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit();
      }}
      className={cn("rounded-2xl border border-line bg-surface p-1.5 transition-colors focus-within:border-line-strong", className)}
    >
      <div className="flex items-center gap-2 pl-2.5">
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          enterKeyHint="done"
          className="h-11 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          aria-label={label}
          disabled={!value.trim()}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-fg text-bg transition-[transform,opacity] active:scale-90 disabled:opacity-25"
        >
          <Plus className="size-5" strokeWidth={2.4} />
        </button>
      </div>
      {footer && <div className="mt-1 border-t border-line px-2.5 pt-1.5 pb-0.5">{footer}</div>}
    </form>
  );
}

/** The top of a section: anything it needs (a switch, a button), and the box for adding. */
export function SectionTop({ actions = [], children }: { actions?: AddAction[]; children?: ReactNode }) {
  const [text, setText] = useState("");
  const action = actions[0];
  return (
    <div className="mb-8 space-y-4">
      {children && <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>}
      {action && (
        <AddBar
          value={text}
          onChange={setText}
          onSubmit={() => {
            action.onAdd(text.trim());
            setText("");
          }}
          placeholder={action.placeholder}
          label={action.label}
        />
      )}
    </div>
  );
}

// ---------- Toasts: brief confirmation with an optional undo ----------

interface ToastItem {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

const useToasts = create<{ items: ToastItem[] }>(() => ({ items: [] }));
let nextToast = 1;

export function toast(message: string, action?: ToastItem["action"]) {
  const id = nextToast++;
  useToasts.setState((s) => ({ items: [...s.items.slice(-2), { id, message, action }] }));
  setTimeout(() => useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) })), action ? 5000 : 2600);
}

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-8">
      {items.map((t) => (
        <div
          key={t.id}
          className="animate-toast pointer-events-auto flex max-w-full items-center gap-4 rounded-full border border-line-strong bg-surface-2/95 py-2.5 pr-2 pl-5 text-[14.5px] font-medium shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        >
          <span>{t.message}</span>
          {t.action ? (
            <button
              onClick={() => {
                t.action!.run();
                useToasts.setState((s) => ({ items: s.items.filter((x) => x.id !== t.id) }));
              }}
              className="rounded-full px-3 py-1 font-medium text-crystal hover:bg-crystal-soft"
            >
              {t.action.label}
            </button>
          ) : (
            <span className="pr-2" />
          )}
        </div>
      ))}
    </div>
  );
}
