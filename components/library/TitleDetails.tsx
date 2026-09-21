"use client";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import ProgrammeArtwork from "@/components/viewer/ProgrammeArtwork";
import SaveButton from "@/components/viewer/SaveButton";
import { useModalDialog } from "@/components/viewer/useModalDialog";
import { usePlaybackMonitor } from "@/components/viewer/usePlaybackMonitor";
import {
  formatDuration,
  getTypeLabel,
  type LibraryGroup,
  type ProgressEntry,
  type ProgressMap,
} from "@/lib/libraryCatalog";
import styles from "./library.module.css";

type Props = {
  group: LibraryGroup;
  initialMediaId?: string;
  playImmediately?: boolean;
  progress: ProgressMap;
  onProgress: (id: string, entry: ProgressEntry | null) => void;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  themeStyle: CSSProperties;
};
export default function TitleDetails({
  group,
  initialMediaId,
  playImmediately,
  progress,
  onProgress,
  onClose,
  returnFocusRef,
  themeStyle,
}: Props) {
  const [mediaId, setMediaId] = useState(
    initialMediaId ?? group.items[0]?.media.id,
  );
  const selected =
    group.items.find((item) => item.media.id === mediaId) ?? group.items[0];
  const [season, setSeason] = useState(selected?.season ?? 1);
  const [playing, setPlaying] = useState(!!playImmediately);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const progressRef = useRef(progress);
  const updateRef = useRef(onProgress);
  const lastWrite = useRef(0);
  const completedRef = useRef(false);
  const mounted = useModalDialog({
    open: true,
    onClose,
    dialogRef,
    initialFocusRef: closeRef,
    returnFocusRef,
  });
  const monitor = usePlaybackMonitor(videoRef, {
    sourceKey: playing ? (selected?.media.id ?? "") : "",
    channelId: "library",
    mediaId: selected?.media.id ?? "",
    mode: "library",
    reload: () => {
      const video = videoRef.current;
      if (video) {
        video.load();
        void video
          .play()
          .catch(() => video.dispatchEvent(new Event("ttv-autoplay-blocked")));
      }
    },
  });
  useEffect(() => {
    progressRef.current = progress;
    updateRef.current = onProgress;
  }, [progress, onProgress]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    if (!playing || !selected) return;
    const video = videoRef.current;
    const id = selected.media.id;
    if (!video) return;
    completedRef.current = false;
    const save = () => {
      if (
        completedRef.current ||
        !Number.isFinite(video.duration) ||
        video.duration <= 0 ||
        video.currentTime < 1
      )
        return;
      updateRef.current(id, {
        position: Math.min(video.duration, video.currentTime),
        duration: video.duration,
        updatedAt: Date.now(),
      });
    };
    const tick = () => {
      if (Date.now() - lastWrite.current > 4000) {
        lastWrite.current = Date.now();
        save();
      }
    };
    video.addEventListener("timeupdate", tick);
    video.addEventListener("pause", save);
    window.addEventListener("pagehide", save);
    return () => {
      save();
      video.removeEventListener("timeupdate", tick);
      video.removeEventListener("pause", save);
      window.removeEventListener("pagehide", save);
    };
  }, [playing, selected]);
  if (!mounted || !selected) return null;
  const index = group.items.findIndex(
    (item) => item.media.id === selected.media.id,
  );
  const start = (id: string) => {
    setMediaId(id);
    setPlaying(true);
    setSeason(group.items.find((item) => item.media.id === id)?.season ?? 1);
    window.setTimeout(
      () =>
        playerRef.current?.scrollIntoView({
          block: "nearest",
          behavior: "auto",
        }),
      50,
    );
  };
  const resume = progress[selected.media.id];
  return createPortal(
    <div
      className={styles.backdrop}
      style={themeStyle}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-title-heading"
        tabIndex={-1}
      >
        <div className={styles.modalTop}>
          <button ref={closeRef} className={styles.button} onClick={onClose}>
            Close title ✕
          </button>
        </div>
        <div className={styles.detailHead}>
          <div className={styles.poster}>
            <ProgrammeArtwork
              src={group.poster}
              title={group.title}
              kind={getTypeLabel(group.type)}
            />
          </div>
          <div className={styles.detailInfo}>
            <div>
              <span className={styles.eyebrow}>
                {getTypeLabel(group.type)} ·{" "}
                {group.type === "show"
                  ? `${group.items.length} episodes`
                  : formatDuration(selected.media.duration)}
              </span>
              <h2 id="library-title-heading">{group.title}</h2>
              {selected.media.description && (
                <p>{selected.media.description}</p>
              )}
              {group.type === "show" && <p>{selected.displayTitle}</p>}
            </div>
            <div className={styles.actions}>
              <button
                className={styles.primary}
                onClick={() =>
                  playing
                    ? playerRef.current?.scrollIntoView({ block: "nearest" })
                    : start(selected.media.id)
                }
              >
                {playing
                  ? "↑ Back to player"
                  : resume &&
                      resume.position >= 10 &&
                      resume.position < resume.duration - 10
                    ? "▶ Resume"
                    : "▶ Watch now"}
              </button>
              <SaveButton id={group.key} title={group.title} kind="programme" />
            </div>
          </div>
        </div>
        {playing && (
          <div ref={playerRef} className={styles.player}>
            <video
              ref={videoRef}
              key={selected.media.id}
              src={selected.media.file}
              poster={group.poster}
              controls
              playsInline
              autoPlay
              preload="metadata"
              aria-label={`Watch ${selected.displayTitle}`}
              onLoadedMetadata={(event) => {
                const video = event.currentTarget;
                const saved = progressRef.current[selected.media.id];
                if (
                  saved &&
                  saved.position > 0 &&
                  saved.position < video.duration - 10
                )
                  video.currentTime = saved.position;
              }}
              onEnded={() => {
                completedRef.current = true;
                onProgress(selected.media.id, null);
                const next = group.items[index + 1];
                if (next) start(next.media.id);
              }}
            />
            {monitor.notice && (
              <div className={styles.playerError} role="status">
                {monitor.notice}
                {monitor.needsHelp && (
                  <button className={styles.button} onClick={monitor.retry}>
                    Retry playback
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {group.type === "show" && (
          <section className={styles.episodes} aria-label="Episodes">
            <div className={styles.sectionHead}>
              <h3>Episodes</h3>
              <label>
                Season{" "}
                <select
                  className={styles.select}
                  value={season}
                  onChange={(e) => setSeason(Number(e.target.value))}
                >
                  {group.seasons.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {group.items
              .filter((item) => item.season === season)
              .map((item) => (
                <button
                  className={styles.episode}
                  key={item.media.id}
                  aria-current={playing && selected.media.id === item.media.id}
                  onClick={() => start(item.media.id)}
                >
                  <span>
                    <strong>{item.displayTitle}</strong>
                    <small>{formatDuration(item.media.duration)}</small>
                  </span>
                  <span aria-hidden="true" style={{ flex: 0 }}>
                    ▶
                  </span>
                </button>
              ))}
          </section>
        )}
        {playing && group.items.length > 1 && (
          <div className={styles.actions}>
            <button
              className={styles.button}
              disabled={index === 0}
              onClick={() => start(group.items[index - 1]!.media.id)}
            >
              Previous episode
            </button>
            <button
              className={styles.button}
              disabled={index === group.items.length - 1}
              onClick={() => start(group.items[index + 1]!.media.id)}
            >
              Next episode
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
