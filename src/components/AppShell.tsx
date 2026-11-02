"use client";

import { CloudOff, LockKeyhole, LucideProvider, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { fromKey } from "@/lib/date";
import { AUTO_LOCK_MS, readUnlocked, writeUnlocked } from "@/lib/lock";
import { NAV } from "@/lib/nav";
import { useClock, useStore, useUI } from "@/lib/store";
import { startSync, useSync } from "@/lib/sync";
import { useBackToClose } from "@/lib/useBackToClose";
import { cn } from "@/lib/utils";
import { LockScreen } from "./Lock";
import { AsciiStatue } from "./AsciiStatue";
import { Logo } from "./Logo";
import { Onboarding } from "./Onboarding";
import { Toaster } from "./ui";
import { Dialogs } from "./dialog";
import { TimerWatcher } from "./TimerWatcher";

const MOBILE_PRIMARY = ["/", "/calendar", "/mission", "/journal"];

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);

/**
 * Loads saved data before anything renders. If it can't be read, the app stops at an error
 * screen rather than starting empty — an empty start would overwrite the saved data.
 */
function useHydrated() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  useEffect(() => {
    let finished = false;
    const unsub = useStore.persist.onFinishHydration(() => {
      finished = true;
      // Restore this tab's unlock state before the first real render, so the app never flashes.
      useUI.getState().setUnlocked(readUnlocked());
      setStatus("ready");
    });
    Promise.resolve(useStore.persist.rehydrate()).then(
      () => !finished && setStatus("error"),
    );
    const timeout = setTimeout(() => !finished && setStatus("error"), 10_000);
    // Ask the browser to never evict Alexander's data under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
    return () => {
      unsub();
      clearTimeout(timeout);
    };
  }, []);
  return status;
}

/** Re-locks after the app sits in the background for a while. */
function useAutoLock() {
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > AUTO_LOCK_MS) lockNow();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
}

// Fields that bring up the on-screen keyboard (a date or a checkbox doesn't).
const TYPING_INPUTS = new Set(["text", "search", "email", "url", "tel", "password", "number"]);
const opensKeyboard = (el: Element | null) =>
  !!el &&
  (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TYPING_INPUTS.has(el.type)) || (el as HTMLElement).isContentEditable);

/**
 * True while you type on a touch screen. The phone's keyboard shrinks the page, which would lift
 * the bottom bar and the orb up over what you're writing — so they step aside until you're done.
 */
function useTyping() {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const touch = matchMedia("(pointer: coarse)");
    const update = () => setTyping(touch.matches && opensKeyboard(document.activeElement));
    // focusout fires before focus lands on the next field; check once it has settled.
    const later = () => setTimeout(update, 0);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", later);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", later);
    };
  }, []);
  return typing;
}

export function lockNow() {
  writeUnlocked(false);
  useUI.getState().setUnlocked(false);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const status = useHydrated();
  const hydrated = status === "ready";
  useAutoLock();
  const today = useClock((s) => s.today);
  const name = useStore((s) => s.settings.name);
  const hasLock = useStore((s) => !!s.settings.lock);
  const unlocked = useUI((s) => s.unlocked);
  const syncReady = useSync((s) => s.ready);
  const markDayStart = useStore((s) => s.markDayStart);

  // Installed as an app (PWA): keep the app itself on the device so it opens offline.
  // Only on the live site — a cached development server would serve stale code.
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const { tick } = useClock.getState();
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (hydrated && today) markDayStart(today);
  }, [hydrated, today, markDayStart]);

  useEffect(() => {
    if (hydrated) startSync();
  }, [hydrated]);

  // The sign-in page for the site password sits outside the app.
  if (pathname === "/login") return children;

  if (status === "error") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <Logo className="mb-3 size-9" />
        <p className="text-[15px] font-medium">
          Couldn&apos;t open your saved data
        </p>
        <p className="max-w-xs text-[13px] leading-relaxed text-muted">
          Nothing was changed. Close any other Alexander tabs, then try again.
          Private browsing windows can also block storage.
        </p>
        <button
          onClick={() => location.reload()}
          className="mt-3 rounded-full border border-line-strong px-4 py-1.5 text-[13px] hover:border-fg"
        >
          Try again
        </button>
      </div>
    );
  }

  // A new device waits for its first sync, so it shows your data instead of the setup screen.
  if (!hydrated || !today || (!name && !syncReady)) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <AsciiStatue size={5} />
      </div>
    );
  }

  if (hasLock && !unlocked) {
    return (
      <LucideProvider strokeWidth={1.75}>
        <LockScreen />
        <Dialogs />
      </LucideProvider>
    );
  }

  if (!name) return <Onboarding />;

  return (
    <LucideProvider strokeWidth={1.75}>
      <div className="min-h-dvh lg:pl-56">
        <Sidebar />
        <TopBar />
        {/* Keyed by route so every section arrives with the same quiet rise. */}
        <main
          key={pathname}
          className="animate-page mx-auto w-full max-w-5xl px-4 pt-6 pb-[calc(9.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-12 lg:pb-16"
        >
          {children}
        </main>
        <BottomNav />
        <Toaster />
        <Dialogs />
        <TimerWatcher />
      </div>
    </LucideProvider>
  );
}

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-line bg-bg px-3 py-5 lg:flex">
      <Link href="/" className="mb-7 flex items-center gap-2.5 px-2.5">
        <Logo className="size-6" />
        <span lang="grc" className="text-[16px] font-semibold tracking-tight">
          Ἀλέξανδρος
        </span>
      </Link>
      <nav className="-mx-1 flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-1 [scrollbar-width:none]">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                // Same weight active or not, so nothing shifts; only the tone changes, quickly.
                "flex h-10 shrink-0 items-center gap-3 rounded-xl px-3 text-[14.5px] transition-colors duration-150 active:bg-surface-2",
                active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface hover:text-fg",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>
      <SidebarLock />
    </aside>
  );
}

function SidebarLock() {
  const hasLock = useStore((s) => !!s.settings.lock);
  if (!hasLock) return null;
  return (
    <button
      onClick={lockNow}
      className="flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] text-muted transition-colors hover:bg-surface hover:text-fg"
    >
      <LockKeyhole className="size-[18px]" /> Lock
    </button>
  );
}

function TopBar() {
  const today = useClock((s) => s.today);
  const log = useStore((s) => s.days[today]);
  const threshold = useStore((s) => s.settings.winThreshold);
  const pct = log?.pct ?? 0;
  const won = log && log.total > 0 && pct >= threshold;
  const date = fromKey(today).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const hasLock = useStore((s) => !!s.settings.lock);
  const syncStatus = useSync((s) => s.status);
  const syncMessage = useSync((s) => s.message);
  const pathname = usePathname();
  const section = NAV.find((n) => isActive(pathname, n.href));
  // Today already shows its own progress large; elsewhere the bar is a quiet reminder.
  const showProgress = pathname !== "/";

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6 lg:px-10">
        <p className="text-[18px] font-semibold tracking-tight lg:hidden">
          {pathname === "/" ? date : (section?.label ?? "Alexander")}
        </p>
        <p className="hidden text-[14.5px] lg:block">
          {pathname !== "/" && section && <span className="font-medium text-fg">{section.label} · </span>}
          <span className="text-muted">{date}</span>
        </p>
        <div className="flex-1" />
        {/* Says plainly when this device isn't sharing data, so a mismatch is never a mystery. */}
        {(syncStatus === "off" || syncStatus === "offline" || syncStatus === "error") && (
          <Link
            href="/settings"
            title={syncStatus === "offline" ? "Offline — changes will sync when you're back online" : (syncMessage ?? "Sync problem — see Settings")}
            className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] text-faint transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <CloudOff aria-hidden className="size-4" />
            {syncStatus === "off" ? "Not syncing" : syncStatus === "offline" ? "Offline" : "Sync issue"}
          </Link>
        )}
        {showProgress && (
          <Link
            href="/"
            title="Completed today"
            className="animate-fade flex items-center gap-2.5 text-[13px]"
          >
            <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-3">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out)]",
                  won ? "bg-crystal" : "bg-fg",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span
              className={cn(
                "font-mono tabular-nums",
                won ? "text-crystal" : "text-fg",
              )}
            >
              {pct}%
            </span>
          </Link>
        )}
        {hasLock && (
          <button
            aria-label="Lock"
            onClick={lockNow}
            className="-mr-1.5 flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
          >
            <LockKeyhole className="size-[17px]" />
          </button>
        )}
      </div>
    </header>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const primary = NAV.filter((n) => MOBILE_PRIMARY.includes(n.href));
  const typing = useTyping();
  if (typing) return null;

  return (
    <>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-4 px-[env(safe-area-inset-left)]">
          {primary.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-[11.5px] font-medium transition-[color,transform] duration-150 active:scale-95",
                  active ? "text-fg" : "text-faint",
                )}
              >
                <Icon className="size-6" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
      <Orb />
    </>
  );
}

/**
 * The phone's way to every section: a small glowing orb floating above the bar. Tap it and the
 * sections fan out above it; tap again, tap outside, or swipe back to close.
 */
function Orb() {
  const pathname = usePathname();
  // Open on the page it was opened on: arriving at another page closes it, after the navigation.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const close = () => setOpenAt(null);
  useBackToClose(open, close);

  return (
    <div className="lg:hidden">
      {open && <div aria-hidden onClick={close} className="animate-fade fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" />}
      {open && (
        <nav
          aria-label="All sections"
          className="orb-panel fixed right-4 z-50 max-h-[calc(100dvh-11rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-3xl border border-line-strong bg-surface/95 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl"
          style={{ bottom: "calc(9.25rem + env(safe-area-inset-bottom))" }}
        >
          <div className="grid grid-cols-3 gap-1">
            {NAV.map(({ href, label, icon: Icon }, i) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => active && close()}
                  style={{ animationDelay: `${Math.min(i, 14) * 18}ms` }}
                  className={cn(
                    "orb-item flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3.5 text-[12.5px] font-medium transition-colors",
                    active ? "bg-surface-3 text-fg" : "text-muted active:bg-surface-2",
                  )}
                >
                  <Icon className="size-6" />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
      <button
        onClick={() => (open ? close() : setOpenAt(pathname))}
        aria-label={open ? "Close sections" : "All sections"}
        aria-expanded={open}
        className={cn("orb fixed right-4 z-50 flex size-14 items-center justify-center rounded-full text-white/90 transition-transform duration-300 active:scale-90", open && "rotate-45")}
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <Plus className="size-5 drop-shadow" strokeWidth={2} />
      </button>
    </div>
  );
}
