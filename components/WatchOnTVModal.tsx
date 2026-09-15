"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalDialog } from "@/components/viewer/useModalDialog";
import { useGoogleCast } from "@/components/GoogleCastProvider";
import type { NativeTvKind } from "@/lib/tvPlayback";

interface WatchOnTVModalProps {
  open: boolean;
  onClose: () => void;
  onConnect: () => void;
  nativeKind: NativeTvKind;
  nativeConnected: boolean;
  connecting: boolean;
  connectionNotice: string;
  onPreviousChannel: () => void;
  onNextChannel: () => void;
  onOpenGuide: () => void;
  onSyncLive: () => void;
  currentTitle: string;
  channelLabel: string;
  channelName: string;
  channelId?: string;
}

const buttonClass = "ttv-themed-button ttv-touch-target rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45";

export default function WatchOnTVModal({
  open, onClose, onConnect, nativeKind, nativeConnected, connecting,
  connectionNotice, onPreviousChannel, onNextChannel, onOpenGuide, onSyncLive,
  currentTitle, channelLabel, channelName, channelId,
}: WatchOnTVModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [notice, setNotice] = useState("");
  const { sdkState, castState, deviceName, errorMessage, remote,
    disconnect, playOrPause, muteOrUnmute, setVolume } = useGoogleCast();
  const mounted = useModalDialog({ open, onClose, dialogRef });
  const platform = useMemo(() => {
    if (typeof navigator === "undefined") return "other";
    if (/Android/i.test(navigator.userAgent)) return "android";
    if (/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent)) return "apple";
    if (/Windows/i.test(navigator.userAgent)) return "windows";
    return "other";
  }, []);
  const tvUrl = useMemo(() => {
    if (typeof window === "undefined") return "/tv";
    const url = new URL("/tv", window.location.origin);
    if (channelId) url.searchParams.set("ch", channelId);
    return url.toString();
  }, [channelId]);

  useEffect(() => {
    if (!open) { setNotice(""); return; }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  const copyTvLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(tvUrl);
      setNotice("Link copied. Open it on a device with a web browser.");
    } catch { setNotice(tvUrl); }
  }, [tvUrl]);

  if (!mounted || !open) return null;
  const airplay = nativeKind === "airplay";
  const googleCast = !airplay && sdkState === "ready";
  const browserPicker = !airplay && !googleCast && nativeKind === "remote" && sdkState !== "loading";
  const pickerAvailable = airplay || googleCast || browserPicker;
  const connected = remote.isConnected || nativeConnected;
  const connectionError = connectionNotice || (!nativeConnected && !airplay ? errorMessage : "");
  const method = airplay ? "AirPlay" : googleCast ? "Google Cast" : "Browser TV playback";

  return createPortal(
    <div className="fixed inset-0 z-[2147483200] flex items-end justify-center bg-black/85 backdrop-blur-md sm:items-center sm:p-4" role="presentation"
      onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="watch-on-tv-title" tabIndex={-1}
        className="ttv-watch-tv-modal max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl border p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="ttv-watch-label text-xs font-semibold uppercase tracking-widest">The big screen</div>
            <h2 id="watch-on-tv-title" className="mt-1 text-2xl font-bold tracking-tight">Watch on TV</h2>
          </div>
          <button type="button" onClick={onClose} className={buttonClass} aria-label="Close Watch on TV">Close</button>
        </div>
        <p className="ttv-watch-muted mt-2 text-sm leading-6">Connect your phone or computer and TV to the same Wi-Fi.</p>
        <div className="ttv-watch-card mt-4 rounded-2xl border p-4">
          <div className="ttv-watch-accent text-xs font-semibold">{channelLabel} · {channelName}</div>
          <div className="mt-1 break-words text-base font-semibold">{currentTitle}</div>
        </div>
        {connected ? (
          <section className="ttv-watch-status mt-4 rounded-2xl border p-4" aria-label="TV connection">
            <p className="font-semibold" role="status">{nativeConnected ? `Connected through ${airplay ? "AirPlay" : "your browser"}` : `Connected to ${deviceName || "your TV"}`}</p>
            {remote.isConnected ? (
              <>
                <p className="ttv-watch-muted mt-1 text-sm" role="status">{connectionError ? "Playback needs attention." : !remote.isMediaLoaded ? "Sending the live channel…" : remote.playerState === "BUFFERING" ? "TV is buffering…" : remote.isPaused ? "Paused on TV" : remote.title || currentTitle}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={playOrPause} disabled={!remote.isMediaLoaded || !remote.canPause} className={buttonClass}>{remote.isPaused ? "Play" : "Pause"}</button>
                  <button type="button" onClick={onSyncLive} className={buttonClass}>Retry live channel</button>
                  <button type="button" onClick={onPreviousChannel} className={buttonClass}>Previous channel</button>
                  <button type="button" onClick={onNextChannel} className={buttonClass}>Next channel</button>
                </div>
                {remote.canControlVolume ? (
                  <div className="mt-4 flex items-center gap-3">
                    <button type="button" onClick={muteOrUnmute} className={buttonClass}>{remote.isMuted ? "Unmute TV" : "Mute TV"}</button>
                    <label className="min-w-0 flex-1 text-xs">TV volume<input type="range" min={0} max={1} step={0.02} value={remote.volumeLevel} onChange={(event) => setVolume(Number(event.target.value))} className="mt-2 block w-full" /></label>
                  </div>
                ) : null}
                <button type="button" onClick={disconnect} className={`${buttonClass} mt-4 w-full`}>Stop casting</button>
              </>
            ) : <button type="button" onClick={onConnect} disabled={connecting} className={`${buttonClass} mt-3 w-full`}>Change TV or disconnect</button>}
          </section>
        ) : (
          <section className="mt-4" aria-label="Connect to a TV">
            {pickerAvailable ? (
              <>
                <button type="button" onClick={onConnect} disabled={connecting} className="ttv-primary-action ttv-touch-target w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-50">{connecting ? "Opening TV picker…" : `Choose TV — ${method}`}</button>
                <p className="ttv-watch-muted mt-2 text-xs leading-5">{airplay ? "Apple TV, AirPlay televisions and compatible Roku devices." : "Chromecast, Google TV and televisions with Google Cast. For Roku, see below."}</p>
                {googleCast && castState === "NO_DEVICES_AVAILABLE" ? <p className="ttv-watch-muted mt-2 text-xs" role="status">No Google Cast TV is visible yet. You can still open the picker to check.</p> : null}
              </>
            ) : <p className="ttv-watch-card rounded-xl border p-4 text-sm leading-6" role="status">{sdkState === "loading" ? "Checking this browser for TV connections…" : platform === "apple" ? "Open Tate's TV in Safari for AirPlay. Google Cast from an iPhone needs a native app." : "This browser has no supported TV picker. For Google Cast, try Chrome on Android or a computer. For Roku, use the steps below."}</p>}
          </section>
        )}
        {connectionError ? <p role="alert" className="mt-4 rounded-xl border border-red-300/30 bg-red-400/10 p-3 text-sm leading-6">{connectionError}</p> : null}
        <details open={platform === "android" && !connected} className="ttv-watch-card mt-4 rounded-2xl border p-4">
          <summary className="ttv-touch-target flex cursor-pointer items-center font-semibold">{platform === "android" ? "Roku / Samsung Smart View" : "Connecting a Roku?"}</summary>
          {platform === "android" ? (
            <>
              <p className="ttv-watch-muted mt-2 text-sm leading-6">On compatible Samsung phones, use Smart View to show Tate&apos;s TV on your Roku.</p>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">
                <li>Swipe down from the top of your phone and open <strong>Smart View</strong>.</li>
                <li>Select your Roku, then accept the connection on the TV.</li>
                <li>Return to Tate&apos;s TV and rotate your phone sideways.</li>
              </ol>
              <p className="ttv-watch-muted mt-3 text-xs leading-5">Keep your phone awake while mirroring. Smart View mirrors your screen; Roku sticks will not appear in the Google Cast list. Some Android phones do not support Roku mirroring.</p>
            </>
          ) : platform === "apple" ? <p className="ttv-watch-muted mt-2 text-sm leading-6">Use AirPlay in Safari with a compatible Roku. On the Roku, open Settings → Apple AirPlay and HomeKit and turn AirPlay on. Keep both devices on the same Wi-Fi.</p>
            : platform === "windows" ? <p className="ttv-watch-muted mt-2 text-sm leading-6">On a compatible Windows computer, press <strong>Windows + K</strong>, choose your Roku and accept the connection on the TV. This mirrors your screen; it is separate from Google Cast.</p>
              : <p className="ttv-watch-muted mt-2 text-sm leading-6">Roku can use AirPlay from supported Apple devices or screen mirroring from compatible Android and Windows devices. A Roku stick is not a Google Cast receiver.</p>}
          <a className="ttv-watch-accent mt-3 inline-flex min-h-11 items-center text-sm underline" href={platform === "apple" ? "https://support.roku.com/article/360057488733" : "https://support.roku.com/article/screen-mirror-your-phone-tablet-or-computer"} target="_blank" rel="noopener noreferrer">Roku connection help</a>
        </details>
        <details className="ttv-watch-card mt-3 rounded-2xl border p-4">
          <summary className="ttv-touch-target flex cursor-pointer items-center font-semibold">TV missing or not playing?</summary>
          <ul className="ttv-watch-muted mt-2 list-disc space-y-2 pl-5 text-sm leading-6">
            <li>Wake the TV and check both devices are on the same home Wi-Fi.</li>
            <li>A guest network or VPN can prevent discovery. Check the connection and any browser local-network permission.</li>
            <li>If the TV connects but a programme fails, try another channel, then Retry live channel.</li>
          </ul>
        </details>
        <details className="ttv-watch-card mt-3 rounded-2xl border p-4">
          <summary className="ttv-touch-target flex cursor-pointer items-center font-semibold">Open on a device with a browser</summary>
          <p className="ttv-watch-muted mt-2 text-sm leading-6">Use TV Mode on a computer or television with a web browser. This link does not pair a Roku.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={tvUrl} target="_blank" rel="noopener noreferrer" className={`${buttonClass} text-center`}>Open TV Mode</a>
            <button type="button" onClick={() => void copyTvLink()} className={buttonClass}>Copy link</button>
          </div>
        </details>
        {notice ? <p role="status" className="ttv-watch-muted mt-3 break-all text-sm">{notice}</p> : null}
        <button type="button" onClick={onOpenGuide} className={`${buttonClass} mt-4 w-full`}>Back to the guide</button>
      </div>
    </div>, document.body,
  );
}
