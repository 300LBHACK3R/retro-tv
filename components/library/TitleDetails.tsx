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
import { seasonLabel, seasonSummary } from "@/lib/seriesMetadata";

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
  const [episodeSearch, setEpisodeSearch] = useState("");
  const [episodeStatus, setEpisodeStatus] = useState("all");
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
  const visibleEpisodes = group.items.filter(item => {
    const entry = progress[item.media.id];
    const watched = entry && entry.position >= entry.duration - 10;
    const status = watched ? "watched" : entry && entry.position >= 10 ? "started" : "new";
    const text = `${item.displayTitle} ${item.media.title} ${item.episode || ""}`.toLowerCase();
    return item.season === season && episodeSearch.toLowerCase().trim().split(/\s+/).every(word => text.includes(word)) && (episodeStatus === "all" || episodeStatus === status);
  });
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
              src={group.seasonPosters[season] || group.poster}
              title={group.title}
              kind={getTypeLabel(group.type)}
            />
          </div>
          <div className={styles.detailInfo}>
            <div>
              <span className={styles.eyebrow}>
                {getTypeLabel(group.type)} ·{" "}
                {group.type === "show"
                  ? `${seasonSummary(group.seasons)} · ${group.items.length} episodes`
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
              <SaveButton id={group.key} aliases={group.aliasKeys} title={group.title} kind="programme" />
            </div>
          </div>
        </div>
        {playing && (
          <div ref={playerRef} className={styles.player}>
            <video
              ref={videoRef}
              key={selected.media.id}
              src={selected.media.file}
              poster={group.seasonPosters[selected.season] || group.poster}
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
              onEnded={(event) => {
                completedRef.current = true;
                const duration = event.currentTarget.duration;
                if (Number.isFinite(duration) && duration > 0) {
                  onProgress(selected.media.id, { position: duration, duration, updatedAt: Date.now() });
                }
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
                  onChange={(e) => {
                    const nextSeason = Number(e.target.value);
                    setSeason(nextSeason); setEpisodeSearch("");
                    if (!playing) setMediaId(group.items.find(item => item.season === nextSeason)?.media.id);
                  }}
                >
                  {group.seasons.map((value) => (
                    <option key={value} value={value}>
                      {seasonLabel(value)} · {group.items.filter(item => item.season === value).length} episodes
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.episodeTools}>
              <label>Find an episode<input type="search" className={styles.input} value={episodeSearch} onChange={event => setEpisodeSearch(event.target.value)} placeholder="Episode name or number" /></label>
              <label>Episode progress<select className={styles.select} value={episodeStatus} onChange={event => setEpisodeStatus(event.target.value)}><option value="all">All episodes</option><option value="new">Not started</option><option value="started">In progress</option><option value="watched">Watched</option></select></label>
            </div>
            <p className={styles.muted} role="status">{visibleEpisodes.length} episodes shown · {seasonLabel(season)}</p>
            {!visibleEpisodes.length ? <p>No episodes match. Try another season or clear your search and progress filter.</p> : null}
            {visibleEpisodes
              .map((item) => (
                <button
                  className={styles.episode}
                  key={item.media.id}
                  aria-current={playing && selected.media.id === item.media.id}
                  onClick={() => start(item.media.id)}
                >
                  <span className={styles.episodePoster} aria-hidden="true"><ProgrammeArtwork src={group.seasonPosters[item.season] || group.poster} title={group.title} /></span>
                  <span>
                    <strong>{item.displayTitle}</strong>
                    <small>{formatDuration(item.media.duration)}</small>
                    {progress[item.media.id] ? <small>{progress[item.media.id]!.position >= progress[item.media.id]!.duration - 10 ? "Watched" : "In progress"}</small> : null}
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
