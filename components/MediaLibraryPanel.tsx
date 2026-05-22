"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Channel, MediaItem, MediaType } from "@/lib/types";

type MediaFilter = MediaType | "all";

const FILTER_OPTIONS: Array<{ value: MediaFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "show", label: "Shows" },
  { value: "movie", label: "Movies" },
  { value: "commercial", label: "Commercials" },
  { value: "bumper", label: "Bumpers" },
];

function prettyDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));

  if (safeSeconds < 60) {
    return `${safeSeconds}s`;
  }

  const minutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }

  return `${minutes}m`;
}

function getChannelLabel(channel: Channel | undefined): string {
  if (!channel) {
    return "CH --";
  }

  return `CH ${channel.number ?? channel.id}`;
}

function getChannelName(channel: Channel | undefined): string {
  if (!channel) {
    return "Unknown Channel";
  }

  return channel.branding?.displayName ?? channel.name;
}

function getProviderLabel(item: MediaItem): string {
  if (item.provider === "cloudflare-r2") {
    return "Cloudflare R2";
  }

  if (item.provider === "external-url") {
    return "External URL";
  }

  if (item.provider === "local-dev") {
    return "Local Dev";
  }

  if (item.file.includes(".r2.dev") || item.file.toLowerCase().includes("cloudflare")) {
    return "Cloudflare R2";
  }

  if (item.file.startsWith("https://")) {
    return "Remote URL";
  }

  if (item.file.startsWith("/")) {
    return "Local Dev";
  }

  return "Unknown Source";
}

function matchesSearch(item: MediaItem, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    item.title,
    item.type,
    item.file,
    item.originalName,
    item.description,
    item.provider,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

export default function MediaLibraryPanel() {
  const media = useStore((state) => state.media);
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const removeMedia = useStore((state) => state.removeMedia);
  const assignMediaToChannel = useStore((state) => state.assignMediaToChannel);
  const removeMediaFromChannel = useStore((state) => state.removeMediaFromChannel);

  const [filter, setFilter] = useState<MediaFilter>("all");
  const [query, setQuery] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const currentChannel = useMemo(
    () => channels.find((channel) => channel.id === currentChannelId),
    [channels, currentChannelId],
  );

  const assignedChannelMap = useMemo(() => {
    const map = new Map<string, Channel[]>();

    for (const item of media) {
      map.set(
        item.id,
        channels.filter((channel) => channel.mediaIds.includes(item.id)),
      );
    }

    return map;
  }, [channels, media]);

  const filteredMedia = useMemo(() => {
    return media
      .filter((item) => filter === "all" || item.type === filter)
      .filter((item) => matchesSearch(item, query))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [filter, media, query]);

  const totalDuration = useMemo(
    () => filteredMedia.reduce((sum, item) => sum + Math.max(0, item.duration), 0),
    [filteredMedia],
  );

  const handleDeleteClick = (item: MediaItem) => {
    if (pendingDeleteId !== item.id) {
      setPendingDeleteId(item.id);
      return;
    }

    removeMedia(item.id);
    setPendingDeleteId(null);
  };

  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-wide">Media Manager</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Manage saved Cloudflare/R2 media metadata and channel assignments.
          </p>
        </div>

        <div
          className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{
            borderColor: "var(--border)",
            background: "var(--panel-alt-bg)",
            color: "var(--text-muted)",
          }}
        >
          {media.length} Items
        </div>
      </div>

      <div className="mb-3 grid gap-2 md:grid-cols-[1fr_160px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title, URL, filename, provider..."
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
          spellCheck={false}
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />

        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as MediaFilter)}
          className="rounded-lg border px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        >
          {FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
        <span>
          Showing {filteredMedia.length} of {media.length}
        </span>
        <span>•</span>
        <span>Total visible runtime: {prettyDuration(totalDuration)}</span>
        <span>•</span>
        <span>
          Current channel: {getChannelLabel(currentChannel)} •{" "}
          {getChannelName(currentChannel)}
        </span>
      </div>

      <div className="max-h-[380px] space-y-2 overflow-auto pr-1">
        {filteredMedia.length === 0 ? (
          <div
            className="rounded-xl border px-3 py-6 text-center text-xs"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text-muted)",
            }}
          >
            No media found.
          </div>
        ) : (
          filteredMedia.map((item) => {
            const assignedChannels = assignedChannelMap.get(item.id) ?? [];
            const isAssignedToCurrent = assignedChannels.some(
              (channel) => channel.id === currentChannelId,
            );

            const isPendingDelete = pendingDeleteId === item.id;

            return (
              <article
                key={item.id}
                className="rounded-xl border p-3"
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor: isPendingDelete ? "#ef4444" : "var(--border)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold" title={item.title}>
                      {item.title}
                    </div>

                    <div
                      className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <span>{item.type.toUpperCase()}</span>
                      <span>•</span>
                      <span>{prettyDuration(item.duration)}</span>
                      <span>•</span>
                      <span>{getProviderLabel(item)}</span>
                    </div>

                    <div
                      className="mt-2 truncate text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                      title={item.file}
                    >
                      {item.file}
                    </div>

                    <div
                      className="mt-2 text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Channels:{" "}
                      {assignedChannels.length > 0
                        ? assignedChannels
                            .map(
                              (channel) =>
                                `${getChannelLabel(channel)} ${channel.branding?.callsign ?? ""}`.trim(),
                            )
                            .join(", ")
                        : "None"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteClick(item)}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold transition hover:opacity-90"
                    style={{
                      background: isPendingDelete ? "#ef4444" : "#7f1d1d",
                      color: "#fff",
                    }}
                    aria-label={
                      isPendingDelete
                        ? `Confirm delete ${item.title}`
                        : `Delete ${item.title}`
                    }
                  >
                    {isPendingDelete ? "Confirm" : "Delete"}
                  </button>
                </div>

                {isPendingDelete ? (
                  <div className="mt-2 text-[11px] text-red-200">
                    Click Confirm to permanently remove this media entry from all
                    channels.
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {!isAssignedToCurrent ? (
                    <button
                      type="button"
                      onClick={() => {
                        assignMediaToChannel(currentChannelId, item.id);
                        setPendingDeleteId(null);
                      }}
                      className="rounded-lg px-2 py-1 text-xs font-medium transition hover:opacity-90"
                      style={{
                        background: "var(--button-bg)",
                        color: "var(--text)",
                      }}
                    >
                      Add to {getChannelLabel(currentChannel)}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        removeMediaFromChannel(currentChannelId, item.id);
                        setPendingDeleteId(null);
                      }}
                      className="rounded-lg px-2 py-1 text-xs font-medium transition hover:opacity-90"
                      style={{
                        background: "var(--button-bg)",
                        color: "var(--text)",
                      }}
                    >
                      Remove from {getChannelLabel(currentChannel)}
                    </button>
                  )}

                  <a
                    href={item.file}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg px-2 py-1 text-xs font-medium transition hover:opacity-90"
                    style={{
                      background: "var(--button-bg)",
                      color: "var(--text)",
                    }}
                  >
                    Test Source
                  </a>

                  {pendingDeleteId && pendingDeleteId !== item.id ? (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(null)}
                      className="rounded-lg px-2 py-1 text-xs font-medium transition hover:opacity-90"
                      style={{
                        background: "var(--button-bg)",
                        color: "var(--text)",
                      }}
                    >
                      Cancel Delete
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}