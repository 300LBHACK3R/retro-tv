"use client";
import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import ProfileGate, { ProfileButton } from "@/components/viewer/ProfileGate";
import ThemeButton from "@/components/ThemeButton";
import SaveButton from "@/components/viewer/SaveButton";
import ProgrammeArtwork from "@/components/viewer/ProgrammeArtwork";
import ComingSoon from "@/components/library/ComingSoon";
import TitleDetails from "@/components/library/TitleDetails";
import { useViewerCatalog } from "@/lib/useViewerCatalog";
import { useProfiles, profileProgressKey } from "@/lib/deviceProfiles";
import { useDeviceLibrary } from "@/lib/deviceLibrary";
import { useStore } from "@/lib/store";
import { getThemeLayoutClass } from "@/lib/themeLayouts";
import { createThemeCssVars, getThemeById } from "@/lib/themes";
import {
  buildLibrary,
  FILTERS,
  formatClock,
  getTypeLabel,
  sanitizeProgress,
  type LibraryFilter,
  type LibraryGroup,
  type ProgressMap,
  type ProgressEntry,
} from "@/lib/libraryCatalog";
import styles from "./library/library.module.css";

function readProgress(key: string): ProgressMap {
  try {
    return sanitizeProgress(JSON.parse(localStorage.getItem(key) || "{}"));
  } catch {
    return {};
  }
}
export default function PublicLibrary() {
  return (
    <ProfileGate>
      <ProfileLibrary />
    </ProfileGate>
  );
}
function ProfileLibrary() {
  const { media } = useViewerCatalog();
  const kids = useProfiles(
    (state) =>
      state.profiles.find((profile) => profile.id === state.activeId)?.kids ===
      true,
  );
  const themeId = useStore((state) => state.themeId);
  const artwork = useStore((state) => state.libraryArtwork);
  const watchlist = useDeviceLibrary((state) => state.watchlist);
  const themeStyle = useMemo(
    () => createThemeCssVars(getThemeById(themeId)) as CSSProperties,
    [themeId],
  );
  const library = useMemo(
    () => buildLibrary(media, artwork, kids),
    [media, artwork, kids],
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState("az");
  const [limit, setLimit] = useState(30);
  const [selection, setSelection] = useState<{
    key: string;
    mediaId?: string;
    play?: boolean;
  } | null>(null);
  const [progressKey] = useState(profileProgressKey);
  const [progress, setProgress] = useState<ProgressMap>({});
  const searchRef = useRef<HTMLInputElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const requestedRef = useRef(false);
  useEffect(() => {
    setProgress(readProgress(progressKey));
  }, [progressKey]);
  const updateProgress = useCallback(
    (id: string, entry: ProgressEntry | null) => {
      setProgress((previous) => {
        const next = { ...previous, ...readProgress(progressKey) };
        if (entry) next[id] = entry;
        else delete next[id];
        const safe = sanitizeProgress(next);
        try {
          localStorage.setItem(progressKey, JSON.stringify(safe));
        } catch {}
        return safe;
      });
    },
    [progressKey],
  );
  useEffect(() => {
    if (requestedRef.current || !library.length) return;
    const id = new URLSearchParams(window.location.search).get("watch");
    if (!id) {
      requestedRef.current = true;
      return;
    }
    const group = library.find((entry) =>
      entry.items.some((item) => item.media.id === id),
    );
    if (group) {
      requestedRef.current = true;
      setSelection({ key: group.key, mediaId: id });
    }
  }, [library]);
  const selectedGroup = selection
    ? library.find((group) => group.key === selection.key)
    : undefined;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const groups = library.filter(
      (group) =>
        (filter === "all" || group.type === filter) &&
        (!savedOnly || watchlist.includes(group.key)) &&
        (!normalized || group.searchText.includes(normalized)),
    );
    return groups.sort((a, b) =>
      sort === "recent"
        ? Math.max(
            ...b.items.map(
              (item) => Date.parse(item.media.createdAt || "") || 0,
            ),
          ) -
            Math.max(
              ...a.items.map(
                (item) => Date.parse(item.media.createdAt || "") || 0,
              ),
            ) || a.title.localeCompare(b.title)
        : a.title.localeCompare(b.title),
    );
  }, [library, query, filter, savedOnly, watchlist, sort]);
  const continuing = useMemo(
    () =>
      library
        .flatMap((group) => {
          const recent = group.items
            .filter((item) => {
              const entry = progress[item.media.id];
              return (
                entry &&
                entry.position >= 10 &&
                entry.position < entry.duration - 10
              );
            })
            .sort(
              (a, b) =>
                (progress[b.media.id]?.updatedAt ?? 0) -
                (progress[a.media.id]?.updatedAt ?? 0),
            )[0];
          return recent
            ? [{ group, item: recent, entry: progress[recent.media.id]! }]
            : [];
        })
        .sort((a, b) => b.entry.updatedAt - a.entry.updatedAt)
        .slice(0, 10),
    [library, progress],
  );
  function open(
    group: LibraryGroup,
    target: HTMLElement,
    mediaId?: string,
    play = false,
  ) {
    returnFocusRef.current = target;
    setSelection({ key: group.key, mediaId, play });
  }
  function browseAll() {
    setQuery("");
    setFilter("all");
    setSavedOnly(false);
    setLimit(30);
    searchRef.current?.focus({ preventScroll: true });
  }
  const savedCount = library.filter((group) =>
    watchlist.includes(group.key),
  ).length;
  return (
    <>
      <main
        className={`ttv-library-shell ${getThemeLayoutClass(themeId)} ${styles.page}`}
        style={themeStyle}
        inert={selectedGroup ? true : undefined}
        aria-hidden={selectedGroup ? true : undefined}
      >
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <Link href="/" aria-label="Back to Tate's TV live channels">
              <Image
                src="/tatestv-logo.png"
                alt="Tate’s TV"
                width={210}
                height={110}
                className={styles.logo}
                priority
              />
            </Link>
            <div className={styles.headerActions}>
              <ProfileButton />
              <ThemeButton />
              <Link href="/" className={styles.button}>
                Live TV
              </Link>
            </div>
          </div>
        </header>
        <div className={styles.content}>
          <section className={styles.intro}>
            <div>
              <span className={styles.eyebrow}>
                {kids ? "Just for Kids" : "On demand · Always free"}
              </span>
              <h1>Your time. Your TV.</h1>
              <p>
                Find a favourite. Discover something new. Settle into something
                good.
              </p>
            </div>
            <span className={styles.count}>{library.length} titles</span>
          </section>
          {continuing.length > 0 && (
            <section className={styles.section} aria-label="Continue watching">
              <div className={styles.sectionHead}>
                <h2>Pick up where you left off</h2>
              </div>
              <div className={styles.rail}>
                {continuing.map(({ group, item, entry }) => (
                  <button
                    key={group.key}
                    className={styles.continueCard}
                    onClick={(event) =>
                      open(group, event.currentTarget, item.media.id, true)
                    }
                  >
                    <strong>{group.title}</strong>
                    <small>{item.displayTitle}</small>
                    <progress
                      className={styles.progress}
                      value={entry.position}
                      max={entry.duration}
                      aria-label="Watch progress"
                    />
                    <small>{formatClock(entry.position)} watched</small>
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className={styles.catalogue} aria-label="Library titles">
            <div className={styles.tools}>
              <label className={styles.search}>
                <span aria-hidden="true">⌕</span>
                <input
                  ref={searchRef}
                  type="search"
                  aria-label="Search the Tate's TV library"
                  placeholder="Search titles, episodes, movies…"
                  value={query}
                  maxLength={160}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setLimit(30);
                  }}
                />
              </label>
              <select
                aria-label="Sort titles"
                className={styles.select}
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="az">Title A–Z</option>
                <option value="recent">Recently added</option>
              </select>
              <div className={styles.filters} aria-label="Library filters">
                <button
                  aria-pressed={savedOnly}
                  onClick={() => {
                    setSavedOnly(!savedOnly);
                    setLimit(30);
                  }}
                >
                  My watchlist ({savedCount})
                </button>
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    aria-pressed={filter === item.id}
                    onClick={() => {
                      setFilter(item.id);
                      setLimit(30);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.resultsHeading}>
              <h2>Browse Titles</h2>
              <span className={styles.count} role="status">
                {filtered.length} {filtered.length === 1 ? "title" : "titles"}
              </span>
            </div>
            {!filtered.length ? (
              <div className={styles.empty}>
                <h2>
                  {!library.length
                    ? kids
                      ? "Your Kids library is being prepared"
                      : "The library is syncing"
                    : savedOnly && !savedCount
                      ? "Your watchlist is empty"
                      : "No matching library titles"}
                </h2>
                <p>
                  {!library.length
                    ? kids
                      ? "Reviewed shows from your approved Kids channels appear here automatically. You can watch your Kids channels while we prepare more titles."
                      : "Your shows, movies and music will appear here. Watch live TV in the meantime."
                    : "Try another search or browse all titles to find your next watch."}
                </p>
                {library.length ? (
                  <button className={styles.button} onClick={browseAll}>
                    Browse all titles
                  </button>
                ) : (
                  <Link className={styles.button} href="/">
                    Watch live TV
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className={styles.grid}>
                  {filtered.slice(0, limit).map((group) => (
                    <article className={styles.card} key={group.key}>
                      <button
                        className={styles.cardButton}
                        aria-label={`Open ${group.title}`}
                        onClick={(event) => open(group, event.currentTarget)}
                      >
                        <div className={styles.poster}>
                          <ProgrammeArtwork
                            src={group.poster}
                            title={group.title}
                            kind={getTypeLabel(group.type)}
                          />
                        </div>
                        <h3>{group.title}</h3>
                        <p>
                          {getTypeLabel(group.type)}
                          {group.type === "show"
                            ? ` · ${group.items.length} episodes`
                            : ""}
                        </p>
                      </button>
                      <div className={styles.cardSave}>
                        <SaveButton
                          id={group.key}
                          title={group.title}
                          kind="programme"
                          compact
                        />
                      </div>
                    </article>
                  ))}
                </div>
                {filtered.length > limit && (
                  <div className={styles.more}>
                    <button
                      className={styles.button}
                      onClick={() => setLimit(limit + 30)}
                    >
                      Show more titles
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
          <ComingSoon />
        </div>
      </main>
      {selectedGroup && (
        <TitleDetails
          key={selectedGroup.key}
          group={selectedGroup}
          initialMediaId={selection?.mediaId}
          playImmediately={selection?.play}
          progress={progress}
          onProgress={updateProgress}
          onClose={() => setSelection(null)}
          returnFocusRef={returnFocusRef}
          themeStyle={themeStyle}
        />
      )}
    </>
  );
}
