"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { inspectStation } from "@/lib/stationDiagnostics";

interface Insights {
  totals: {
    viewers: number;
    returning_viewers: number;
    watch_seconds: number;
    buffer_seconds: number;
    starts: number;
    errors: number;
    reports: number;
    average_startup_ms: number;
  };
  channels: {
    channel_id: string;
    viewers: number;
    watch_seconds: number;
    errors: number;
  }[];
  issues: { media_id: string; errors: number; reports: number }[];
}
interface Probe {
  id: string;
  title: string;
  status: string;
  detail: string;
}
interface Growth {
  totals: {
    page_views: number;
    devices: number;
    returning_devices: number;
    playing_devices: number;
    guide_opens: number;
    cast_attempts: number;
    cast_connections: number;
    client_errors: number;
    average_page_load_ms: number;
  };
  days: {
    day: string;
    page_views: number;
    devices: number;
    playing_devices: number;
  }[];
  browsers: {
    browser: string;
    device: string;
    devices: number;
    playback_errors: number;
    client_errors: number;
    average_startup_ms: number;
  }[];
  sources: { source: string; page_views: number; devices: number }[];
  pages: { path: string; page_views: number }[];
  events: { name: string; detail: string; count: number }[];
}

export default function StationInsightsPanel() {
  const media = useStore((state) => state.media);
  const channels = useStore((state) => state.channels);
  const issues = useMemo(
    () => inspectStation(media, channels),
    [media, channels],
  );
  const [insights, setInsights] = useState<Insights | null>(null);
  const [growth, setGrowth] = useState<Growth | null>(null);
  const [growthMessage, setGrowthMessage] = useState("");
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<Probe[]>([]);
  const checksRef = useRef<AbortController | null>(null);
  useEffect(() => () => checksRef.current?.abort(), []);
  const [fixOnly, setFixOnly] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/station", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((body) => {
        if (body.ok) {
          setInsights(body.insights);
          setGrowth(body.growth ?? null);
          setGrowthMessage(body.growthError || "");
        } else
          setMessage(body.error || "Sign in again to view station insights.");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(
            "Station insights couldn’t be loaded. Try reopening this panel.",
          );
      });
    return () => controller.abort();
  }, []);
  async function checkMedia() {
    checksRef.current?.abort();
    const controller = new AbortController();
    checksRef.current = controller;
    setChecking(true);
    setResults([]);
    try {
      const unique = [
        ...new Map(media.map((item) => [item.file, item])).values(),
      ];
      for (
        let offset = 0;
        offset < unique.length && !controller.signal.aborted;
        offset += 20
      ) {
        const response = await fetch("/api/admin/station", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: unique.slice(offset, offset + 20).map((item) => item.id),
          }),
        });
        const body = await response.json();
        if (!body.ok) {
          setMessage(
            body.error || "The check couldn’t finish. Please try again.",
          );
          break;
        }
        setResults((current) => [...current, ...body.results]);
      }
    } catch {
      if (!controller.signal.aborted)
        setMessage("The media check was interrupted. Try again.");
    } finally {
      if (!controller.signal.aborted) setChecking(false);
    }
  }
  const shown = fixOnly
    ? issues.filter((issue) => issue.level === "fix")
    : issues;
  return (
    <section className="ttv-station-panel">
      <span className="ttv-section-kicker">Keep the station running</span>
      <h2>Station insights</h2>
      <p>
        Participating full-lineup profiles over the last seven days. Device
        counts are estimates, not individual people; browsers that opt out are
        excluded. Kids profiles are excluded from new measurements. TV
        connection attempts are measured separately; watch time on Cast
        receivers is not counted.
      </p>
      {message && (
        <p role="status" className="ttv-station-message">
          {message}
        </p>
      )}
      {growthMessage && (
        <p role="status" className="ttv-station-message">
          {growthMessage}
        </p>
      )}
      {growth && (
        <>
          <h3>Audience & discovery</h3>
          <div className="ttv-station-stats">
            {[
              ["Page views", growth.totals.page_views],
              ["Visiting devices", growth.totals.devices],
              ["Returning visitors", growth.totals.returning_devices],
              ["Devices starting playback", growth.totals.playing_devices],
              ["Guide opens", growth.totals.guide_opens],
              ["TV connection attempts", growth.totals.cast_attempts],
              ["TV connections", growth.totals.cast_connections],
              ["Page errors", growth.totals.client_errors],
            ].map(([label, value]) => (
              <div className="ttv-station-stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="ttv-station-table-wrap">
            <table className="ttv-station-table">
              <caption>Daily audience · UTC</caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Page views</th>
                  <th>Devices</th>
                  <th>Started playback</th>
                </tr>
              </thead>
              <tbody>
                {growth.days.map((row) => (
                  <tr key={row.day}>
                    <td>{row.day}</td>
                    <td>{row.page_views}</td>
                    <td>{row.devices}</td>
                    <td>{row.playing_devices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ttv-station-table-wrap">
            <table className="ttv-station-table">
              <caption>Browser & device reliability</caption>
              <thead>
                <tr>
                  <th>Browser / device</th>
                  <th>Devices</th>
                  <th>Playback errors</th>
                  <th>Page errors</th>
                  <th>Average playback start</th>
                </tr>
              </thead>
              <tbody>
                {growth.browsers.map((row) => (
                  <tr key={`${row.browser}:${row.device}`}>
                    <td>
                      {row.browser} · {row.device}
                    </td>
                    <td>{row.devices}</td>
                    <td>{row.playback_errors}</td>
                    <td>{row.client_errors}</td>
                    <td>
                      {row.average_startup_ms
                        ? `${(row.average_startup_ms / 1000).toFixed(1)}s`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ttv-station-table-wrap">
            <table className="ttv-station-table">
              <caption>Traffic sources</caption>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Page views</th>
                  <th>Devices</th>
                </tr>
              </thead>
              <tbody>
                {growth.sources.map((row) => (
                  <tr key={row.source}>
                    <td>{row.source}</td>
                    <td>{row.page_views}</td>
                    <td>{row.devices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Pages, themes & feature activity</summary>
            <div className="ttv-station-table-wrap">
              <table className="ttv-station-table">
                <caption>Page views</caption>
                <thead>
                  <tr>
                    <th>Page</th>
                    <th>Views</th>
                  </tr>
                </thead>
                <tbody>
                  {growth.pages.map((row) => (
                    <tr key={row.path}>
                      <td>{row.path}</td>
                      <td>{row.page_views}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ttv-station-table-wrap">
              <table className="ttv-station-table">
                <caption>Feature events</caption>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Option</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {growth.events.map((row) => (
                    <tr key={`${row.name}:${row.detail}`}>
                      <td>{row.name.replaceAll("_", " ")}</td>
                      <td>{row.detail || "—"}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <p>
            Returning visitors used the same signed browser identifier on an
            earlier UTC day. Counts exclude opt-outs, Kids profiles and visitors
            who have not selected a full-lineup profile. Browser/device
            categories are estimates. Reported events are directional
            measurements, not ad billing records.
          </p>
        </>
      )}
      <div className="ttv-station-stats">
        {[
          [
            "Viewing hours",
            insights ? (insights.totals.watch_seconds / 3600).toFixed(1) : "—",
          ],
          ["Viewing devices", insights?.totals.viewers ?? "—"],
          ["Returning devices", insights?.totals.returning_viewers ?? "—"],
          [
            "Average start",
            insights?.totals.starts
              ? `${(insights.totals.average_startup_ms / 1000).toFixed(1)}s`
              : "—",
          ],
          [
            "Buffering minutes",
            insights ? (insights.totals.buffer_seconds / 60).toFixed(1) : "—",
          ],
          ["Playback errors", insights?.totals.errors ?? "—"],
          ["Viewer reports", insights?.totals.reports ?? "—"],
          [
            "Items to fix",
            issues.filter((issue) => issue.level === "fix").length,
          ],
        ].map(([label, value]) => (
          <div className="ttv-station-stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {!!insights?.channels.length && (
        <div className="ttv-station-table-wrap">
          <table className="ttv-station-table">
            <caption>Channel activity · Last 7 days</caption>
            <thead>
              <tr>
                <th>Channel</th>
                <th>Watch time</th>
                <th>Devices</th>
                <th>Errors</th>
              </tr>
            </thead>
            <tbody>
              {insights.channels.map((row) => (
                <tr key={row.channel_id}>
                  <td>
                    {channels.find((channel) => channel.id === row.channel_id)
                      ?.branding?.displayName ||
                      (row.channel_id === "library"
                        ? "On-demand library"
                        : row.channel_id)}
                  </td>
                  <td>{(row.watch_seconds / 60).toFixed(0)} min</td>
                  <td>{row.viewers}</td>
                  <td>{row.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!!insights?.issues.length && (
        <div className="ttv-station-table-wrap">
          <table className="ttv-station-table">
            <caption>Programmes needing attention</caption>
            <thead>
              <tr>
                <th>Programme</th>
                <th>Errors</th>
                <th>Reports</th>
              </tr>
            </thead>
            <tbody>
              {insights.issues.map((row) => (
                <tr key={row.media_id}>
                  <td>
                    {media.find((item) => item.id === row.media_id)?.title ||
                      row.media_id}
                  </td>
                  <td>{row.errors}</td>
                  <td>{row.reports}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="ttv-section-actions" style={{ marginBlock: "1.5rem" }}>
        <button
          type="button"
          className="ttv-section-action"
          aria-pressed={fixOnly}
          onClick={() => setFixOnly(!fixOnly)}
        >
          {fixOnly
            ? "Show artwork and description suggestions"
            : "Show fixes only"}
        </button>
        <button
          type="button"
          className="ttv-section-action"
          disabled={checking}
          onClick={() => void checkMedia()}
        >
          {checking
            ? `Checking media… ${results.length} checked`
            : "Check saved media links"}
        </button>
      </div>
      {shown.length ? (
        <div className="ttv-station-table-wrap">
          <table className="ttv-station-table">
            <thead>
              <tr>
                <th>Programme / channel</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, 150).map((issue) => (
                <tr key={issue.id}>
                  <td>{issue.subject}</td>
                  <td>{issue.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length > 150 && (
            <p>Showing the first 150 of {shown.length} suggestions.</p>
          )}
        </div>
      ) : (
        <p>No structural issues found in the current station programming.</p>
      )}
      {!!results.length && (
        <div className="ttv-station-table-wrap">
          <table className="ttv-station-table">
            <caption>
              Media checks ·{" "}
              {results.filter((result) => result.status === "reachable").length}{" "}
              reachable of {results.length} checked
            </caption>
            <thead>
              <tr>
                <th>Programme</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={result.id}>
                  <td>{result.title}</td>
                  <td>{result.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
