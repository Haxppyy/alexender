"use client";

import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { useRef, useState } from "react";
import { Statue } from "@/components/brand";
import { cn } from "@/lib/utils";

/** The door: Alexander, the name, and one field for the password. */
export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.replace("/");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "That's not the password.");
    } catch {
      setError("Couldn't reach Alexander. Check your connection.");
    }
    setBusy(false);
    setShake(Date.now());
    setPassword("");
    input.current?.focus();
  };

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* A soft light behind the statue. */}
      <div aria-hidden className="pointer-events-none absolute top-[18%] left-1/2 size-[520px] -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(circle, rgb(142 205 242 / 0.12) 0%, transparent 62%)" }} />

      <div className="animate-sheet relative flex w-full max-w-sm flex-col items-center text-center">
        <Statue priority className="h-[210px] w-auto drop-shadow-[0_20px_40px_rgb(0_0_0/0.8)] sm:h-[240px]" />
        <h1 className="mt-6 text-[34px] leading-none font-semibold tracking-tight" lang="grc">
          Ἀλέξανδρος
        </h1>
        <p className="mt-2.5 text-[15px] text-muted">Private. Only for you.</p>

        <form
          key={shake}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className={cn("mt-10 w-full", shake > 0 && "login-shake")}
        >
          <div
            className={cn(
              "flex items-center gap-2 rounded-2xl border bg-surface p-1.5 pl-4 transition-[border-color,box-shadow] duration-200 focus-within:shadow-[0_0_0_4px_rgb(142_205_242/0.08)]",
              error ? "border-danger/60" : "border-line-strong focus-within:border-crystal/50",
            )}
          >
            <LockKeyhole className="size-[18px] shrink-0 text-faint" />
            <input
              ref={input}
              autoFocus
              type={show ? "text" : "password"}
              autoComplete="current-password"
              enterKeyHint="go"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Password"
              aria-label="Password"
              aria-invalid={!!error}
              className="h-12 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-faint"
            />
            {password && (
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-faint transition-colors hover:text-fg"
              >
                {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            )}
            <button
              type="submit"
              aria-label="Enter"
              disabled={!password || busy}
              className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-fg text-bg transition-[transform,opacity] active:scale-90 disabled:opacity-25"
            >
              {busy ? <LoaderCircle className="size-5 animate-spin" /> : <ArrowRight className="size-5" strokeWidth={2.2} />}
            </button>
          </div>
          <p role="alert" className={cn("mt-3 h-5 text-[13.5px] text-danger transition-opacity", error ? "opacity-100" : "opacity-0")}>
            {error}
          </p>
        </form>
      </div>
    </main>
  );
}
