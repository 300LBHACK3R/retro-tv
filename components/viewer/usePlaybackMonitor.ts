"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  sendPlaybackSample,
  type PlaybackSample,
} from "@/lib/playbackTelemetry";

export function usePlaybackMonitor(
  videoRef: RefObject<HTMLVideoElement | null>,
  options: {
    sourceKey: string;
    channelId: string;
    mediaId: string;
    mode: "live" | "library";
    reload: () => void;
    disabled?: boolean;
  },
) {
  const reloadRef = useRef(options.reload);
  useEffect(() => {
    reloadRef.current = options.reload;
  }, [options.reload]);
  const [notice, setNotice] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [needsHelp, setNeedsHelp] = useState(false);
  const [reportDisabled, setReportDisabled] = useState(false);
  const retryRef = useRef<() => void>(() => {});
  const { sourceKey, channelId, mediaId, mode, disabled } = options;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !sourceKey || disabled) {
      setNotice("");
      return;
    }
    let disposed = false;
    let attempts = 0;
    let retryTimer: number | undefined;
    let stalledAt = 0;
    let userPaused = mode === "library";
    let hasStarted = false;
    let stableSince = 0;
    let startupAt = performance.now();
    let lastTick = performance.now();
    let previousPosition = video.currentTime;
    let lastFlush = lastTick;
    let totals = {
      watchSeconds: 0,
      bufferSeconds: 0,
      starts: 0,
      errors: 0,
      startupMs: 0,
      reports: 0,
    };
    setNotice("");
    setReportStatus("");
    setNeedsHelp(false);
    setReportDisabled(false);
    const flush = () => {
      if (
        !totals.watchSeconds &&
        !totals.bufferSeconds &&
        !totals.starts &&
        !totals.errors &&
        !totals.reports
      )
        return;
      void sendPlaybackSample({ channelId, mediaId, mode, ...totals });
      totals = {
        watchSeconds: 0,
        bufferSeconds: 0,
        starts: 0,
        errors: 0,
        startupMs: 0,
        reports: 0,
      };
      lastFlush = performance.now();
    };
    const cancelRetry = () => {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      retryTimer = undefined;
    };
    const retry = () => {
      if (disposed || userPaused || retryTimer !== undefined) return;
      if (!navigator.onLine) {
        setNotice(
          "You’re offline. Playback will reconnect when your connection returns.",
        );
        return;
      }
      if (attempts >= 3) {
        setNeedsHelp(true);
        setNotice(
          "This programme is having trouble playing. Try again or choose another channel.",
        );
        return;
      }
      const delay = [1500, 3500, 7500][attempts] ?? 7500;
      attempts += 1;
      setNotice(`Reconnecting… attempt ${attempts} of 3`);
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        if (!disposed) {
          stalledAt = performance.now();
          reloadRef.current();
        }
      }, delay);
    };
    retryRef.current = () => {
      setNeedsHelp(false);
      attempts = 0;
      userPaused = false;
      cancelRetry();
      retry();
    };
    const playing = () => {
      if (!hasStarted) {
        totals.starts += 1;
        totals.startupMs = Math.min(
          120000,
          Math.round(performance.now() - startupAt),
        );
        hasStarted = true;
      }
      stalledAt = 0;
      stableSince = performance.now();
      userPaused = false;
      cancelRetry();
      setNotice("");
      setNeedsHelp(false);
    };
    const waiting = () => {
      if (!userPaused && !video.ended) {
        stableSince = 0;
        stalledAt ||= performance.now();
        setNotice("Buffering…");
      }
    };
    const error = () => {
      totals.errors += 1;
      if (video.error?.code === 2) retry();
      else if (video.error?.code === 3 || video.error?.code === 4) {
        setNeedsHelp(true);
        setNotice(
          "This programme couldn’t play on your device. Try another programme or report the problem.",
        );
      }
    };
    const pause = () => {
      if (!video.error && !video.seeking && !stalledAt) userPaused = true;
    };
    const play = () => {
      userPaused = false;
      stalledAt ||= performance.now();
    };
    const load = () => {
      if (!hasStarted) startupAt = performance.now();
      if (mode === "live") {
        stalledAt = performance.now();
        userPaused = false;
      }
    };
    const blocked = () => {
      userPaused = true;
      stalledAt = 0;
      cancelRetry();
      setNotice("");
    };
    const offline = () => {
      cancelRetry();
      setNotice(
        "You’re offline. Playback will reconnect when your connection returns.",
      );
    };
    const online = () => {
      if (!userPaused) {
        attempts = 0;
        retry();
      } else setNotice("");
    };
    const tick = () => {
      const now = performance.now();
      if (stableSince && now - stableSince > 30000) attempts = 0;
      const elapsed = Math.min(65, Math.max(0, (now - lastTick) / 1000));
      const advanced = video.currentTime - previousPosition;
      if (
        !video.paused &&
        !video.seeking &&
        !video.ended &&
        advanced > 0 &&
        advanced <= elapsed * 2 + 1
      )
        totals.watchSeconds += Math.min(elapsed, advanced);
      if (stalledAt && !userPaused && navigator.onLine)
        totals.bufferSeconds += elapsed;
      if (stalledAt && now - stalledAt > 12000 && !userPaused && !video.ended) {
        stalledAt = now;
        retry();
      }
      if (now - lastFlush >= 60000) flush();
      previousPosition = video.currentTime;
      lastTick = now;
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") {
        tick();
        flush();
      }
    };
    const events = {
      playing,
      waiting,
      stalled: waiting,
      error,
      pause,
      play,
      loadstart: load,
      "ttv-autoplay-blocked": blocked,
    };
    for (const [name, handler] of Object.entries(events))
      video.addEventListener(name, handler);
    const interval = window.setInterval(tick, 1000);
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      disposed = true;
      cancelRetry();
      window.clearInterval(interval);
      flush();
      for (const [name, handler] of Object.entries(events))
        video.removeEventListener(name, handler);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
      retryRef.current = () => {};
    };
  }, [sourceKey, channelId, mediaId, mode, disabled, videoRef]);

  const retry = useCallback(() => retryRef.current(), []);
  const report = useCallback(async () => {
    setReportDisabled(true);
    setReportStatus("Sending report…");
    const sample: Omit<PlaybackSample, "id"> = {
      channelId,
      mediaId,
      mode,
      watchSeconds: 0,
      bufferSeconds: 0,
      starts: 0,
      startupMs: 0,
      errors: 0,
      reports: 1,
    };
    const sent = await sendPlaybackSample(sample);
    setReportDisabled(sent);
    setReportStatus(
      sent
        ? "Reported. Thanks for helping improve Tate’s TV."
        : "The report couldn’t be sent. Please try again later.",
    );
  }, [channelId, mediaId, mode]);
  return { notice, needsHelp, retry, report, reportStatus, reportDisabled };
}
