"use client";

import { Delete } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { clearVideos } from "@/lib/clips";
import { clearImages } from "@/lib/images";
import { createLock, readFails, verifyPasscode, writeFails, writeUnlocked } from "@/lib/lock";
import { useStore, useUI } from "@/lib/store";
import { resetEverywhere } from "@/lib/sync";
import { cn } from "@/lib/utils";
import { Statue } from "./brand";
import { Button, Input } from "./ui";
import { alertDialog, confirmDialog, promptDialog } from "./dialog";

const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

/** Full-screen passcode pad shown whenever the app is locked. */
export function LockScreen() {
  const lock = useStore((s) => s.settings.lock)!;
  const name = useStore((s) => s.settings.name);
  // Older passcodes didn't record their length; those unlock with OK / Enter instead.
  const length = lock.length || 0;
  const [code, setCodeState] = useState("");
  const codeRef = useRef("");
  const [error, setError] = useState(false);
  const [fails, setFails] = useState(readFails);
  const [now, setNow] = useState(() => Date.now());
  const [siteLock, setSiteLock] = useState(false);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d: { enabled: boolean }) => setSiteLock(d.enabled))
      .catch(() => {});
  }, []);

  /** With a website password, proving it resets the passcode; otherwise the only way in is erasing. */
  const forgot = async () => {
    if (siteLock) {
      const password = await promptDialog("Enter your website password", { detail: "This removes the passcode. Your data stays as it is.", password: true });
      if (!password) return;
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, verify: true }),
      }).catch(() => null);
      if (!res?.ok) return alertDialog("That password is not right.");
      writeFails({ count: 0, until: 0 });
      useStore.getState().updateSettings({ lock: undefined });
      writeUnlocked(true);
      useUI.getState().setUnlocked(true);
      return;
    }
    if (
      (await confirmDialog("Forgot your passcode?", { detail: "The only way in is to erase all Alexander data. You can restore from a backup afterwards.", confirmLabel: "Continue" })) &&
      (await confirmDialog("Erase everything now?", { detail: "This cannot be undone.", danger: true, confirmLabel: "Erase all" }))
    ) {
      await clearImages();
      await clearVideos();
      writeFails({ count: 0, until: 0 });
      writeUnlocked(false);
      await resetEverywhere({});
    }
  };

  const blocked = fails.until > now;

  // Tick only while a cooldown is running.
  useEffect(() => {
    if (!blocked) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [blocked]);

  const setCode = (value: string) => {
    codeRef.current = value;
    setCodeState(value);
  };

  const submit = (value: string) => {
    if (verifyPasscode(value, lock)) {
      writeFails({ count: 0, until: 0 });
      writeUnlocked(true);
      useUI.getState().setUnlocked(true);
      return;
    }
    const count = fails.count + 1;
    const next = count >= MAX_ATTEMPTS ? { count: 0, until: Date.now() + COOLDOWN_MS } : { count, until: 0 };
    setFails(next);
    writeFails(next);
    setNow(Date.now());
    setError(true);
    setCode("");
    setTimeout(() => setError(false), 450);
  };

  // Reads the code from a ref so fast typing never works from a stale value.
  const press = (key: string) => {
    if (blocked) return;
    const current = codeRef.current;
    if (key === "del") return setCode(current.slice(0, -1));
    if (key === "enter") {
      if (current.length >= 4) submit(current);
      return;
    }
    if (!/^\d$/.test(key)) return;
    const next = (current + key).slice(0, 8);
    setCode(next);
    if (length && next.length === length) submit(next);
  };
  const pressRef = useRef(press);
  useEffect(() => {
    pressRef.current = press;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Backspace") pressRef.current("del");
      else if (e.key === "Enter") pressRef.current("enter");
      else pressRef.current(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dots = length || Math.max(4, code.length);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 pb-[env(safe-area-inset-bottom)]">
      <Statue priority className="relative mb-6 h-32 w-auto" />
      <p className="relative text-[20px] font-semibold tracking-tight">{name ? `Welcome back, ${name}` : "Alexander is locked"}</p>
      <p className="relative mt-1 h-5 text-[13px] text-faint">
        {blocked ? `Too many tries — wait ${Math.ceil((fails.until - now) / 1000)}s` : "Enter your passcode"}
      </p>

      <div className={cn("relative mt-8 mb-10 flex h-3 gap-3", error && "animate-[shake_0.4s]")}>
        {Array.from({ length: dots }, (_, i) => (
          <span key={i} className={cn("size-3 rounded-full border border-faint transition-[background-color,border-color,transform] duration-200", i < code.length && "scale-110 border-crystal bg-crystal")} />
        ))}
      </div>

      <div className="relative grid w-full max-w-[264px] grid-cols-3 gap-4">
        {KEYS.map((k, i) =>
          k === "" ? (
            length ? (
              <span key={i} />
            ) : (
              <button key={i} disabled={blocked} onClick={() => press("enter")} className="text-[14px] font-medium text-muted hover:text-fg disabled:opacity-30">
                OK
              </button>
            )
          ) : (
            <button
              key={i}
              aria-label={k === "del" ? "Delete" : k}
              disabled={blocked}
              onClick={() => press(k)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-full text-2xl font-light transition-colors disabled:opacity-30",
                k === "del" ? "text-muted hover:text-fg" : "border border-line bg-surface-2/80 backdrop-blur-sm hover:bg-surface-3 active:scale-95 active:bg-line-strong",
              )}
            >
              {k === "del" ? <Delete className="size-5" /> : k}
            </button>
          ),
        )}
      </div>

      <button onClick={forgot} className="relative mt-10 text-[12px] text-faint hover:text-muted">
        Forgot passcode?
      </button>
    </div>
  );
}

/** Two-step "enter, then confirm" passcode form used in onboarding and settings. */
export function PasscodeSetup({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [first, setFirst] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [error, setError] = useState("");

  const save = () => {
    if (confirmCode !== first) {
      setError("Passcodes don't match. Try again.");
      setStep("enter");
      setFirst("");
      setConfirmCode("");
      return;
    }
    useStore.getState().updateSettings({ lock: createLock(first) });
    writeUnlocked(true);
    useUI.getState().setUnlocked(true);
    onDone();
  };

  const value = step === "enter" ? first : confirmCode;
  const setValue = step === "enter" ? setFirst : setConfirmCode;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "enter") {
          if (first.length < 4) return setError("Use at least 4 digits.");
          setError("");
          setStep("confirm");
        } else save();
      }}
    >
      <Input
        key={step}
        autoFocus
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={8}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        placeholder={step === "enter" ? "4–8 digit passcode" : "Repeat passcode"}
        className="h-11 text-center font-mono tracking-[0.5em]"
      />
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      <div className="mt-3 flex gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button className="flex-1" disabled={value.length < 4}>
          {step === "enter" ? "Next" : "Set passcode"}
        </Button>
      </div>
    </form>
  );
}
