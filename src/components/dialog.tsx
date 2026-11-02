"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { useBackToClose } from "@/lib/useBackToClose";
import { cn } from "@/lib/utils";

/*
 * The app's own confirm / prompt / alert — dark and calm like everything else, instead of the
 * browser's white system boxes. Each returns a promise, so call sites read like the originals:
 * `if (!(await confirmDialog("Delete?"))) return;`
 */

interface Ask {
  id?: number;
  kind: "confirm" | "prompt" | "alert";
  message: string;
  detail?: string;
  confirmLabel?: string;
  danger?: boolean;
  password?: boolean;
  defaultValue?: string;
  inputMode?: "numeric" | "text";
  resolve: (value: string | boolean | null) => void;
}

const useAsk = create<{ current: Ask | null; queue: Ask[] }>(() => ({ current: null, queue: [] }));

let nextId = 1;

function open(ask: Ask) {
  ask.id = nextId++;
  useAsk.setState((s) => (s.current ? { queue: [...s.queue, ask] } : { current: ask }));
}

function settle(value: string | boolean | null) {
  const { current, queue } = useAsk.getState();
  current?.resolve(value);
  useAsk.setState({ current: queue[0] ?? null, queue: queue.slice(1) });
}

type Options = { detail?: string; confirmLabel?: string; danger?: boolean };

export const confirmDialog = (message: string, options: Options = {}) =>
  new Promise<boolean>((resolve) => open({ kind: "confirm", message, ...options, resolve: (v) => resolve(v === true) }));

export const promptDialog = (message: string, options: Options & { password?: boolean; defaultValue?: string; inputMode?: "numeric" | "text" } = {}) =>
  new Promise<string | null>((resolve) => open({ kind: "prompt", message, ...options, resolve: (v) => resolve(typeof v === "string" ? v : null) }));

export const alertDialog = (message: string, detail?: string) =>
  new Promise<void>((resolve) => open({ kind: "alert", message, detail, resolve: () => resolve() }));

/** Mounted once by the app shell. */
export function Dialogs() {
  const current = useAsk((s) => s.current);
  if (!current) return null;
  return <DialogCard key={current.id} ask={current} />;
}

function DialogCard({ ask }: { ask: Ask }) {
  const [value, setValue] = useState(ask.defaultValue ?? "");
  const cancel = () => settle(ask.kind === "prompt" ? null : false);
  const ok = () => settle(ask.kind === "prompt" ? value : true);
  // Back and Escape close only this box, never the view behind it.
  useBackToClose(true, cancel);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
      <div aria-hidden onClick={cancel} className="animate-fade absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <form
        role="alertdialog"
        aria-modal="true"
        aria-label={ask.message}
        onSubmit={(e) => {
          e.preventDefault();
          ok();
        }}
        className="animate-sheet relative w-full max-w-sm rounded-2xl border border-line-strong bg-surface-2 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
      >
        <p className="text-[17px] leading-snug font-semibold">{ask.message}</p>
        {ask.detail && <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{ask.detail}</p>}
        {ask.kind === "prompt" && (
          <input
            autoFocus
            type={ask.password ? "password" : "text"}
            inputMode={ask.inputMode}
            autoComplete={ask.password ? "current-password" : "off"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={ask.message}
            className="mt-4 h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[16px] outline-none focus:border-line-strong"
          />
        )}
        <div className="mt-5 flex justify-end gap-2">
          {ask.kind !== "alert" && (
            <button type="button" onClick={cancel} className="h-11 rounded-full px-5 text-[15px] font-medium text-muted transition-colors hover:text-fg">
              Cancel
            </button>
          )}
          <button
            type="submit"
            autoFocus={ask.kind !== "prompt"}
            className={cn(
              "h-11 rounded-full px-6 text-[15px] font-semibold transition-transform active:scale-95",
              ask.danger ? "bg-danger text-black" : "bg-fg text-bg",
            )}
          >
            {ask.confirmLabel ?? (ask.kind === "alert" ? "OK" : ask.danger ? "Delete" : "OK")}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
