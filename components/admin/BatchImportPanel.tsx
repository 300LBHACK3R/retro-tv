"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { probeVideoDuration } from "@/lib/mediaDuration";
import { batchFileType, batchTitle, BATCH_TYPES, buildBatchImport, MAX_BATCH_ITEMS, publicVideoUrl, videoFilename, type BatchSettings } from "@/lib/batchMedia";
import { putBatchVideo, signBatchUpload, type SignedBatchUpload } from "@/lib/batchUpload";

type Row = { id: string; title: string; url: string; duration: number; name: string; signature?: string;
  selected: boolean; status: "queued" | "checking" | "uploading" | "ready" | "error" | "added" | "skipped"; progress: number; error?: string };
const DRAFT_KEY = "tatestv:batch-import:v1";
const defaults: BatchSettings = { channelId: "", type: "show", endBreak: 0, folder: "Shows" };
const labels = { show: "Shows / episodes", movie: "Movies", "music-video": "Music videos", commercial: "Commercials", bumper: "Station bumpers" };
const signature = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;
const validDuration = (duration: number) => Number.isInteger(duration) && duration > 0 && duration <= 86400;
const done = (row: Row) => row.status === "added" || row.status === "skipped";
function readDraft(): { rows: Row[]; settings: BatchSettings } {
  try {
    const value = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    if (!value || !Array.isArray(value.rows)) return { rows: [], settings: defaults };
    const settings = { ...defaults, ...value.settings };
    if (!BATCH_TYPES.includes(settings.type)) settings.type = "show";
    if (typeof settings.channelId !== "string") settings.channelId = "";
    if (typeof settings.folder !== "string") settings.folder = "Shows";
    if (![0,15,30,60,90,120,180,300].includes(settings.endBreak)) settings.endBreak = 0;
    const rows: Row[] = value.rows.slice(0, MAX_BATCH_ITEMS).filter((r: Row) => typeof r.id === "string" && typeof r.title === "string" && typeof r.name === "string").map((r: Row) => ({
      id: r.id, title: r.title.slice(0,240), name: r.name.slice(0,240), signature: typeof r.signature === "string" ? r.signature : undefined,
      url: publicVideoUrl(typeof r.url === "string" ? r.url : ""), duration: validDuration(r.duration) ? r.duration : 0,
      selected: r.selected === true, progress: 0,
      status: r.status === "added" || r.status === "skipped" ? r.status : publicVideoUrl(r.url || "") && validDuration(r.duration) ? "ready" : "queued",
    }));
    return { rows, settings };
  } catch { return { rows: [], settings: defaults }; }
}

export default function BatchImportPanel() {
  const channels = useStore(state => state.channels);
  const media = useStore(state => state.media);
  const [initial] = useState(readDraft);
  const [rows, setRows] = useState(initial.rows);
  const rowsRef = useRef(rows);
  const [settings, setSettings] = useState(initial.settings);
  const channelId = settings.channelId || channels[0]?.id || "";
  const [links, setLinks] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [message, setMessage] = useState("");
  const [draftError, setDraftError] = useState(false);
  const [page, setPage] = useState(0);
  const [files, setFiles] = useState(() => new Map<string, File>());
  const signed = useRef(new Map<string, SignedBatchUpload>());
  const operation = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; operation.current?.abort(); };
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ rows, settings })); }
    catch { setDraftError(true); }
  }, [rows, settings]);
  useEffect(() => {
    if (!busy) return;
    const preventClose = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", preventClose);
    return () => window.removeEventListener("beforeunload", preventClose);
  }, [busy]);

  function update(next: Row[]) {
    rowsRef.current = next;
    if (mounted.current) { setRows(next); setReviewed(false); }
  }
  function patch(id: string, values: Partial<Row>) {
    const current = rowsRef.current.find(row => row.id === id);
    if (!current || Object.entries(values).every(([key, value]) => current[key as keyof Row] === value)) return;
    update(rowsRef.current.map(row => row.id === id ? { ...row, ...values } : row));
  }
  function configure(values: Partial<BatchSettings>) { setSettings(current => ({ ...current, ...values })); setReviewed(false); }

  function chooseFiles(list: FileList | null) {
    if (!list || busy) return;
    const next = [...rowsRef.current];
    const attachedFiles = new Map(files);
    let attached = 0;
    for (const file of Array.from(list).sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
      const key = signature(file);
      const previous = next.find(row => row.signature === key);
      if (previous) { attachedFiles.set(previous.id, file); attached++; continue; }
      if (next.length >= MAX_BATCH_ITEMS) continue;
      let error = "";
      try { batchFileType(file); } catch (e) { error = (e as Error).message; }
      const row: Row = { id: crypto.randomUUID(), name: file.name, signature: key, title: batchTitle(file.name), url: "", duration: 0,
        selected: !error, status: error ? "error" : "queued", error, progress: 0 };
      attachedFiles.set(row.id, file);
      next.push(row); attached++;
    }
    setFiles(attachedFiles);
    update(next);
    setMessage(`${attached} files selected or reattached. Up to ${MAX_BATCH_ITEMS} items per batch; review any file errors below.`);
    if (input.current) input.current.value = "";
  }

  function addLinks() {
    const next = [...rowsRef.current];
    const seen = new Set([...next.map(row => row.url), ...media.map(item => publicVideoUrl(item.file))]);
    let added = 0, skipped = 0, invalid = 0;
    for (const line of links.split(/\r?\n/).map(value => value.trim()).filter(Boolean)) {
      const url = publicVideoUrl(line);
      if (!url) { invalid++; continue; }
      if (seen.has(url)) { skipped++; continue; }
      if (next.length >= MAX_BATCH_ITEMS) { invalid++; continue; }
      seen.add(url);
      const name = videoFilename(url);
      next.push({ id: crypto.randomUUID(), name, title: batchTitle(name), url, duration: 0, selected: true, status: "queued", progress: 0 });
      added++;
    }
    update(next);
    setMessage(`${added} links queued. ${skipped} duplicate URLs skipped. ${invalid} invalid or over-limit entries not added.`);
    if (!invalid) setLinks("");
  }

  async function prepare() {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller; setBusy(true); setReviewed(false);
    const tasks = rowsRef.current.filter(row => row.selected && !done(row) && row.status !== "ready");
    let cursor = 0;
    async function worker() {
      while (!controller.signal.aborted && cursor < tasks.length) {
        const row = tasks[cursor++];
        if (!row) return;
        try {
          const existing = useStore.getState().media.some(item => row.url && publicVideoUrl(item.file) === row.url);
          if (existing) { patch(row.id, { status: "skipped", error: "This URL is already in the station. Use Library to change its assignment." }); continue; }
          let duration = row.duration;
          let url = row.url;
          patch(row.id, { status: "checking", error: "" });
          if (!url) {
            const file = files.get(row.id);
            if (!file) throw new Error("Reselect this original file with Choose videos, then retry. Completed uploads are kept.");
            batchFileType(file);
            if (!validDuration(duration)) {
              const local = URL.createObjectURL(file);
              try { duration = (await probeVideoDuration(local, 20000, controller.signal)).duration; }
              finally { URL.revokeObjectURL(local); }
              patch(row.id, { duration });
            }
            let upload = signed.current.get(row.id);
            if (!upload || upload.expiresAt < Date.now() + 60000) {
              upload = await signBatchUpload(file, settings.folder, controller.signal);
              signed.current.set(row.id, upload);
            }
            patch(row.id, { status: "uploading", progress: 0 });
            await putBatchVideo(file, upload, controller.signal, progress => patch(row.id, { progress }));
            url = upload.publicUrl;
            patch(row.id, { url, progress: 100 });
          } else if (!validDuration(duration)) {
            duration = (await probeVideoDuration(url, 20000, controller.signal)).duration;
          }
          patch(row.id, { duration, url, status: "ready", error: "" });
        } catch (error) {
          patch(row.id, { status: controller.signal.aborted ? "queued" : "error", error: controller.signal.aborted ? "Paused. Retry to continue." : (error as Error).message });
        }
      }
    }
    await Promise.all([worker(), worker()]);
    operation.current = null;
    if (mounted.current) {
      setBusy(false);
      setMessage(controller.signal.aborted ? "Paused. Finished uploads are kept. Retrying restarts unfinished file transfers." : "Batch prepared. Review the ready items and any errors before adding to the station.");
    }
  }

  const ready = rows.filter(row => row.selected && row.status === "ready" && validDuration(row.duration) && row.title.trim() && row.url);
  const pending = rows.filter(row => row.selected && !done(row) && row.status !== "ready");
  const channel = channels.find(item => item.id === channelId);
  const isProgramme = settings.type === "show" || settings.type === "movie";
  const ad = settings.type === "commercial" || settings.type === "bumper";
  function publish() {
    if (busy || !reviewed || !ready.length) return;
    try {
      const state = useStore.getState();
      const result = buildBatchImport(state.media, state.channels, ready.map(row => ({ ...row, originalName: row.name })), { ...settings, channelId });
      useStore.setState({ media: result.media, channels: result.channels });
      const added = new Set(result.added), skipped = new Set(result.skipped);
      update(rowsRef.current.map(row => added.has(row.id) ? { ...row, status: "added", selected: false } : skipped.has(row.id) ? { ...row, status: "skipped", selected: false, error: "URL already exists in station." } : row));
      setMessage(`${added.size} added; ${skipped.size} duplicate URLs skipped. Confirm Global saved before leaving. New content still needs Kids review.`);
    } catch (error) { setMessage((error as Error).message); }
  }

  const pages = Math.max(1, Math.ceil(rows.length / 20));
  const currentPage = Math.min(page, pages - 1);
  return <section className="ttv-batch-import" aria-label="Batch import workspace">
    <header className="ttv-admin-card"><span className="ttv-admin-eyebrow">Build your lineup faster</span><h2>One batch. One channel. Ready to review.</h2>
      <p>Select up to 200 videos, or paste existing public video links to reuse uploads. Titles come from filenames; runtimes are detected. Nothing airs until you add the reviewed batch.</p>
      <p>Keep this tab open. Draft metadata is kept in this tab; after a refresh, reselect unfinished local files. Uploads do not convert video formats or guarantee playback on every device.</p>
      {draftError ? <p role="alert">Draft storage is unavailable. Keep this page open until you finish.</p> : null}
    </header>
    <div className="ttv-admin-card"><h3>1. Choose the batch settings</h3><div className="ttv-admin-form-grid">
      <label>Assign batch to channel<select value={channelId} disabled={busy} onChange={e => configure({ channelId: e.target.value })}>{channels.map(item => <option key={item.id} value={item.id}>CH {item.number ?? item.id} · {item.branding?.displayName ?? item.name}</option>)}</select></label>
      <label>Batch media type<select value={settings.type} disabled={busy} onChange={e => configure({ type: e.target.value as BatchSettings["type"] })}>{BATCH_TYPES.map(type => <option key={type} value={type}>{labels[type]}</option>)}</select></label>
      <label>Upload folder<input value={settings.folder} maxLength={120} disabled={busy} onChange={e => configure({ folder: e.target.value })} /></label>
      {isProgramme ? <label>Ad time after each new programme<select value={settings.endBreak} disabled={busy} onChange={e => configure({ endBreak: Number(e.target.value) })}>{[0,15,30,60,90,120,180,300].map(n => <option key={n} value={n}>{n ? `${n} seconds` : "No automatic end break"}</option>)}</select></label> : null}
    </div>
    <p>{ad ? "Commercials go to this channel’s ad inventory. Configure placements and breaks in Commercials afterward." : "Programmes append in the order shown below. Use Playlist afterward to reorder or choose daily shuffle."}</p>
    {isProgramme && settings.endBreak > 0 ? <p className="ttv-admin-notice">Adds end breaks and enables targeted end-break ads on this channel. Eligible commercials must already exist and fit. No mid-show cuts are created.</p> : null}
    {channel?.kidsApproved ? <p className="ttv-admin-notice">This is a Kids-reviewed channel. New unreviewed content can hide it from Kids profiles until you review the lineup in Audience & Channels.</p> : null}
    </div>
    <div className="ttv-admin-card"><h3>2. Add files or existing links</h3>
      <input ref={input} type="file" multiple accept=".mp4,.webm,.mov,.m4v" aria-label="Choose batch videos" disabled={busy} onChange={e => chooseFiles(e.target.files)} />
      <details><summary>Already uploaded? Paste public video links</summary><label>Video URLs, one per line<textarea rows={5} value={links} disabled={busy} onChange={e => setLinks(e.target.value)} placeholder="https://your-media-domain.com/Shows/Series-S01E01.mp4" /></label>
        <button type="button" className="ttv-action-button" disabled={busy || !links.trim()} onClick={addLinks}>Queue links without reuploading</button></details>
      <div className="ttv-batch-actions"><button type="button" className="ttv-action-button" disabled={busy || !pending.length} onClick={() => void prepare()}>Prepare / retry selected items</button>
        {busy ? <button type="button" onClick={() => operation.current?.abort()}>Pause preparation</button> : null}
        <button type="button" disabled={busy || !rows.length} onClick={() => update([...rows].sort((a,b) => a.title.localeCompare(b.title, undefined, { numeric: true })))}>Sort by title / episode</button>
        <button type="button" disabled={busy || !rows.some(done)} onClick={() => { update(rows.filter(row => !done(row))); setPage(0); }}>Remove finished rows</button>
      </div>
      <p>{ready.length} ready to add · {pending.length} selected awaiting preparation · {rows.filter(done).length} finished. Preparing uploads files, but does not change station programming.</p>
    </div>
    {message ? <p className="ttv-admin-feedback" role="status">{message}</p> : null}
    {rows.length ? <div className="ttv-admin-card"><h3>3. Review the queue</h3><p>Correct titles and runtimes here. If detection fails, verify playback and enter the actual runtime in seconds. Matching filenames are only a warning; duplicate URLs are skipped automatically.</p>
      <ol className="ttv-batch-rows" start={currentPage * 20 + 1}>{rows.slice(currentPage * 20, currentPage * 20 + 20).map(row => <li key={row.id} data-status={row.status}>
        <div className="ttv-batch-row-heading"><label className="ttv-admin-check"><input type="checkbox" checked={row.selected} disabled={busy || done(row)} onChange={e => patch(row.id, { selected: e.target.checked })} />Include {row.name}</label><strong>{row.status}{row.status === "uploading" ? ` ${row.progress}%` : ""}</strong></div>
        <div className="ttv-admin-form-grid"><label>Title for {row.name}<input value={row.title} maxLength={240} disabled={busy || done(row)} onChange={e => patch(row.id, { title: e.target.value })} /></label>
          <label>Runtime in seconds for {row.name}<input type="number" min={1} max={86400} step={1} value={row.duration || ""} disabled={busy || done(row)} onChange={e => { const duration = Number(e.target.value); patch(row.id, { duration, status: validDuration(duration) && row.url ? "ready" : "queued", error: "" }); }} /></label></div>
        {row.error ? <p className="ttv-admin-notice">{row.error}</p> : null}
        {row.signature && !row.url && !files.has(row.id) ? <p>Reselect the original file to continue.</p> : null}
        {!done(row) && media.some(item => item.originalName === row.name) ? <p>A filename matching this one is already in the library. Check before uploading a second copy.</p> : null}
        {row.url ? <details><summary>Video link</summary><p>{row.url}</p></details> : null}
        <button type="button" disabled={busy} onClick={() => { setFiles(current => { const next = new Map(current); next.delete(row.id); return next; }); signed.current.delete(row.id); update(rows.filter(item => item.id !== row.id)); }}>Remove from queue</button>
      </li>)}</ol>
      <div className="ttv-batch-actions"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous 20</button><span>Page {currentPage + 1} of {pages}</span><button type="button" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next 20</button></div>
      <label className="ttv-admin-check"><input type="checkbox" checked={reviewed} disabled={busy || !ready.length} onChange={e => setReviewed(e.target.checked)} />I reviewed the {ready.length} ready items and their channel assignment. Add them to the station.</label>
      <button type="button" className="ttv-action-button" disabled={busy || !reviewed || !ready.length || !channel} onClick={publish}>Add {ready.length} ready items to station</button>
      <p>Items awaiting preparation are left in the queue. Confirm Global saved afterward. Kids approval and artwork review remain in Audience & Channels and Artwork & Coming Soon. Removing a queue row does not delete its R2 file.</p>
    </div> : null}
  </section>;
}
