"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  formatBreakpoints,
  formatDuration,
  formatDurationClock,
} from "@/lib/mediaUtils";
import { useStore } from "@/lib/store";
import type { Channel, MediaItem, MediaType } from "@/lib/types";

type MediaFilter =
  | MediaType
  | "all"
  | "assigned"
  | "unassigned"
  | "embedded-ads";

type LibraryStat = {
  label: string;
  value: string | number;
  helper: string;
  tone?: "default" | "good" | "warn" | "danger";
};

const FILTER_OPTIONS: Array<{ value: MediaFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "show", label: "Shows" },
  { value: "movie", label: "Movies" },
  { value: "music", label: "Music" },
  { value: "music-video", label: "Music Videos" },
  { value: "commercial", label: "Commercials" },
  { value: "bumper", label: "Bumpers" },
  { value: "assigned", label: "Assigned" },
  { value: "unassigned", label: "Unassigned" },
  { value: "embedded-ads", label: "Embedded Ads" },
];

const MAX_LIBRARY_HEIGHT = 580;

function getChannelMediaIds(channel: Channel | undefined): string[] {
  if (!channel || !Array.isArray(channel.mediaIds)) {
    return [];
  }

  return channel.mediaIds;
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

  return channel.branding?.displayName?.trim() || channel.name || "Unnamed Channel";
}

function getProviderLabel(item: MediaItem): string {
  const file = item.file || "";
  const lowerFile = file.toLowerCase();

  if (item.provider === "cloudflare-r2") return "Cloudflare R2";
  if (item.provider === "external-url") return "External URL";
  if (item.provider === "local-dev") return "Local Dev";

  if (file.includes(".r2.dev") || lowerFile.includes("cloudflare")) {
    return "Cloudflare R2";
  }

  if (file.startsWith("https://")) return "Remote URL";
  if (file.startsWith("/")) return "Local Dev";

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
    item.airStartTime,
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

function isProgramItem(item: MediaItem): boolean {
  return (
    item.type === "show" ||
    item.type === "movie" ||
    item.type === "music" ||
    item.type === "music-video"
  );
}

function isAdInventoryItem(item: MediaItem): boolean {
  return item.type === "commercial" || item.type === "bumper";
}

function isPlayableMedia(item: MediaItem): boolean {
  return (
    item.file.trim().length > 0 &&
    Number.isFinite(Number(item.duration)) &&
    Number(item.duration) > 0
  );
}

function getTypeLabel(type: MediaType): string {
  if (type === "commercial") return "Commercial";
  if (type === "bumper") return "Bumper";
  if (type === "movie") return "Movie";
  if (type === "music") return "Music";
  if (type === "music-video") return "Music Video";

  return "Show";
}

function getBroadcastDetails(item: MediaItem): string[] {
  const details: string[] = [];

  if (isAdInventoryItem(item)) {
    details.push("Global Ad Inventory");
  }

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
    const typeCompare = a.type.localeCompare(b.type);

    if (typeCompare !== 0) {
      return typeCompare;
    }

    return a.title.localeCompare(b.title, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: 0,
  }).format(value);
}

function createAssignedChannelMap(
  media: MediaItem[],
  channels: Channel[],
): Map<string, Channel[]> {
  const map = new Map<string, Channel[]>();

  for (const item of media) {
    map.set(
      item.id,
      channels.filter((channel) => getChannelMediaIds(channel).includes(item.id)),
    );
  }

  return map;
}

function createTypeCounts(media: MediaItem[]): Record<MediaType, number> {
  return media.reduce<Record<MediaType, number>>(
    (acc, item) => {
      acc[item.type] += 1;
      return acc;
    },
    {
      show: 0,
      movie: 0,
      music: 0,
      "music-video": 0,
      commercial: 0,
      bumper: 0,
    },
  );
}

function filterMediaByMode(
  item: MediaItem,
  filter: MediaFilter,
  assignedChannels: Channel[],
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "assigned") {
    return assignedChannels.length > 0;
  }

  if (filter === "unassigned") {
    return assignedChannels.length === 0;
  }

  if (filter === "embedded-ads") {
    return isAdInventoryItem(item) && assignedChannels.length > 0;
  }

  return item.type === filter;
}

function getAssignedChannelText(assignedChannels: Channel[]): string {
  if (assignedChannels.length === 0) {
    return "None";
  }

  return assignedChannels
    .map((channel) =>
      `${getChannelLabel(channel)} ${channel.branding?.callsign ?? ""}`.trim(),
    )
    .join(", ");
}

function getStatStyles(tone: LibraryStat["tone"] = "default") {
  if (tone === "good") {
    return {
      borderColor: "rgba(34, 197, 94, 0.32)",
      background: "rgba(34, 197, 94, 0.08)",
      valueColor: "#86efac",
    };
  }

  if (tone === "warn") {
    return {
      borderColor: "rgba(250, 204, 21, 0.32)",
      background: "rgba(250, 204, 21, 0.08)",
      valueColor: "#fde68a",
    };
  }

  if (tone === "danger") {
    return {
      borderColor: "rgba(248, 113, 113, 0.35)",
      background: "rgba(248, 113, 113, 0.09)",
      valueColor: "#fecaca",
    };
  }

  return {
    borderColor: "var(--border)",
    background: "var(--panel-bg)",
    valueColor: "var(--text)",
  };
}

function StatCard({ stat }: { stat: LibraryStat }) {
  const styles = getStatStyles(stat.tone);

  return (
    <div
      className="rounded-2xl border p-3"
      style={{
        background: styles.background,
        borderColor: styles.borderColor,
      }}
    >
      <div className="text-lg font-black tracking-tight" style={{ color: styles.valueColor }}>
        {stat.value}
      </div>

      <div
        className="mt-1 text-[10px] font-black uppercase tracking-[0.14em]"
        style={{ color: "var(--text-muted)" }}
      >
        {stat.label}
      </div>

      <div
        className="mt-2 line-clamp-2 text-[11px] leading-4"
        style={{ color: "var(--text-muted)" }}
      >
        {stat.helper}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-2xl border px-3 py-8 text-center text-xs"
      style={{
        background: "var(--panel-alt-bg)",
        borderColor: "var(--border)",
        color: "var(--text-muted)",
      }}
    >
      {message}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  danger = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ttv-touch-target rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: danger ? "#7f1d1d" : "var(--button-bg)",
        color: danger ? "#fff" : "var(--text)",
      }}
    >
      {children}
    </button>
  );
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

  const assignedChannelMap = useMemo(
    () => createAssignedChannelMap(media, channels),
    [channels, media],
  );

  const filteredMedia = useMemo(() => {
    return sortMedia(
      media
        .filter((item) =>
          filterMediaByMode(
            item,
            filter,
            assignedChannelMap.get(item.id) ?? [],
          ),
        )
        .filter((item) => matchesSearch(item, query)),
    );
  }, [assignedChannelMap, filter, media, query]);

  const totalVisibleDuration = useMemo(
    () =>
      filteredMedia.reduce(
        (sum, item) => sum + Math.max(0, Math.floor(Number(item.duration) || 0)),
        0,
      ),
    [filteredMedia],
  );

  const typeCounts = useMemo(() => createTypeCounts(media), [media]);

  const assignedCount = useMemo(
    () =>
      media.filter((item) => (assignedChannelMap.get(item.id) ?? []).length > 0)
        .length,
    [assignedChannelMap, media],
  );

  const embeddedAdCount = useMemo(
    () =>
      media.filter(
        (item) =>
          isAdInventoryItem(item) &&
          (assignedChannelMap.get(item.id) ?? []).length > 0,
      ).length,
    [assignedChannelMap, media],
  );

  const playableProgramCount = useMemo(
    () => media.filter((item) => isProgramItem(item) && isPlayableMedia(item)).length,
    [media],
  );

  const playableAdCount = useMemo(
    () =>
      media.filter((item) => isAdInventoryItem(item) && isPlayableMedia(item)).length,
    [media],
  );

  const unassignedCount = Math.max(0, media.length - assignedCount);

  const currentChannelMediaCount = useMemo(() => {
    if (!currentChannel) {
      return 0;
    }

    const currentChannelMediaIds = getChannelMediaIds(currentChannel);

    return media.filter((item) => currentChannelMediaIds.includes(item.id)).length;
  }, [currentChannel, media]);

  const musicCount = typeCounts.music + typeCounts["music-video"];
  const adCount = typeCounts.commercial + typeCounts.bumper;

  const libraryStats = useMemo<LibraryStat[]>(
    () => [
      {
        label: "Total",
        value: formatCompactNumber(media.length),
        helper: "All saved media metadata records.",
        tone: media.length > 0 ? "good" : "warn",
      },
      {
        label: "Programs",
        value: formatCompactNumber(
          typeCounts.show + typeCounts.movie + musicCount,
        ),
        helper: `${formatCompactNumber(playableProgramCount)} playable show/movie/music item(s).`,
        tone: playableProgramCount > 0 ? "good" : "warn",
      },
      {
        label: "Movies",
        value: formatCompactNumber(typeCounts.movie),
        helper: "Movie-length long-form items.",
      },
      {
        label: "Music",
        value: formatCompactNumber(musicCount),
        helper: "Music and music-video inventory.",
      },
      {
        label: "Ads / Bumpers",
        value: formatCompactNumber(adCount),
        helper: `${formatCompactNumber(playableAdCount)} playable short-form ad item(s).`,
        tone: playableAdCount > 0 ? "good" : "warn",
      },
      {
        label: "Assigned",
        value: formatCompactNumber(assignedCount),
        helper: "Media attached to at least one channel.",
      },
      {
        label: "Embedded Ads",
        value: formatCompactNumber(embeddedAdCount),
        helper: "Commercials/bumpers inside playlists. Should be zero.",
        tone: embeddedAdCount === 0 ? "good" : "danger",
      },
    ],
    [
      adCount,
      assignedCount,
      embeddedAdCount,
      media.length,
      musicCount,
      playableAdCount,
      playableProgramCount,
      typeCounts.movie,
      typeCounts.show,
    ],
  );

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

  const clearSearch = () => {
    setQuery("");
    setPendingDeleteId(null);
  };

  const removeItemFromAllChannels = (item: MediaItem, assignedChannels: Channel[]) => {
    assignedChannels.forEach((channel) => {
      removeMediaFromChannel(channel.id, item.id);
    });

    setPendingDeleteId(null);
  };

  return (
    <section
      className="ttv-glass-panel rounded-2xl p-3 sm:p-4"
      style={{ color: "var(--text)" }}
    >
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div
            className="text-xs font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--primary)" }}
          >
            Library
          </div>

          <h2 className="mt-1 text-base font-black tracking-tight">
            Media Manager
          </h2>

          <p
            className="mt-1 max-w-3xl text-xs leading-5"
            style={{ color: "var(--text-muted)" }}
          >
            Manage saved Cloudflare/R2 media metadata, source testing, program
            assignments, and global ad inventory. Commercials and bumpers should
            not be added directly to channel playlists.
          </p>
        </div>

        <div
          className="w-fit rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
          style={{
            borderColor:
              embeddedAdCount > 0 ? "rgba(248, 113, 113, 0.45)" : "var(--border)",
            background:
              embeddedAdCount > 0
                ? "rgba(248, 113, 113, 0.10)"
                : "var(--panel-alt-bg)",
            color: embeddedAdCount > 0 ? "#fecaca" : "var(--text-muted)",
          }}
        >
          {formatCompactNumber(media.length)} Items
        </div>
      </div>

      <div
        className="mb-3 grid gap-2 rounded-2xl border p-3 sm:grid-cols-2 xl:grid-cols-7"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
        }}
      >
        {libraryStats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>

      <div className="mb-3 grid gap-2 lg:grid-cols-[1fr_auto]">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPendingDeleteId(null);
          }}
          placeholder="Search title, URL, filename, provider, category..."
          className="w-full rounded-xl border px-3 py-3 text-base outline-none transition focus:ring-2 sm:text-sm"
          spellCheck={false}
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />

        <div className="ttv-no-scrollbar flex max-w-full gap-2 overflow-x-auto">
          {FILTER_OPTIONS.map((option) => {
            const active = filter === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setFilter(option.value);
                  setPendingDeleteId(null);
                }}
                className="ttv-touch-target shrink-0 rounded-xl border px-3 py-3 text-xs font-black uppercase tracking-[0.1em]"
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
        className="mb-3 rounded-2xl border px-3 py-2 text-xs leading-5"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor:
            embeddedAdCount > 0 ? "rgba(250, 204, 21, 0.45)" : "var(--border)",
          color: "var(--text-muted)",
        }}
      >
        <div className="flex flex-wrap gap-2">
          <span>
            Showing {filteredMedia.length} of {media.length}
          </span>
          <span>•</span>
          <span>Total visible runtime: {formatDuration(totalVisibleDuration)}</span>
          <span>•</span>
          <span>
            Current channel: {getChannelLabel(currentChannel)} /{" "}
            {getChannelName(currentChannel)}
          </span>
          <span>•</span>
          <span>Current channel items: {currentChannelMediaCount}</span>
          <span>•</span>
          <span>Unassigned: {unassignedCount}</span>
          <span>•</span>
          <span>Embedded ads: {embeddedAdCount}</span>
        </div>

        {embeddedAdCount > 0 ? (
          <div className="mt-2 rounded-xl border border-yellow-300/30 bg-yellow-300/10 px-3 py-2 text-yellow-100">
            Some commercials/bumpers are assigned directly to channel playlists.
            Use the cleanup buttons on those items to keep ads as global
            inventory only.
          </div>
        ) : null}

        {query ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={clearSearch}
              className="rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em]"
              style={{
                borderColor: "var(--border)",
                background: "var(--button-bg)",
                color: "var(--text)",
              }}
            >
              Clear Search
            </button>
          </div>
        ) : null}
      </div>

      <div
        className="space-y-2 overflow-auto pr-1"
        style={{ maxHeight: MAX_LIBRARY_HEIGHT }}
      >
        {filteredMedia.length === 0 ? (
          <EmptyState message="No media found." />
        ) : (
          filteredMedia.map((item) => {
            const assignedChannels = assignedChannelMap.get(item.id) ?? [];
            const isAssignedToCurrent = assignedChannels.some(
              (channel) => channel.id === currentChannelId,
            );

            const isPendingDelete = pendingDeleteId === item.id;
            const details = getBroadcastDetails(item);
            const isAdInventory = isAdInventoryItem(item);
            const isEmbeddedAd = isAdInventory && assignedChannels.length > 0;
            const canAssignToCurrent = Boolean(currentChannel) && isProgramItem(item);

            return (
              <article
                key={item.id}
                className="rounded-2xl border p-3"
                style={{
                  background: isEmbeddedAd
                    ? "rgba(248, 113, 113, 0.08)"
                    : "var(--panel-alt-bg)",
                  borderColor: isPendingDelete
                    ? "#ef4444"
                    : isEmbeddedAd
                      ? "rgba(248, 113, 113, 0.35)"
                      : "var(--border)",
                }}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className="rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]"
                        style={{
                          borderColor: isAdInventory
                            ? "rgba(34, 197, 94, 0.35)"
                            : "var(--border)",
                          color: isAdInventory ? "#86efac" : "var(--text-muted)",
                        }}
                      >
                        {getTypeLabel(item.type)}
                      </div>

                      {isEmbeddedAd ? (
                        <div className="rounded-full border border-red-300/40 bg-red-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-red-100">
                          Embedded Ad
                        </div>
                      ) : null}

                      <div className="truncate text-sm font-black" title={item.title}>
                        {item.title}
                      </div>
                    </div>

                    <div
                      className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
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
                        {details.map((detail, detailIndex) => (
                          <span
                            key={`${detail}-${detailIndex}`}
                            className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
                            style={{
                              borderColor: isEmbeddedAd
                                ? "rgba(248, 113, 113, 0.35)"
                                : "var(--border)",
                              color: isEmbeddedAd ? "#fecaca" : "var(--text-muted)",
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
                      Channels: {getAssignedChannelText(assignedChannels)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteClick(item)}
                    className="ttv-touch-target shrink-0 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90"
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
                  <div className="mt-2 rounded-xl border border-red-400/30 bg-red-950/30 px-3 py-2 text-[11px] leading-5 text-red-200">
                    Click Confirm to permanently remove this media metadata from
                    every channel. This does not delete the actual R2 file.
                  </div>
                ) : null}

                {isAdInventory ? (
                  <div
                    className="mt-2 rounded-xl border px-3 py-2 text-[11px] leading-5"
                    style={{
                      background: isEmbeddedAd
                        ? "rgba(248, 113, 113, 0.10)"
                        : "rgba(34, 197, 94, 0.08)",
                      borderColor: isEmbeddedAd
                        ? "rgba(248, 113, 113, 0.30)"
                        : "rgba(34, 197, 94, 0.24)",
                      color: isEmbeddedAd ? "#fecaca" : "#bbf7d0",
                    }}
                  >
                    {isEmbeddedAd
                      ? "This ad/bump is currently inside a playlist. Remove it from playlists so the scheduler can insert it correctly."
                      : "This item is clean global ad inventory. It does not need to be added to channel playlists."}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {!isAssignedToCurrent && !isAdInventory ? (
                    <ActionButton
                      onClick={() => {
                        if (!currentChannel) return;

                        assignMediaToChannel(currentChannel.id, item.id);
                        setPendingDeleteId(null);
                      }}
                      disabled={!canAssignToCurrent}
                    >
                      Add to {getChannelLabel(currentChannel)}
                    </ActionButton>
                  ) : null}

                  {isAssignedToCurrent ? (
                    <ActionButton
                      onClick={() => {
                        if (!currentChannel) return;

                        removeMediaFromChannel(currentChannel.id, item.id);
                        setPendingDeleteId(null);
                      }}
                      disabled={!currentChannel}
                    >
                      Remove from {getChannelLabel(currentChannel)}
                    </ActionButton>
                  ) : null}

                  {isEmbeddedAd ? (
                    <ActionButton
                      danger
                      onClick={() => removeItemFromAllChannels(item, assignedChannels)}
                    >
                      Remove From All Playlists
                    </ActionButton>
                  ) : null}

                  <ActionButton
                    onClick={() => openSource(item)}
                    disabled={!isRemoteTestableUrl(item.file)}
                  >
                    Test Source
                  </ActionButton>

                  {isPendingDelete ? (
                    <ActionButton onClick={() => setPendingDeleteId(null)}>
                      Cancel Delete
                    </ActionButton>
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