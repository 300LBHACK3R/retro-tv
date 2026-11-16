"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { accountRequest } from "@/lib/accountStore";
type Check = { media_id: string; status: string; detail: string; checked_at: string; title: string };
type Health = { checkedAt: string; authHealthy: boolean; programmingHealthy: boolean; emailConfigured: boolean;
  email: { pending: number; failed: number; review: number; oldest: string | null; capped: boolean };
  events: { source: string; category: string; code: string; count: number; title: string; last_seen_at: string }[];
  checks: Check[]; mediaIds: string[] };
export default function ServiceHealthPanel() {
  const [data, setData] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const canceled = useRef(false);
  const load = useCallback(async () => { try { setData(await accountRequest("/api/admin/health", undefined, "GET")); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Health check unavailable."); } }, []);
  useEffect(() => { void load(); return () => { canceled.current = true; }; }, [load]);
  async function scan() {
    if (!data) return;
    canceled.current = false; setBusy(true); setError("");
    try {
      for (let i = 0; i < data.mediaIds.length && !canceled.current; i += 20) {
        setProgress(`Checking ${i + 1}–${Math.min(i + 20, data.mediaIds.length)} of ${data.mediaIds.length} videos…`);
        const response = await fetch("/api/admin/health", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: data.mediaIds.slice(i, i + 20) }), signal: AbortSignal.timeout(40_000) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error);
      }
      setProgress(canceled.current ? "Stopped. Completed checks are saved." : "Video checks completed."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Video check interrupted."); }
    finally { setBusy(false); }
  }
  return <section className="ttv-admin-card"><h2>Service health</h2>
    <p>Account services, the email queue and playback reports in one place. Reports cover the last seven days and contain no customer emails or credentials.</p>
    <button disabled={busy} onClick={() => void load()}>Refresh health</button>
    {error ? <p role="alert">{error}</p> : null}
    {!data && !error ? <p role="status">Checking services…</p> : null}
    {data ? <>
      <p>Checked {new Date(data.checkedAt).toLocaleString()}</p>
      <h3>Account services: {data.authHealthy && data.programmingHealthy ? "Responding" : "Needs attention"}</h3>
      <p>{data.authHealthy ? "Authentication is responding." : "Authentication did not respond successfully. Check Supabase service health and deployment configuration."} {data.programmingHealthy ? "Station data is available." : "Station data is unavailable. Check the saved programming and database connection."}</p>
      <h3>Account emails</h3><p>{data.email.pending} pending · {data.email.failed} with delivery errors · {data.email.review} needing review{data.email.capped ? " · showing the oldest 500" : ""}</p>
      {!data.emailConfigured ? <p>Email configuration is incomplete. Check the deployment’s sender address and email provider key.</p> : null}
      {data.email.failed || data.email.review ? <p>Check the email provider’s delivery logs and sender verification. Pending messages retry automatically; review messages need investigation before resending to avoid duplicates.</p> : <p>No delivery errors are recorded in the application queue.</p>}
      <p>Provider acceptance does not confirm inbox delivery. Signup and password recovery emails also need checking in the authentication provider’s email logs.</p>
      <h3>Videos</h3><p>{data.checks.filter(c => c.status === "broken").length} confirmed unavailable · {data.checks.filter(c => c.status === "unverified").length} need manual verification · {data.mediaIds.length - data.checks.length} not checked</p>
      <button disabled={busy} onClick={() => void scan()}>Check saved videos</button>{busy ? <button onClick={() => { canceled.current = true; }}>Stop after this batch</button> : null}
      <p role="status">{progress}</p>
      <ul>{data.checks.filter(c => c.status !== "reachable").map(c => <li key={c.media_id}><strong>{c.title}</strong> — {c.detail}. {c.status === "broken" ? "Replace or correct the file in Library, then check again." : "Test playback on the website and TV."} <small>Checked {new Date(c.checked_at).toLocaleString()}</small></li>)}</ul>
      <h3>Playback and account reports</h3><p>Viewer reports are signals to investigate. A report alone does not prove a file is unavailable.</p>
      {data.events.length ? <ul>{data.events.map((event, i) => <li key={`${event.source}-${event.code}-${i}`}><strong>{event.category === "playback" ? event.title : event.code === "email_failed" ? "Account email delivery" : "Account connection"}</strong> — {event.count} {event.category} reports from {event.source}. {event.category === "playback" ? "Check the saved video, then test playback." : "Check server logs and authentication availability."} Last reported {new Date(event.last_seen_at).toLocaleString()}.</li>)}</ul> : <p>No reports recorded in this period.</p>}
    </> : null}
  </section>;
}
