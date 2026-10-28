"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { accountRequest } from "@/lib/accountStore";
import { REQUEST_PAGE_SIZE, REQUEST_STATUSES, type AdminShowRequest } from "@/lib/showRequests";
import styles from "@/components/account/showRequests.module.css";

function RequestEditor({ request, saved }: { request: AdminShowRequest; saved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const fields = new FormData(event.currentTarget);
    submitting.current = true; setBusy(true); setError("");
    try {
      await accountRequest("/api/admin/show-requests", {
        id: request.id, updatedAt: request.updated_at, status: fields.get("status"),
        memberReply: fields.get("reply"), adminNotes: fields.get("notes"),
      }, "PATCH");
      saved();
    } catch (error) { setError(error instanceof Error ? error.message : "Please try again."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <li>
    <div className={styles.heading}><h3>{request.title}{request.release_year ? ` (${request.release_year})` : ""}</h3><span className={styles.badge} data-status={request.status}>{REQUEST_STATUSES[request.status]}</span></div>
    {request.seasons ? <p>{request.seasons}</p> : null}
    <small>Requested {new Date(request.created_at).toLocaleDateString("en-CA")} · Account {request.user_id.slice(0, 8)}</small>
    {request.details ? <p className={styles.notes}>{request.details}</p> : null}
    <details><summary>Review request</summary><form onSubmit={submit} className={styles.form}><fieldset disabled={busy}>
      <label>Status<select name="status" defaultValue={request.status}>{Object.entries(REQUEST_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Reply visible to this member<textarea name="reply" defaultValue={request.member_reply} maxLength={1000} rows={3} placeholder="An update for their request history." /></label>
      <label>Private admin notes<textarea name="notes" defaultValue={request.admin_notes} maxLength={2000} rows={2} placeholder="Licensing checks, availability or next steps. Only Admin can see this." /></label>
      <button type="submit">{busy ? "Saving…" : "Save request update"}</button>
    </fieldset></form>{error ? <p role="alert">{error}</p> : null}</details>
  </li>;
}

export default function ShowRequestsPanel() {
  const [requests, setRequests] = useState<AdminShowRequest[]>([]);
  const [status, setStatus] = useState("open");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let current = true;
    setLoading(true); setError("");
    const params = new URLSearchParams({ status, q: search, page: String(page) });
    accountRequest(`/api/admin/show-requests?${params}`, undefined, "GET").then(data => {
      if (current) { setRequests(data.requests); setTotal(data.total); }
    }).catch(error => { if (current) setError(error.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [status, search, page, refresh]);
  return <section className={styles.admin} aria-labelledby="requests-inbox-heading">
    <p className="ttv-account-eyebrow">Membership · Programming ideas</p>
    <div className={styles.heading}><h2 id="requests-inbox-heading">Show Requests</h2><button disabled={loading} onClick={() => setRefresh(value => value + 1)}>Refresh inbox</button></div>
    <p>Paid members’ suggestions, oldest first. Review availability, update the status and reply directly to their account.</p>
    <form className={styles.form} onSubmit={event => { event.preventDefault(); const fields = new FormData(event.currentTarget); setSearch(String(fields.get("search") || "")); setStatus(String(fields.get("status") || "open")); setPage(0); setMessage(""); }}>
      <div className={styles.fields}><label>Request status<select name="status" defaultValue="open"><option value="open">All open requests</option><option value="all">All statuses</option>{Object.entries(REQUEST_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Search show titles<input name="search" maxLength={160} type="search" placeholder="Find a requested show" /></label></div>
      <button type="submit">Apply filters</button>
    </form>
    {message ? <p role="status">{message}</p> : null}
    {loading ? <p role="status">Loading inbox…</p> : error ? <p role="alert">{error}</p> : <>
      <p>{total} {total === 1 ? "request" : "requests"} in this view</p>
      {!requests.length ? <p>No requests in this view. New paid-member requests will appear here.</p> : <ul className={styles.list}>{requests.map(request => <RequestEditor key={`${request.id}:${request.updated_at}`} request={request} saved={() => { setMessage("Saved. The member can now see the status and your reply in their account."); setRefresh(value => value + 1); }} />)}</ul>}
    </>}
    <nav className={styles.pagination} aria-label="Request inbox pages"><button disabled={loading || page === 0} onClick={() => setPage(value => value - 1)}>Previous page</button><span>Page {page + 1}</span><button disabled={loading || (page + 1) * REQUEST_PAGE_SIZE >= total} onClick={() => setPage(value => value + 1)}>Next page</button></nav>
  </section>;
}
