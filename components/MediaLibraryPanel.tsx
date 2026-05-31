"use client";

import { useMemo, useState } from "react";
import {
  formatBreakpoints,
  formatDuration,
  formatDurationClock,
} from "@/lib/mediaUtils";
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
  if (item.provider === "cloudflare-r2") return "Cloudflare R2";
  if (item.provider === "external-url") return "External URL";
  if (item.provider === "local-dev") return "Local Dev";

  const lowerFile = item.file.toLowerCase();

  if (item.file.includes(".r2.dev") || lowerFile.includes("cloudflare")) {
    return "Cloudflare R2";
  }

  if (item.file.startsWith("https://")) return "Remote URL";
  if (item.file.startsWith("/")) return "Local Dev";

  return "Unknown Source";
}

function getMediaSearchLabel(item: MediaItem): string {
  return [
    item.title,
    item.type,
    item.file,
    item.originalName,
    item.description,
    item.provider,
    item.mimeType,
    item.commercialCategory,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesSearch(item: MediaItem, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return getMediaSearchLabel(item).includes(normalizedQuery);
}

function isRemoteTestableUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("/");
}

function getTypeLabel(type: MediaType): string {
  if (type === "commercial") return "Commercial";
  if (type === "bumper") return "Bumper";
  if (type === "movie") return "Movie";
  return "Show";
}

function getBroadcastDetails(item: MediaItem): string[] {
  const details: string[] = [];

  if (item.slotLengthSeconds) {
    details.push(`Slot ${formatDurationClock(item.slotLengthSeconds)}`);
  }

  if (item.breakpoints && item.breakpoints.length > 0) {
    details.push(`Breaks ${formatBreakpoints(item.breakpoints)}`);
  }

  if (item.breakDurations && item.breakDurations.length > 0) {
    details.push(`Ads ${formatBreakpoints(item.breakDurations)}`);
  }

  if (item.fillSlotWithCommercials) {
    details.push("Auto filler");
  }

  if (item.commercialStrategy) {
    details.push(`Strategy ${item.commercialStrategy}`);
  }

  if (item.airDays && item.airDays.length > 0) {
    details.push(`Days ${item.airDays.map((day) => day.slice(0, 3)).join(", ")}`);
  }

  if (item.airStartTime) {
    details.push(`Time ${item.airStartTime}`);
  }

  if (item.commercialCategory) {
    details.push(`Category ${item.commercialCategory}`);
  }

  if (item.allowCommercialSlicing) {
    details.push("Slicing allowed");
  }

  return details;
}

function sortMedia(items: MediaItem[]): MediaItem[] {
  return [...items].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }

    return a.title.localeCompare(b.title);
  });
}

export default function MediaLibraryPanel() {
  const media = useStore((state) => state.media);
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const removeMedia = useStore((state) => state.removeMedia);
  const assignMediaToChannel = useStore((state) => state.assignMediaToChannel);
  const removeMediaFromChannel = useStore(
    (state) => state.removeMediaFromChannel,
  );

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
    return sortMedia(
      media
        .filter((item) => filter === "all" || item.type === filter)
        .filter((item) => matchesSearch(item, query)),
    );
  }, [filter, media, query]);

  const totalDuration = useMemo(
    () =>
      filteredMedia.reduce(
        (sum, item) => sum + Math.max(0, Math.floor(item.duration)),
        0,
      ),
    [filteredMedia],
  );

  const typeCounts = useMemo(() => {
    return media.reduce<Record<MediaType, number>>(
      (acc, item) => {
        acc[item.type] += 1;
        return acc;
      },
      {
        show: 0,
        movie: 0,
        commercial: 0,
        bumper: 0,
      },
    );
  }, [media]);

  const handleDeleteClick = (item: MediaItem) => {
    if (pendingDeleteId !== item.id) {
      setPendingDeleteId(item.id);
      return;
    }

    removeMedia(item.id);
    setPendingDeleteId(null);
  };

  const openSource = (item: MediaItem) => {
    if (!isRemoteTestableUrl(item.file)) {
      return;
    }

    window.open(item.file, "_blank", "noopener,noreferrer");
  };

  return (
    <section
      className="rounded-2xl border p-3 sm:p-4"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div
            className="text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--primary)" }}
          >
            Library
          </div>

          <h2 className="mt-1 text-sm font-semibold tracking-wide">
            Media Manager
          </h2>

          <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
            Manage saved Cloudflare/R2 media metadata, commercial pools, slot
            settings, and channel assignments.
          </p>
        </div>

        <div
          className="rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
          style={{
            borderColor: "var(--border)",
            background: "var(--panel-alt-bg)",
            color: "var(--text-muted)",
          }}
        >
          {media.length} Items
        </div>
      </div>

      <div
        className="mb-3 grid gap-2 rounded-xl border p-3 sm:grid-cols-4"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
        }}
      >
        <div>
          <div className="text-lg font-black">{typeCounts.show}</div>
          <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            Shows
          </div>
        </div>

        <div>
          <div className="text-lg font-black">{typeCounts.movie}</div>
          <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            Movies
          </div>
        </div>

        <div>
          <div className="text-lg font-black">{typeCounts.commercial}</div>
          <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            Commercials
          </div>
        </div>

        <div>
          <div className="text-lg font-black">{typeCounts.bumper}</div>
          <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            Bumpers
          </div>
        </div>
      </div>

      <div className="mb-3 grid gap-2 lg:grid-cols-[1fr_auto]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title, URL, filename, provider, category..."
          className="w-full rounded-xl border px-3 py-3 text-base outline-none transition focus:ring-2 sm:text-sm"
          spellCheck={false}
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />

        <div className="flex gap-2 overflow-x-auto">
          {FILTER_OPTIONS.map((option) => {
            const active = filter === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className="shrink-0 rounded-xl border px-3 py-3 text-xs font-black uppercase tracking-[0.1em]"
                style={{
                  background: active ? "var(--primary)" : "var(--button-bg)",
                  borderColor: active ? "var(--primary)" : "var(--border)",
                  color: "var(--text)",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="mb-3 flex flex-wrap gap-2 text-[11px]"
        style={{ color: "var(--text-muted)" }}
      >
        <span>
          Showing {filteredMedia.length} of {media.length}
        </span>
        <span>•</span>
        <span>Total visible runtime: {formatDuration(totalDuration)}</span>
        <span>•</span>
        <span>
          Current channel: {getChannelLabel(currentChannel)} •{" "}
          {getChannelName(currentChannel)}
        </span>
      </div>

      <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
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
            const details = getBroadcastDetails(item);

            return (
              <article
                key={item.id}
                className="rounded-xl border p-3"
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor: isPendingDelete ? "#ef4444" : "var(--border)",
                }}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black" title={item.title}>
                      {item.title}
                    </div>

                    <div
                      className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <span>{getTypeLabel(item.type).toUpperCase()}</span>
                      <span>•</span>
                      <span>{formatDurationClock(item.duration)}</span>
                      <span>•</span>
                      <span>{getProviderLabel(item)}</span>
                      {item.mimeType ? (
                        <>
                          <span>•</span>
                          <span>{item.mimeType}</span>
                        </>
                      ) : null}
                    </div>

                    {details.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {details.map((detail) => (
                          <span
                            key={detail}
                            className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
                            style={{
                              borderColor: "var(--border)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {detail}
                          </span>
                        ))}
                      </div>
                    ) : null}

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
                                `${getChannelLabel(channel)} ${
                                  channel.branding?.callsign ?? ""
                                }`.trim(),
                            )
                            .join(", ")
                        : "None"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteClick(item)}
                    className="shrink-0 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90"
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
                  <div className="mt-2 rounded-lg border border-red-400/30 bg-red-950/30 px-3 py-2 text-[11px] text-red-200">
                    Click Confirm to permanently remove this media entry from all
                    channels. This does not delete the actual R2 file.
                  </div>
                ) : null}

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {!isAssignedToCurrent ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!currentChannel) return;

                        assignMediaToChannel(currentChannel.id, item.id);
                        setPendingDeleteId(null);
                      }}
                      disabled={!currentChannel}
                      className="rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
                        if (!currentChannel) return;

                        removeMediaFromChannel(currentChannel.id, item.id);
                        setPendingDeleteId(null);
                      }}
                      disabled={!currentChannel}
                      className="rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        background: "var(--button-bg)",
                        color: "var(--text)",
                      }}
                    >
                      Remove from {getChannelLabel(currentChannel)}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => openSource(item)}
                    disabled={!isRemoteTestableUrl(item.file)}
                    className="rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background: "var(--button-bg)",
                      color: "var(--text)",
                    }}
                  >
                    Test Source
                  </button>

                  {pendingDeleteId && pendingDeleteId !== item.id ? (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(null)}
                      className="rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90"
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