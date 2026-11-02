"use client";

/*
 * System notifications, so a timer can reach you when Alexander isn't the page in front of you.
 * Shown through the service worker where there is one (phones need that), else directly.
 * A closed app can't notify — there is no server push — so the timer says so in its hint.
 */

export const canNotify = () => typeof window !== "undefined" && "Notification" in window;

export const notifyAllowed = () => canNotify() && Notification.permission === "granted";

/** Ask once, only from a tap. True when notifications may be shown. */
export async function askToNotify() {
  if (!canNotify()) return false;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {}
  }
  return Notification.permission === "granted";
}

/** Show a notification. `tag` replaces an earlier one of the same kind; tapping it opens `url`. */
export async function notify(title: string, body: string, { tag = "alexander-timer", url = "/timer" } = {}) {
  if (!notifyAllowed()) return;
  const options = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag,
    renotify: true,
    requireInteraction: true,
    vibrate: [220, 100, 220, 100, 220],
    data: { url },
  } as NotificationOptions;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return await reg.showNotification(title, options);
  } catch {}
  try {
    new Notification(title, options);
  } catch {}
}
