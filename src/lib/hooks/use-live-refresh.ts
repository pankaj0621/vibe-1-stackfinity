"use client";

import { useEffect, useRef } from "react";

const LIVE_UPDATE_EVENT = "lawazia:live-update";
const LIVE_UPDATE_CHANNEL = "lawazia-live-updates";
let publisherChannel: BroadcastChannel | null = null;

/** Notify other mounted screens and tabs that server data has changed. */
export function notifyLiveUpdate(): void {
  if (typeof window === "undefined") return;

  if (typeof BroadcastChannel !== "undefined") {
    publisherChannel ??= new BroadcastChannel(LIVE_UPDATE_CHANNEL);
    publisherChannel.postMessage({ changedAt: Date.now() });
  } else {
    window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));
  }
}

/** Refresh immediately, on tab focus/visibility, on local changes, and periodically while visible. */
export function useLiveRefresh(refresh: () => void | Promise<void>, intervalMs = 5000): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let inFlight = false;
    let mounted = true;

    const run = async (force = false) => {
      if (!mounted || inFlight) return;
      if (!force && document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        await refreshRef.current();
      } catch {
        // A failed refresh should not break the next scheduled sync.
      } finally {
        inFlight = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void run(true);
    };

    const channel = typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(LIVE_UPDATE_CHANNEL)
      : null;
    const onBroadcast = () => void run();
    channel?.addEventListener("message", onBroadcast);

    void run();
    const interval = window.setInterval(() => void run(), intervalMs);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    window.addEventListener(LIVE_UPDATE_EVENT, onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
      window.removeEventListener(LIVE_UPDATE_EVENT, onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      channel?.removeEventListener("message", onBroadcast);
      channel?.close();
    };
  }, [intervalMs]);
}
