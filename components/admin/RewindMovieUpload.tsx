"use client";
import { useRef, useState } from "react";
import AdminDirectUploadCard from "./AdminDirectUploadCard";
import ArtworkEditor from "@/components/library/ArtworkEditor";
import { useStore } from "@/lib/store";
import { createRewindMovie } from "@/lib/rewindRoom";
import { parseManualDuration } from "@/lib/mediaUtils";
import { probeVideoDuration } from "@/lib/mediaDuration";
import styles from "@/components/library/library.module.css";

export default function RewindMovieUpload() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState("");
  const [duration, setDuration] = useState("");
  const [poster, setPoster] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const requestId = useRef(0);
  function changeFile(value: string) { requestId.current++; setFile(value); setDuration(""); setBusy(false); }
  async function detect() {
    const request = ++requestId.current;
    setBusy(true); setMessage("");
    try {
      const result = await probeVideoDuration(file);
      if (request === requestId.current) setDuration(String(result.duration));
    } catch {
      if (request === requestId.current) setMessage("Couldn’t read the runtime. Enter it manually below.");
    } finally { if (request === requestId.current) setBusy(false); }
  }
  function addMovie() {
    try {
      const item = createRewindMovie({ title, file, duration: parseManualDuration(duration), poster, description });
      if (useStore.getState().media.some(media => media.file.trim() === item.file)) throw new Error("That video is already in your media library. Find the existing movie in the shelf list below, or use Quick Edit to set its type to Movie.");
      useStore.getState().addMedia(item);
      setMessage(`Added ${item.title} to the Rewind Room. Wait for Global saved before leaving. Kids approval is still required.`);
      setTitle(""); changeFile(""); setPoster(""); setDescription("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The movie could not be added."); }
  }
  return <section className={styles.adminSection} aria-label="Upload a Rewind Room movie">
    <h3>Add a new tape</h3>
    <p className={styles.muted}>Upload a browser-ready movie or paste its existing video URL. This adds it to the on-demand shelf without putting it on a live channel.</p>
    <AdminDirectUploadCard defaultFolder="Rewind-Room" onUploaded={result => { changeFile(result.publicUrl); setTitle(value => value || result.filename.replace(/\.[^.]+$/, "").replaceAll("_", " ")); }} />
    <div className={styles.fields}>
      <label>Movie title<input className={styles.input} maxLength={140} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label>Movie video URL<input className={styles.input} type="url" value={file} onChange={event => changeFile(event.target.value)} placeholder="https://…/movie.mp4" /></label>
      <div className={styles.actions}><button className={styles.button} type="button" disabled={busy || !file.startsWith("https://")} onClick={() => void detect()}>{busy ? "Detecting runtime…" : "Detect runtime"}</button></div>
      <label>Runtime (seconds or HH:MM:SS)<input className={styles.input} value={duration} onChange={event => { requestId.current++; setBusy(false); setDuration(event.target.value); }} placeholder="01:30:00" /></label>
      <label>Synopsis<textarea className={styles.input} rows={3} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></label>
      <ArtworkEditor value={poster} onChange={setPoster} />
      <button className={styles.primary} type="button" disabled={busy} onClick={addMovie}>Add movie to shelf</button>
      <p role="status" className={styles.status}>{message}</p>
    </div>
  </section>;
}
