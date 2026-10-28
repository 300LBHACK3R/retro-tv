"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { accountRequest } from "@/lib/accountStore";
import { MAX_OPEN_REQUESTS, REQUEST_PAGE_SIZE, REQUEST_STATUSES, type ShowRequest } from "@/lib/showRequests";
import styles from "./showRequests.module.css";

export default function ShowRequests({ member }: { member: boolean }) {
  const [requests, setRequests] = useState<ShowRequest[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError("");
    accountRequest(`/api/account/show-requests?page=${page}`, undefined, "GET").then(data => {
      if (current) { setRequests(data.requests); setTotal(data.total); }
    }).catch(error => { if (current) setLoadError(error.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [page, refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    submitting.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await accountRequest("/api/account/show-requests", {
        title: data.get("title"), releaseYear: data.get("year"),
        seasons: data.get("seasons"), details: data.get("details"),
      });
      setMessage(result.duplicate ? "You already requested this show. Your original request is still saved." : "Request received. You can follow its progress below.");
      form.reset(); setPage(0); setRefresh(value => value + 1);
    } catch (error) { setError(error instanceof Error ? error.message : "Please try again."); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <section id="show-requests" className={`ttv-account-card ${styles.requests}`} aria-labelledby="show-request-heading">
    <p className="ttv-account-eyebrow">Member requests</p>
    <h2 id="show-request-heading">What would you love to watch?</h2>
    <p>Tell us the show you have in mind. We’ll review it for the Tate’s TV library and post updates here.</p>
    <p className={styles.muted}>Requests are suggestions, not guaranteed additions. Availability depends on licensing and suitability. Check the Library first to see what’s already playing.</p>
    {member ? <form onSubmit={submit} className={styles.form}>
      <fieldset disabled={busy}>
        <legend className={styles.legend}>Request a show</legend>
        <label>Show title <span aria-hidden="true">*</span><input name="title" required minLength={2} maxLength={160} placeholder="e.g. The show you grew up with" autoComplete="off" /></label>
        <div className={styles.fields}>
          <label>Release year (optional)<input name="year" type="number" min={1900} max={2100} step={1} placeholder="e.g. 1996" /></label>
          <label>Seasons or episodes (optional)<input name="seasons" maxLength={80} placeholder="e.g. Seasons 1–3" /></label>
        </div>
        <label>Anything else? (optional)<textarea name="details" maxLength={1000} rows={3} placeholder="The version, cast or other details that help us find the right show." /></label>
        <small>Up to {MAX_OPEN_REQUESTS} open requests per account. Please don’t include personal information.</small>
        <button type="submit" className="ttv-account-primary">{busy ? "Sending request…" : "Send show request"}</button>
      </fieldset>
    </form> : <div className={styles.locked}><strong>A perk for paid members</strong><p>An active membership lets you submit show requests. Your previous requests and updates remain available here.</p><a href="#membership">View membership</a></div>}
    {error ? <p role="alert">{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
    <div className={styles.heading}><h3>Your requests</h3><button type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Refresh requests</button></div>
    {loading ? <p role="status">Loading requests…</p> : loadError ? <p role="alert">{loadError}</p> : <>
      {!requests.length ? <p className={styles.muted}>{page ? "No requests on this page." : "Your requested shows and our replies will appear here."}</p> : <ul className={styles.list}>
        {requests.map(request => <li key={request.id}>
          <div className={styles.heading}><h4>{request.title}{request.release_year ? ` (${request.release_year})` : ""}</h4><span className={styles.badge} data-status={request.status}>{REQUEST_STATUSES[request.status]}</span></div>
          {request.seasons ? <p>{request.seasons}</p> : null}
          <small>Requested {new Date(request.created_at).toLocaleDateString("en-CA")}</small>
          {request.details ? <p className={styles.notes}>{request.details}</p> : null}
          {request.member_reply ? <div className={styles.reply}><strong>From Tate’s TV</strong><p className={styles.notes}>{request.member_reply}</p></div> : null}
        </li>)}
      </ul>}
    </>}
    {total > REQUEST_PAGE_SIZE || page > 0 ? <nav className={styles.pagination} aria-label="Request history pages">
      <button disabled={loading || page === 0} onClick={() => setPage(value => value - 1)}>Previous requests</button><span>Page {page + 1}</span>
      <button disabled={loading || (page + 1) * REQUEST_PAGE_SIZE >= total} onClick={() => setPage(value => value + 1)}>Next requests</button>
    </nav> : null}
  </section>;
}
