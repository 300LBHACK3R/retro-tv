"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type SubmissionStatus =
  | "pending"
  | "reviewing"
  | "approved"
  | "changes_requested"
  | "rejected";

type RightsConfirmations = {
  filmedByYou?: boolean;
  ownRights?: boolean;
  peopleConsent?: boolean;
  ageConfirm?: boolean;
  contentConfirm?: boolean;
  rightsAgreement?: boolean;
};

type SubmissionSummary = {
  id: string;
  reference_code: string;
  kind: "failzone" | "creator";
  status: SubmissionStatus;
  submitter_name: string;
  submitter_email: string;
  credit_name: string | null;
  content_title: string;
  description: string;
  location: string | null;
  object_key: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  share_url: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
};

type SubmissionDetail = SubmissionSummary & {
  rights_confirmations?: RightsConfirmations | null;
  preview_url?: string | null;
};

type ListResponse = {
  ok?: boolean;
  submissions?: SubmissionSummary[];
  error?: string;
};

type DetailResponse = {
  ok?: boolean;
  submission?: SubmissionDetail;
  error?: string;
};

const STATUS_OPTIONS: Array<{ value: SubmissionStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "reviewing", label: "Reviewing" },
  { value: "approved", label: "Approved" },
  { value: "changes_requested", label: "Changes Requested" },
  { value: "rejected", label: "Rejected" },
];

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Unknown date";

  return date.toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatBytes(value: number | null): string {
  if (!value || !Number.isFinite(value)) return "Link submission";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(value) / Math.log(1024)),
  );
  const amount = value / 1024 ** index;

  return `${amount >= 100 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

function statusLabel(status: SubmissionStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function getStatusStyle(status: SubmissionStatus) {
  if (status === "approved") {
    return {
      borderColor: "rgba(34,197,94,0.38)",
      background: "rgba(34,197,94,0.12)",
      color: "#86efac",
    };
  }

  if (status === "rejected") {
    return {
      borderColor: "rgba(248,113,113,0.38)",
      background: "rgba(248,113,113,0.10)",
      color: "#fca5a5",
    };
  }

  if (status === "changes_requested") {
    return {
      borderColor: "rgba(251,146,60,0.38)",
      background: "rgba(251,146,60,0.10)",
      color: "#fdba74",
    };
  }

  if (status === "reviewing") {
    return {
      borderColor: "rgba(56,189,248,0.38)",
      background: "rgba(56,189,248,0.10)",
      color: "#7dd3fc",
    };
  }

  return {
    borderColor: "rgba(250,204,21,0.38)",
    background: "rgba(250,204,21,0.10)",
    color: "#fde68a",
  };
}

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function RightsGrid({ rights }: { rights?: RightsConfirmations | null }) {
  const confirmations = [
    ["Filmed / created by submitter", rights?.filmedByYou],
    ["Owns rights / has permission", rights?.ownRights],
    ["Recognizable people consented", rights?.peopleConsent],
    ["Adult or guardian permission", rights?.ageConfirm],
    ["Content rules confirmed", rights?.contentConfirm],
    ["Release terms accepted", rights?.rightsAgreement],
  ] as const;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {confirmations.map(([label, confirmed]) => (
        <div
          key={label}
          className="rounded-xl border px-3 py-2 text-xs"
          style={{
            borderColor: confirmed
              ? "rgba(34,197,94,0.32)"
              : "rgba(248,113,113,0.32)",
            background: confirmed
              ? "rgba(34,197,94,0.08)"
              : "rgba(248,113,113,0.08)",
            color: confirmed ? "#86efac" : "#fca5a5",
          }}
        >
          <strong>{confirmed ? "Confirmed" : "Missing"}</strong>
          <span className="mt-1 block" style={{ color: "var(--text-muted)" }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SubmissionInboxPanel() {
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [filter, setFilter] = useState<"all" | SubmissionStatus>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Loading submission inbox...");
  const [draftStatus, setDraftStatus] = useState<SubmissionStatus>("pending");
  const [adminNotes, setAdminNotes] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setMessage("Loading submission inbox...");

    try {
      const response = await fetch("/api/admin/submissions", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const body = await readJsonSafe<ListResponse>(response);

      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || "Could not load submissions.");
      }

      const nextSubmissions = body.submissions ?? [];
      setSubmissions(nextSubmissions);
      setSelectedId((current) =>
        current && nextSubmissions.some((item) => item.id === current)
          ? current
          : nextSubmissions[0]?.id ?? "",
      );
      setMessage(
        nextSubmissions.length > 0
          ? `${nextSubmissions.length} submission${nextSubmissions.length === 1 ? "" : "s"} loaded.`
          : "No submissions have arrived yet.",
      );
    } catch (error) {
      setSubmissions([]);
      setMessage(error instanceof Error ? error.message : "Could not load submissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) {
      setDetail(null);
      return;
    }

    setDetailLoading(true);

    try {
      const response = await fetch(`/api/admin/submissions?id=${encodeURIComponent(id)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const body = await readJsonSafe<DetailResponse>(response);

      if (!response.ok || !body?.ok || !body.submission) {
        throw new Error(body?.error || "Could not load submission details.");
      }

      setDetail(body.submission);
      setDraftStatus(body.submission.status);
      setAdminNotes(body.submission.admin_notes ?? "");
    } catch (error) {
      setDetail(null);
      setMessage(error instanceof Error ? error.message : "Could not load submission details.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  const filtered = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return submissions.filter((submission) => {
      if (filter !== "all" && submission.status !== filter) return false;

      if (!cleanQuery) return true;

      return [
        submission.reference_code,
        submission.content_title,
        submission.submitter_name,
        submission.submitter_email,
        submission.credit_name ?? "",
      ].some((value) => value.toLowerCase().includes(cleanQuery));
    });
  }, [filter, query, submissions]);

  const statusCounts = useMemo(() => {
    return STATUS_OPTIONS.reduce<Record<SubmissionStatus, number>>(
      (counts, option) => {
        counts[option.value] = submissions.filter(
          (submission) => submission.status === option.value,
        ).length;
        return counts;
      },
      {
        pending: 0,
        reviewing: 0,
        approved: 0,
        changes_requested: 0,
        rejected: 0,
      },
    );
  }, [submissions]);

  const saveReview = async () => {
    if (!detail || saving) return;

    setSaving(true);
    setMessage(`Saving ${detail.reference_code}...`);

    try {
      const response = await fetch("/api/admin/submissions", {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: detail.id,
          status: draftStatus,
          adminNotes,
        }),
      });
      const body = await readJsonSafe<DetailResponse>(response);

      if (!response.ok || !body?.ok || !body.submission) {
        throw new Error(body?.error || "Could not save the review.");
      }

      setDetail((current) =>
        current
          ? {
              ...current,
              ...body.submission,
              preview_url: current.preview_url,
            }
          : body.submission!,
      );
      setSubmissions((current) =>
        current.map((item) =>
          item.id === body.submission!.id
            ? { ...item, ...body.submission! }
            : item,
        ),
      );
      setMessage(`${body.submission.reference_code} saved as ${statusLabel(body.submission.status)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the review.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid min-w-0 gap-4" style={{ color: "var(--text)" }}>
      <header
        className="relative overflow-hidden rounded-3xl border p-4 sm:p-6"
        style={{
          borderColor: "var(--border)",
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--primary) 13%, var(--panel-bg)), var(--panel-bg) 65%)",
        }}
      >
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div
              className="text-[10px] font-black uppercase tracking-[0.2em]"
              style={{ color: "var(--primary)" }}
            >
              Moderation Queue
            </div>
            <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
              Submissions Inbox
            </h2>
            <p className="mt-2 max-w-3xl text-xs leading-5 sm:text-sm" style={{ color: "var(--text-muted)" }}>
              Review uploaded FailZone clips, verify rights confirmations, play private previews,
              record notes, and control approval status from one protected screen.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadList()}
            disabled={loading}
            className="ttv-action-button ttv-touch-target rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-50"
          >
            {loading ? "Refreshing" : "Refresh Inbox"}
          </button>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {STATUS_OPTIONS.map((option) => {
            const styles = getStatusStyle(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className="rounded-2xl border p-3 text-left transition hover:brightness-110"
                style={{
                  ...styles,
                  boxShadow: filter === option.value ? `0 0 0 2px ${styles.color}` : "none",
                }}
              >
                <span className="block text-lg font-black">{statusCounts[option.value]}</span>
                <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.12em]">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div
        className="rounded-2xl border px-4 py-3 text-xs leading-5"
        style={{
          borderColor: "var(--border)",
          background: "var(--panel-alt-bg)",
          color: "var(--text-muted)",
        }}
        aria-live="polite"
      >
        {message}
      </div>

      <div className="grid min-h-[34rem] gap-4 xl:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.35fr)]">
        <aside
          className="min-h-0 overflow-hidden rounded-3xl border"
          style={{ borderColor: "var(--border)", background: "var(--panel-bg)" }}
        >
          <div className="grid gap-3 border-b p-3" style={{ borderColor: "var(--border)" }}>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-1">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, title, email, or reference"
                className="min-w-0 rounded-xl border px-3 py-3 text-sm outline-none"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--panel-alt-bg)",
                  color: "var(--text)",
                }}
              />
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as "all" | SubmissionStatus)}
                className="rounded-xl border px-3 py-3 text-sm"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--panel-alt-bg)",
                  color: "var(--text)",
                }}
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Showing {filtered.length} of {submissions.length}
            </div>
          </div>

          <div className="max-h-[48rem] overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                No submissions match this view.
              </div>
            ) : (
              filtered.map((submission) => {
                const active = submission.id === selectedId;
                const styles = getStatusStyle(submission.status);

                return (
                  <button
                    key={submission.id}
                    type="button"
                    onClick={() => setSelectedId(submission.id)}
                    className="mb-2 w-full rounded-2xl border p-3 text-left transition hover:brightness-110"
                    style={{
                      borderColor: active ? "var(--primary)" : "var(--border)",
                      background: active
                        ? "color-mix(in srgb, var(--primary) 12%, var(--panel-alt-bg))"
                        : "var(--panel-alt-bg)",
                      boxShadow: active
                        ? "0 0 22px color-mix(in srgb, var(--primary) 17%, transparent)"
                        : "none",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-black">
                        {submission.content_title}
                      </span>
                      <span
                        className="shrink-0 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em]"
                        style={styles}
                      >
                        {statusLabel(submission.status)}
                      </span>
                    </div>
                    <div className="mt-2 truncate text-xs" style={{ color: "var(--text-muted)" }}>
                      {submission.submitter_name} • {submission.reference_code}
                    </div>
                    <div className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {formatDate(submission.created_at)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <article
          className="min-w-0 rounded-3xl border p-4 sm:p-5"
          style={{ borderColor: "var(--border)", background: "var(--panel-bg)" }}
        >
          {detailLoading ? (
            <div className="flex min-h-[24rem] items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
              Loading secure submission preview...
            </div>
          ) : !detail ? (
            <div className="flex min-h-[24rem] items-center justify-center text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Select a submission to review its details.
            </div>
          ) : (
            <div className="grid gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--primary)" }}>
                    {detail.reference_code}
                  </div>
                  <h3 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
                    {detail.content_title}
                  </h3>
                  <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    Submitted {formatDate(detail.created_at)} by {detail.submitter_name}
                  </p>
                </div>

                <span
                  className="w-fit rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em]"
                  style={getStatusStyle(detail.status)}
                >
                  {statusLabel(detail.status)}
                </span>
              </div>

              {detail.preview_url ? (
                <div className="overflow-hidden rounded-2xl border bg-black" style={{ borderColor: "var(--border)" }}>
                  <video
                    src={detail.preview_url}
                    controls
                    preload="metadata"
                    playsInline
                    className="aspect-video w-full bg-black object-contain"
                  />
                </div>
              ) : detail.share_url ? (
                <a
                  href={detail.share_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ttv-action-button ttv-touch-target inline-flex w-fit items-center justify-center rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em]"
                >
                  Open Shareable Clip Link
                </a>
              ) : (
                <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: "rgba(248,113,113,0.35)", color: "#fca5a5" }}>
                  No preview source is available for this submission.
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--panel-alt-bg)" }}>
                  <div className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--primary)" }}>
                    Submitter
                  </div>
                  <dl className="mt-3 grid gap-3 text-xs">
                    <div>
                      <dt style={{ color: "var(--text-muted)" }}>Name</dt>
                      <dd className="mt-1 font-black">{detail.submitter_name}</dd>
                    </div>
                    <div>
                      <dt style={{ color: "var(--text-muted)" }}>Email</dt>
                      <dd className="mt-1 break-all font-black">{detail.submitter_email}</dd>
                    </div>
                    <div>
                      <dt style={{ color: "var(--text-muted)" }}>Credit</dt>
                      <dd className="mt-1 font-black">{detail.credit_name || "Not provided"}</dd>
                    </div>
                    <div>
                      <dt style={{ color: "var(--text-muted)" }}>Location / context</dt>
                      <dd className="mt-1 font-black">{detail.location || "Not provided"}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--panel-alt-bg)" }}>
                  <div className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--primary)" }}>
                    File
                  </div>
                  <dl className="mt-3 grid gap-3 text-xs">
                    <div>
                      <dt style={{ color: "var(--text-muted)" }}>Original filename</dt>
                      <dd className="mt-1 break-all font-black">{detail.original_filename || "Shareable link"}</dd>
                    </div>
                    <div>
                      <dt style={{ color: "var(--text-muted)" }}>Size</dt>
                      <dd className="mt-1 font-black">{formatBytes(detail.file_size)}</dd>
                    </div>
                    <div>
                      <dt style={{ color: "var(--text-muted)" }}>MIME type</dt>
                      <dd className="mt-1 font-black">{detail.mime_type || "External link"}</dd>
                    </div>
                    <div>
                      <dt style={{ color: "var(--text-muted)" }}>Storage key</dt>
                      <dd className="mt-1 break-all font-mono text-[10px]">{detail.object_key || "Not uploaded to R2"}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--panel-alt-bg)" }}>
                <div className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--primary)" }}>
                  Description
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                  {detail.description}
                </p>
              </div>

              <div>
                <div className="mb-3 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--primary)" }}>
                  Rights and Consent
                </div>
                <RightsGrid rights={detail.rights_confirmations} />
              </div>

              <div className="grid gap-4 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--panel-alt-bg)" }}>
                <div className="grid gap-3 md:grid-cols-[minmax(12rem,0.35fr)_minmax(0,1fr)]">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-black">Review Status</span>
                    <select
                      value={draftStatus}
                      onChange={(event) => setDraftStatus(event.target.value as SubmissionStatus)}
                      className="rounded-xl border px-3 py-3 text-sm"
                      style={{ borderColor: "var(--border)", background: "var(--panel-bg)", color: "var(--text)" }}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-black">Private Admin Notes</span>
                    <textarea
                      value={adminNotes}
                      onChange={(event) => setAdminNotes(event.target.value.slice(0, 8000))}
                      rows={5}
                      placeholder="Rights verification, edit notes, contact history, channel assignment, or rejection reason."
                      className="rounded-xl border px-3 py-3 text-sm outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--panel-bg)", color: "var(--text)" }}
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => void saveReview()}
                  disabled={saving}
                  className="ttv-action-button ttv-touch-target w-full rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-50 sm:w-fit"
                >
                  {saving ? "Saving Review" : "Save Review"}
                </button>
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
