"use client";
import { useAccount } from "@/lib/accountStore";
import AccountLink from "@/components/account/AccountLink";
import TatesTvLogo from "@/components/themes/TatesTvLogo";
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
import SaveButton from "@/components/viewer/SaveButton";
import ProgrammeArtwork from "@/components/viewer/ProgrammeArtwork";
import ComingSoon from "@/components/library/ComingSoon";
import TitleDetails from "@/components/library/TitleDetails";
import { useViewerCatalog } from "@/lib/useViewerCatalog";
import { useProfiles, profileProgressKey } from "@/lib/deviceProfiles";
import { useDeviceLibrary } from "@/lib/deviceLibrary";
import { useStore } from "@/lib/store";
import { getThemeLayoutClass } from "@/lib/themes";
import { createThemeCssVars, getThemeById } from "@/lib/themes";
import {
  buildLibrary,
  FILTERS,
  formatClock,
  formatDuration,
  getTypeLabel,
  sanitizeProgress,
  type LibraryFilter,
  type LibraryGroup,
  type ProgressMap,
  type ProgressEntry,
} from "@/lib/libraryCatalog";
import { libraryCollections, groupRuntime, sortLibrary, titleLetter, watchStatus } from "@/lib/libraryBrowse";
import { CHANNEL_CATEGORIES } from "@/lib/audience";
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
  const { media, channels } = useViewerCatalog();
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
  const [category, setCategory] = useState("all");
  const [channel, setChannel] = useState("all");
  const [letter, setLetter] = useState("all");
  const [watchFilter, setWatchFilter] = useState("all");
  const [runtime, setRuntime] = useState("all");
  const [view, setView] = useState("posters");
  const collections = useMemo(() => libraryCollections(library, channels), [library, channels]);
  const availableChannels = useMemo(() => [...new Map([...collections.values()].flatMap(entry => entry.channels).map(item => [item.id, item])).values()].sort((a, b) => (a.number ?? Number(a.id)) - (b.number ?? Number(b.id)) || a.name.localeCompare(b.name)), [collections]);
  const availableCategories = CHANNEL_CATEGORIES.filter(value => [...collections.values()].some(entry => entry.categories.includes(value)));
  const [sort, setSort] = useState("az");
  const [limit, setLimit] = useState(30);
  const [selection, setSelection] = useState<{
    key: string;
    mediaId?: string;
    play?: boolean;
  } | null>(null);
  const signedIn = !!useAccount((state) => state.user);
  const [progressKey] = useState(profileProgressKey);
  const [progress, setProgress] = useState<ProgressMap>({});
  const searchRef = useRef<HTMLInputElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const requestedRef = useRef(false);
  useEffect(() => {
    setProgress(signedIn ? readProgress(progressKey) : {});
  }, [progressKey, signedIn]);
  const updateProgress = useCallback(
    (id: string, entry: ProgressEntry | null) => {
      setProgress((previous) => {
        const next = { ...previous, ...(signedIn ? readProgress(progressKey) : {}) };
        if (entry) next[id] = entry;
        else delete next[id];
        const safe = sanitizeProgress(next);
        try {
          if (signedIn) localStorage.setItem(progressKey, JSON.stringify(safe));
        } catch {}
        return safe;
      });
    },
    [progressKey, signedIn],
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
        (category === "all" || collections.get(group.key)?.categories.some(value => value === category)) &&
        (channel === "all" || collections.get(group.key)?.channels.some(value => value.id === channel)) &&
        (letter === "all" || titleLetter(group.title) === letter) &&
        (watchFilter === "all" || watchStatus(group, progress) === watchFilter) &&
        (runtime === "all" || (runtime === "short" ? groupRuntime(group) < 1800 : runtime === "medium" ? groupRuntime(group) >= 1800 && groupRuntime(group) < 3600 : groupRuntime(group) >= 3600)) &&
        (!normalized || normalized.split(/\s+/).every(word => group.searchText.includes(word))),
    );
    return sortLibrary(groups, sort);
  }, [library, query, filter, savedOnly, watchlist, sort, collections, category, channel, letter, watchFilter, runtime, progress]);
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
    setCategory("all");
    setChannel("all");
    setLetter("all");
    setWatchFilter("all");
    setRuntime("all");
    setLimit(30);
    searchRef.current?.focus({ preventScroll: true });
  }
  const activeFilters = [
    ...(query ? [{ label: `Search: ${query}`, clear: () => setQuery("") }] : []),
    ...(category !== "all" ? [{ label: category, clear: () => setCategory("all") }] : []),
    ...(channel !== "all" ? [{ label: availableChannels.find(item => item.id === channel)?.name ?? "Channel", clear: () => setChannel("all") }] : []),
    ...(letter !== "all" ? [{ label: `Starts with ${letter}`, clear: () => setLetter("all") }] : []),
    ...(watchFilter !== "all" ? [{ label: watchFilter.replaceAll("-", " "), clear: () => setWatchFilter("all") }] : []),
    ...(runtime !== "all" ? [{ label: runtime === "short" ? "Under 30 minutes" : runtime === "medium" ? "30–60 minutes" : "60+ minutes", clear: () => setRuntime("all") }] : []),
  ];
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
              <TatesTvLogo
                width={210}
                height={110}
                className={styles.logo}
                priority
              />
            </Link>
            <div className={styles.headerActions}>
              <AccountLink />
              <ProfileButton />
              <Link href="/" className={styles.button}>
                Live TV
              </Link>
            </div>
          </div>
        </header>
        <div className={styles.content}>
          <section className={`ttv-library-intro ${styles.intro}`}>
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
          {availableCategories.length > 0 && <section className={styles.collectionSection} aria-label="Explore collections">
            <div className={styles.sectionHead}><h2>Find your kind of TV</h2><p className={styles.muted}>Browse the collections from your channels.</p></div>
            <div className={styles.collectionGrid}>{availableCategories.map(value => <button key={value} className={styles.collectionCard} aria-label={`Explore ${value}`} aria-pressed={category === value} onClick={() => { setCategory(value); setFilter("all"); setQuery(""); setSavedOnly(false); setChannel("all"); setLetter("all"); setWatchFilter("all"); setRuntime("all"); setLimit(30); searchRef.current?.scrollIntoView({ block: "center", behavior: "auto" }); searchRef.current?.focus({ preventScroll: true }); }}><span className={styles.eyebrow}>Collection</span><strong>{value}</strong><small>{library.filter(group => collections.get(group.key)?.categories.includes(value)).length} titles <span aria-hidden="true">↗</span></small></button>)}</div>
          </section>}
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
                <option value="za">Title Z–A</option>
                <option value="recent">Recently added</option>
                <option value="shortest">Shortest first</option>
                <option value="longest">Longest first</option>
                <option value="episodes">Most episodes</option>
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
                    {item.label}<span aria-hidden="true" className={styles.filterCount}>{item.id === "all" ? library.length : library.filter(group => group.type === item.id).length}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.refine}>
              <label>Category<select className={styles.select} value={category} onChange={event => { setCategory(event.target.value); setLimit(30); }}><option value="all">All categories</option>{availableCategories.map(value => <option key={value}>{value}</option>)}</select></label>
              <label>Channel<select className={styles.select} value={channel} onChange={event => { setChannel(event.target.value); setLimit(30); }}><option value="all">All channels</option>{availableChannels.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>Watch status<select className={styles.select} value={watchFilter} onChange={event => { setWatchFilter(event.target.value); setLimit(30); }}><option value="all">Any watch status</option><option value="not-started">Not started</option><option value="in-progress">In progress</option><option value="finished">Finished</option></select></label>
              <label>Time to watch<select className={styles.select} value={runtime} onChange={event => { setRuntime(event.target.value); setLimit(30); }}><option value="all">Any length</option><option value="short">Under 30 minutes</option><option value="medium">30–60 minutes</option><option value="long">60+ minutes</option></select></label>
            </div>
            <p className={styles.browseHint}>Categories follow the channel collections. For shows, time filters use the shortest available episode.</p>
            <nav className={styles.alphabet} aria-label="Browse titles alphabetically">
              {["all", "#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map(value => <button key={value} aria-pressed={letter === value} disabled={value !== "all" && !library.some(group => titleLetter(group.title) === value)} onClick={() => { setLetter(value); setLimit(30); }}>{value === "all" ? "Any" : value}</button>)}
            </nav>
            {(activeFilters.length > 0 || filter !== "all" || savedOnly) && <div className={styles.activeFilters} aria-label="Active library filters">
              {activeFilters.map(item => <button key={item.label} className={styles.button} onClick={() => { item.clear(); setLimit(30); }} aria-label={`Remove ${item.label} filter`}>{item.label} ×</button>)}
              <button className={styles.button} onClick={browseAll}>Clear all filters</button>
            </div>}
            <div className={styles.resultsHeading}>
              <h2>{savedOnly ? "My watchlist" : filter !== "all" ? FILTERS.find(item => item.id === filter)?.label : "Browse Titles"}</h2>
              <div className={styles.viewSwitch} aria-label="Library layout"><button className={styles.button} aria-pressed={view === "posters"} onClick={() => setView("posters")}>Posters</button><button className={styles.button} aria-pressed={view === "list"} onClick={() => setView("list")}>List</button></div>
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
                <div className={`${styles.grid} ${view === "list" ? styles.listView : ""}`}>
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
                        <div className={styles.cardInfo}><h3>{group.title}</h3>
                        <p>
                          {getTypeLabel(group.type)}
                          {group.type === "show"
                            ? ` · ${group.seasons.length} ${group.seasons.length === 1 ? "season" : "seasons"} · ${group.items.length} episodes`
                            : ` · ${formatDuration(group.totalDuration)}`}
                        </p>
                        <p className={styles.cardCategory}>{collections.get(group.key)?.categories.join(" · ") || "On demand"}</p>
                        {watchStatus(group, progress) !== "not-started" && <span className={styles.watchBadge}>{watchStatus(group, progress) === "finished" ? "Watched" : "In progress"}</span>}
                        </div>
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
