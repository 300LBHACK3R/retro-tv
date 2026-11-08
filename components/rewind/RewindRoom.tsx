"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import ProfileGate, { ProfileButton } from "@/components/viewer/ProfileGate";
import TatesTvLogo from "@/components/themes/TatesTvLogo";
import ProgrammeArtwork from "@/components/viewer/ProgrammeArtwork";
import SaveButton from "@/components/viewer/SaveButton";
import { useStore } from "@/lib/store";
import { useProfiles } from "@/lib/deviceProfiles";
import { useDeviceLibrary } from "@/lib/deviceLibrary";
import { useLibraryProgress } from "@/lib/useLibraryProgress";
import { rewindRoomCatalog } from "@/lib/rewindRoom";
import { formatDuration, formatClock, isSavedGroup } from "@/lib/libraryCatalog";
import { createThemeCssVars, getThemeById } from "@/lib/themes";
import styles from "./rewind.module.css";

const TitleDetails = dynamic(() => import("@/components/library/TitleDetails"));

function Cassette() {
  return <div className={styles.cassette} aria-hidden="true">
    <div className={styles.tapeLabel}><span>TATE’S TV · HOME VIDEO</span><strong>Movie night.</strong><small>BE KIND. REWIND.</small></div>
    <div className={styles.tapeWindow}><i /><span /><i /></div>
    <div className={styles.tapeFoot}><span>VHS</span><span>HI-FI STEREO</span><span>▶ PLAY</span></div>
  </div>;
}

export default function RewindRoom() {
  return <ProfileGate><MovieShelf /></ProfileGate>;
}

function MovieShelf() {
  const media = useStore(state => state.media);
  const channels = useStore(state => state.channels);
  const artwork = useStore(state => state.libraryArtwork);
  const themeId = useStore(state => state.themeId);
  const kids = useProfiles(state => state.profiles.find(profile => profile.id === state.activeId)?.kids === true);
  const watchlist = useDeviceLibrary(state => state.watchlist);
  const { progress, updateProgress } = useLibraryProgress();
  const titles = useMemo(() => rewindRoomCatalog(channels, media, artwork, kids), [channels, media, artwork, kids]);
  const themeStyle = useMemo(() => createThemeCssVars(getThemeById(themeId)) as CSSProperties, [themeId]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("az");
  const [limit, setLimit] = useState(24);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const selected = titles.find(title => title.key === selectedKey);
  const filtered = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/);
    const matches = titles.filter(title => {
      const saved = progress[title.items[0]!.media.id];
      return words.every(word => title.searchText.includes(word)) &&
        (filter !== "saved" || isSavedGroup(title, watchlist)) &&
        (filter !== "continue" || (saved && saved.position >= 10 && saved.position < saved.duration - 10));
    });
    return matches.sort((a, b) => sort === "recent"
      ? (Date.parse(b.items[0]!.media.createdAt || "") || 0) - (Date.parse(a.items[0]!.media.createdAt || "") || 0) || a.title.localeCompare(b.title)
      : a.title.localeCompare(b.title, undefined, { numeric: true }));
  }, [titles, query, filter, sort, progress, watchlist]);

  function clearFilters() { setQuery(""); setFilter("all"); setSort("az"); setLimit(24); }

  return <>
    <main className={styles.page} inert={selected ? true : undefined} aria-hidden={selected ? true : undefined}>
      <header className={styles.header}>
        <Link href="/" aria-label="Tate's TV home"><TatesTvLogo width={180} height={90} className={styles.logo} /></Link>
        <nav aria-label="Rewind Room navigation"><Link href="/">Live TV</Link><Link href="/library">Library</Link><Link href="/rewind-room" aria-current="page">Rewind Room</Link></nav>
        <ProfileButton />
      </header>
      <div className={styles.content}>
        <section className={styles.hero} aria-labelledby="rewind-title">
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>TATE’S TV PRESENTS · {kids ? "THE KIDS’ SHELF" : "YOUR FRIDAY NIGHT, ANY NIGHT"}</span>
            <h1 id="rewind-title">The <em>Rewind</em><br />Room<span>.</span></h1>
            <p>A shelf full of memories.<br />Pick a tape. Make a night of it.</p>
            <a href="#movie-shelf" className={styles.primary}>{titles.length ? "Browse the tapes" : "Explore the room"} <span aria-hidden="true">↘</span></a>
          </div>
          <div className={styles.heroArt}><Cassette /><span className={styles.handwritten}>No late fees. Ever.</span></div>
        </section>
        <div className={styles.ribbon}><span>VHS SOUL. MODERN PLAYBACK.</span><span>PLAY · PAUSE · REWIND · REPEAT</span></div>
        <section id="movie-shelf" className={styles.shelf} aria-label="Rewind Room movies">
          <div className={styles.shelfHeading}><div><span className={styles.eyebrow}>THE COLLECTION</span><h2>{kids ? "Little viewers. Big adventures." : "Find your next movie night."}</h2></div><span className={styles.stock}>{titles.length} {titles.length === 1 ? "tape" : "tapes"} on the shelf</span></div>
          {titles.length ? <>
            <div className={styles.tools}>
              <label className={styles.search}>Find a movie<input type="search" placeholder="Search the shelf…" value={query} onChange={event => { setQuery(event.target.value); setLimit(24); }} /></label>
              <label>Sort the shelf<select value={sort} onChange={event => { setSort(event.target.value); setLimit(24); }}><option value="az">Title A–Z</option><option value="recent">Recently added</option></select></label>
            </div>
            <div className={styles.filters} aria-label="Movie shelf filters">
              {[["all", "All tapes"], ["continue", "Pick up where you paused"], ["saved", "My watchlist"]].map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => { setFilter(id!); setLimit(24); }}>{label}</button>)}
            </div>
            <p className={styles.resultCount} role="status">{filtered.length} {filtered.length === 1 ? "movie" : "movies"} found</p>
            {filtered.length ? <div className={styles.grid}>{filtered.slice(0, limit).map((group) => {
              const item = group.items[0]!.media;
              const entry = progress[item.id];
              const resume = !!entry && entry.position >= 10 && entry.position < entry.duration - 10;
              return <article key={group.key} className={styles.movie}>
                <button type="button" className={styles.case} aria-label={`Open tape: ${group.title}`} onClick={event => { returnFocusRef.current = event.currentTarget; setSelectedKey(group.key); }}>
                  <span className={styles.caseBand}>TATE’S TV <b>HOME VIDEO</b></span>
                  <span className={styles.caseArt}><ProgrammeArtwork src={group.poster} title={group.title} kind="Movie night" /><span className={styles.playMark} aria-hidden="true">▶</span></span>
                  <span className={styles.caseLabel}><strong>{group.title}</strong><span>VHS <i /> {formatDuration(item.duration)}</span></span>
                  {resume ? <span className={styles.progress}><span style={{ width: `${Math.min(100, entry.position / entry.duration * 100)}%` }} /></span> : null}
                </button>
                <div className={styles.movieActions}><small>{resume ? `Paused at ${formatClock(entry.position)}` : entry ? "Watched · Ready for a rewatch" : "Ready to play"}</small><SaveButton id={group.key} aliases={group.aliasKeys} title={group.title} kind="programme" /></div>
              </article>;
            })}</div> : <div className={styles.noResults}><h3>No tapes match.</h3><p>Try another title or browse the whole shelf.</p><button className={styles.primary} onClick={clearFilters}>Show all tapes</button></div>}
            {filtered.length > limit ? <button className={styles.loadMore} onClick={() => setLimit(value => value + 24)}>More from the shelf</button> : null}
          </> : <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">▶ ▐▐ ◀◀</span>
            <h3>{kids ? "Your movie shelf is getting ready." : "The first tapes are on their way."}</h3>
            <p>{kids ? "Movies will appear here when they’ve been approved for Kids profiles." : "We’re stocking the shelves. Come back for movie nights with a little VHS nostalgia and all the controls you need."}</p>
            <Link href="/library" className={styles.primary}>Browse the library <span aria-hidden="true">↗</span></Link>
          </div>}
        </section>
        <footer className={styles.footer}><strong>BE KIND. REWIND.</strong><span>Old-school movie nights. On your schedule.</span><Link href="/">Back to live TV ↗</Link></footer>
      </div>
    </main>
    {selected ? <TitleDetails key={selected.key} group={selected} variant="rewind" progress={progress} onProgress={updateProgress} onClose={() => setSelectedKey(null)} returnFocusRef={returnFocusRef} themeStyle={themeStyle} /> : null}
  </>;
}
