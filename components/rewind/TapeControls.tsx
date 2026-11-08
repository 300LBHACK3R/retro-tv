"use client";
import { useEffect, useState, type RefObject } from "react";
import { formatClock } from "@/lib/libraryCatalog";
import styles from "./rewind.module.css";

type AppleVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/** Native controls stay available for scrubbing, volume, captions and mobile playback. */
export default function TapeControls({ videoRef, onRestart }: { videoRef: RefObject<HTMLVideoElement | null>; onRestart: () => void }) {
  const [paused, setPaused] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => {
      setPaused(video.paused);
      setPosition(Number.isFinite(video.currentTime) ? video.currentTime : 0);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    };
    const events = ["play", "pause", "ended", "timeupdate", "loadedmetadata", "durationchange", "emptied"];
    for (const event of events) video.addEventListener(event, update);
    update();
    return () => { for (const event of events) video.removeEventListener(event, update); };
  }, [videoRef]);
  async function toggle() {
    const video = videoRef.current;
    if (!video) return;
    setNotice("");
    if (!video.paused) video.pause();
    else try { await video.play(); } catch { setNotice("Playback couldn’t start. Use Play on the video, or retry playback below."); }
  }
  function seek(seconds: number, fromStart = false) {
    const video = videoRef.current;
    if (video && Number.isFinite(video.duration) && video.duration > 0)
      video.currentTime = Math.max(0, Math.min(video.duration, fromStart ? 0 : video.currentTime + seconds));
  }
  async function fullscreen() {
    const video = videoRef.current as AppleVideo | null;
    if (!video) return;
    setNotice("");
    try {
      if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      else if (video.requestFullscreen) await video.requestFullscreen();
      else setNotice("Use the fullscreen control on the video in this browser.");
    } catch { setNotice("Use the fullscreen control on the video in this browser."); }
  }
  return <div className={styles.deck} aria-label="Tape deck controls">
    <div className={styles.deckDisplay}><span>{paused ? "▐▐ PAUSED" : "▶ PLAYING"}</span><span>{formatClock(position)} / {formatClock(duration)}</span><span>HI-FI · VHS</span></div>
    <div className={styles.deckButtons}>
      <button type="button" disabled={!duration} onClick={() => seek(-10)} aria-label="Rewind 10 seconds">◀◀ −10 SEC</button>
      <button type="button" className={styles.play} onClick={() => void toggle()} aria-label={paused ? "Play tape" : "Pause tape"}>{paused ? "▶ PLAY" : "▐▐ PAUSE"}</button>
      <button type="button" disabled={!duration} onClick={() => seek(10)} aria-label="Forward 10 seconds">+10 SEC ▶▶</button>
      <button type="button" disabled={!duration} onClick={() => { seek(0, true); onRestart(); }} aria-label="Rewind to the beginning">|◀ START OVER</button>
      <button type="button" onClick={() => void fullscreen()} aria-label="Fullscreen movie">⛶ FULLSCREEN</button>
    </div>
    {notice ? <p className={styles.deckNotice} role="status">{notice}</p> : null}
  </div>;
}
