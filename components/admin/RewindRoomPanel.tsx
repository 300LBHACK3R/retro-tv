"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { formatDuration } from "@/lib/libraryCatalog";
import styles from "@/components/library/library.module.css";

const RewindMovieUpload = dynamic(() => import("./RewindMovieUpload"));

export default function RewindRoomPanel({ onArtwork }: { onArtwork: () => void }) {
  const media = useStore(state => state.media);
  const updateMedia = useStore(state => state.updateMedia);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(40);
  const [message, setMessage] = useState("");
  const [upload, setUpload] = useState(false);
  const movies = useMemo(() => media.filter(item => item.type === "movie").sort((a, b) => a.title.localeCompare(b.title)), [media]);
  const filtered = movies.filter(item => item.title.toLowerCase().includes(query.trim().toLowerCase()));
  const stocked = movies.filter(item => item.rewindRoom === true).length;
  return <section className="ttv-admin-card" aria-labelledby="rewind-admin-heading">
    <h2 id="rewind-admin-heading">Stock the Rewind Room</h2>
    <p className={styles.muted}>Upload a new tape or select movies already in your media library. No channel assignment is required.</p>
    <div className={styles.actions}>
      <button className={styles.primary} aria-expanded={upload} onClick={() => setUpload(value => !value)}>{upload ? "Close movie upload" : "Upload a movie"}</button>
      <button className={styles.button} onClick={onArtwork}>Edit covers & Kids approval</button>
      <Link href="/rewind-room" className={styles.button} target="_blank" rel="noreferrer">Preview the room ↗</Link>
    </div>
    {upload ? <RewindMovieUpload /> : null}
    <p className={styles.muted}>{stocked} of {movies.length} movies on the shelf. Adding a movie here does not approve it for Kids or change its live schedule.</p>
    <label>Find a movie<input type="search" className={styles.input} placeholder="Search your uploaded movies" value={query} onChange={event => { setQuery(event.target.value); setLimit(40); }} /></label>
    <p role="status" className={styles.status}>{message}</p>
    {!movies.length ? <p>No movies uploaded yet. Your Rewind Room is ready for its first tape.</p> : !filtered.length ? <p>No movies match that search.</p> : <div className={styles.rewindAdminList}>{filtered.slice(0, limit).map(movie => <label key={movie.id} className={styles.rewindAdminRow}>
      <input type="checkbox" aria-label={`Show ${movie.title} in Rewind Room`} checked={movie.rewindRoom === true} disabled={!movie.file.trim() || !movie.duration} onChange={event => {
        updateMedia(movie.id, { rewindRoom: event.target.checked });
        setMessage(`${movie.title} ${event.target.checked ? "added to" : "removed from"} the shelf. Wait for Global saved before leaving.`);
      }} />
      <span><strong>{movie.title}</strong><small>{formatDuration(movie.duration)} · {movie.kidsApproved === true ? "Video reviewed for Kids" : "Not approved for Kids"}</small></span>
      <span>{movie.rewindRoom === true ? "On the shelf" : "Not on the shelf"}</span>
    </label>)}</div>}
    {filtered.length > limit ? <button className={styles.button} onClick={() => setLimit(value => value + 40)}>Show more movies</button> : null}
  </section>;
}
