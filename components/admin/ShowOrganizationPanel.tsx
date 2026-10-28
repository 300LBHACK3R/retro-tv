"use client";
import { useMemo, useState, type FormEvent } from "react";
import { useStore } from "@/lib/store";
import { buildLibrary, type LibraryGroup } from "@/lib/libraryCatalog";
import { seasonLabel } from "@/lib/seriesMetadata";
import styles from "@/components/account/showRequests.module.css";

function EpisodeEditor({ item, group }: { item: LibraryGroup["items"][number]; group: LibraryGroup }) {
  const updateMedia = useStore(state => state.updateMedia);
  const [message, setMessage] = useState("");
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const season = Number(fields.get("season"));
    const episode = Number(fields.get("episode"));
    if (!Number.isInteger(season) || season < 0 || season > 99 || !Number.isInteger(episode) || episode < 1 || episode > 999) return;
    const name = String(fields.get("episodeTitle") || "").trim();
    const title = `${group.title} S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}${name ? ` - ${name}` : ""}`;
    updateMedia(item.media.id, { title });
    setMessage("Saved locally. Wait for Global saved. Review Kids approval again after changing the title.");
  }
  return <li>
    <div className={styles.heading}><h4>{item.displayTitle}</h4><span className={styles.badge}>{seasonLabel(item.season)}</span></div>
    <small className={styles.notes}>Current title: {item.media.title}</small>
    {item.season < 0 || !item.episode ? <p>Season or episode number needs review. No number has been guessed.</p> : null}
    <details><summary>Correct season or episode</summary>
      <p>Use the episode’s actual season, even when earlier seasons have not been uploaded. Season 0 is for specials.</p>
      <form className={styles.form} onSubmit={save}><div className={styles.fields}>
        <label>Season number<input name="season" type="number" required min={0} max={99} defaultValue={item.season < 0 ? "" : item.season} /></label>
        <label>Episode number<input name="episode" type="number" required min={1} max={999} defaultValue={item.episode || ""} /></label>
      </div><label>Episode title (optional)<input name="episodeTitle" maxLength={180} defaultValue={item.displayTitle.replace(/^(?:S\d+E\d+|Episode \d+)(?: · )?/, "")} /></label>
      <button type="submit">Save episode order</button></form>
    </details>{message ? <p role="status">{message}</p> : null}
  </li>;
}

export default function ShowOrganizationPanel() {
  const media = useStore(state => state.media);
  const groups = useMemo(() => buildLibrary(media).filter(group => group.type === "show"), [media]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [season, setSeason] = useState("all");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [limit, setLimit] = useState(30);
  const [episodeSearch, setEpisodeSearch] = useState("");
  const group = groups.find(group => group.key === selected);
  const visibleGroups = groups.filter(group => group.title.toLowerCase().includes(search.trim().toLowerCase()));
  const issues = new Set(group?.items.filter(item => item.season < 0 || !item.episode || group.items.some(other => other.media.id !== item.media.id && ((other.season === item.season && other.episode === item.episode) || other.media.file === item.media.file))).map(item => item.media.id));
  const episodes = group?.items.filter(item => (season === "all" || item.season === Number(season)) && (!reviewOnly || issues.has(item.media.id)) && `${item.displayTitle} ${item.media.title}`.toLowerCase().includes(episodeSearch.toLowerCase().trim())) ?? [];
  return <section className={styles.admin} aria-labelledby="organization-heading">
    <p className="ttv-account-eyebrow">Library · Series and seasons</p><h2 id="organization-heading">Show Organization</h2>
    <p>Shows group automatically by series, then season and episode. Review uncertain numbering and repeated episode numbers here. Saving an order changes the display title; the video file and channel assignments stay in place.</p>
    <div className={styles.form}><label>Find a show<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search series" /></label>
      <label>Choose a show<select value={selected} onChange={event => { setSelected(event.target.value); setSeason("all"); setReviewOnly(false); setEpisodeSearch(""); setLimit(30); }}><option value="">Select a series</option>{visibleGroups.map(item => <option key={item.key} value={item.key}>{item.title} · {item.items.length} episodes</option>)}</select></label>
    </div>
    {group ? <>
      <h3>{group.title}</h3><p>{group.items.length} episodes · {issues.size} items to review</p>
      <div className={styles.form}><div className={styles.fields}>
        <label>Filter season<select value={season} onChange={event => { setSeason(event.target.value); setLimit(30); }}><option value="all">All seasons</option>{group.seasons.map(value => <option key={value} value={value}>{seasonLabel(value)}</option>)}</select></label>
        <label>Find episode<input type="search" value={episodeSearch} onChange={event => { setEpisodeSearch(event.target.value); setLimit(30); }} placeholder="Episode name or number" /></label>
      </div><label><span><input type="checkbox" checked={reviewOnly} onChange={event => { setReviewOnly(event.target.checked); setLimit(30); }} /> Only missing or repeated numbers</span></label></div>
      <p className={styles.muted}>Repeated numbers may be duplicate uploads or alternate versions. Review the original files in Library before removing anything.</p>
      <ul className={styles.list}>{episodes.slice(0, limit).map(item => <EpisodeEditor key={item.media.id} item={item} group={group} />)}</ul>
      {!episodes.length ? <p>No episodes match these filters.</p> : null}
      {episodes.length > limit ? <button onClick={() => setLimit(value => value + 30)}>Show more episodes</button> : null}
    </> : <p>Select a show to review its seasons and episodes.</p>}
  </section>;
}
