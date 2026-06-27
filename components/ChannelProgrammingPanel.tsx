"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  formatBreakpoints,
  formatDuration,
  formatDurationClock,
  parseManualDuration,
} from "@/lib/mediaUtils";
import { useStore } from "@/lib/store";
import type {
  Channel,
  CommercialBreakMode,
  CommercialStrategy,
  MediaItem,
  ScheduleMode,
} from "@/lib/types";

type ProgrammedItem = {
  mediaId: string;
  item: MediaItem | null;
  index: number;
};

type PlaylistStat = {
  label: string;
  value: string | number;
  helper: string;
  tone?: "default" | "good" | "warn" | "danger";
};

type PlaylistFilter = "all" | "programs" | "embedded-ads" | "missing" | "duplicates";

const MAX_PLAYLIST_HEIGHT = 620;

function getChannelLabel(channel: Channel | undefined): string {
  if (!channel) {
    return "CH --";
  }

  return `CH ${channel.number ?? channel.id}`;
}

function getChannelName(channel: Channel | undefined): string {
  if (!channel) {
    return "No Channel";
  }

  return channel.branding?.displayName ?? channel.name;
}

function sortChannels(channels: Channel[]): Channel[] {
  return [...channels].sort((a, b) => {
    const aNumber = Number(a.number ?? a.id);
    const bNumber = Number(b.number ?? b.id);

    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
      return aNumber - bNumber;
    }

    return String(a.id).localeCompare(String(b.id), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function getChannelOptionLabel(channel: Channel): string {
  return `${getChannelLabel(channel)} / ${getChannelName(channel)}`;
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

function matchesQuery(entry: ProgrammedItem, query: string): boolean {
  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) {
    return true;
  }

  if (!entry.item) {
    return entry.mediaId.toLowerCase().includes(cleanQuery);
  }

  return [
    entry.item.title,
    entry.item.type,
    entry.item.file,
    entry.item.originalName,
    entry.item.description,
    entry.item.provider,
    entry.item.mimeType,
    entry.item.commercialCategory,
    entry.item.airStartTime,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(cleanQuery));
}

function isTestableSource(file: string): boolean {
  return file.startsWith("https://") || file.startsWith("/");
}

function isProgramItem(item: MediaItem | null): boolean {
  return (
    item?.type === "show" ||
    item?.type === "movie" ||
    item?.type === "music" ||
    item?.type === "music-video"
  );
}

function isEmbeddedAdItem(item: MediaItem | null): boolean {
  return item?.type === "commercial" || item?.type === "bumper";
}

function hasPlayableSource(item: MediaItem | null): boolean {
  return Boolean(
    item &&
      item.file.trim().length > 0 &&
      Number.isFinite(Number(item.duration)) &&
      Number(item.duration) > 0,
  );
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: 0,
  }).format(value);
}

function createDuplicateMediaIdSet(programmedItems: ProgrammedItem[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  programmedItems.forEach((entry) => {
    if (seen.has(entry.mediaId)) {
      duplicates.add(entry.mediaId);
      return;
    }

    seen.add(entry.mediaId);
  });

  return duplicates;
}

function matchesFilter(
  entry: ProgrammedItem,
  filter: PlaylistFilter,
  duplicateMediaIds: Set<string>,
): boolean {
  if (filter === "all") return true;
  if (filter === "programs") return isProgramItem(entry.item);
  if (filter === "embedded-ads") return isEmbeddedAdItem(entry.item);
  if (filter === "missing") return !entry.item;
  if (filter === "duplicates") return duplicateMediaIds.has(entry.mediaId);

  return true;
}

function getItemBadges(item: MediaItem): string[] {
  const badges: string[] = [];

  if (isEmbeddedAdItem(item)) {
    badges.push("Embedded Ad - Clean Up");
  }

  if (item.slotLengthSeconds) {
    badges.push(`Slot ${formatDurationClock(item.slotLengthSeconds)}`);
  }

  if (item.breakpoints && item.breakpoints.length > 0) {
    badges.push(`Breaks ${formatBreakpoints(item.breakpoints)}`);
  }

  if (item.breakDurations && item.breakDurations.length > 0) {
    badges.push(`Ads ${formatBreakpoints(item.breakDurations)}`);
  }

  if (item.fillSlotWithCommercials) {
    badges.push("Auto filler");
  }

  if (item.commercialStrategy) {
    badges.push(item.commercialStrategy);
  }

  if (item.airDays && item.airDays.length > 0) {
    badges.push(item.airDays.map((day) => day.slice(0, 3)).join(", "));
  }

  if (item.airStartTime) {
    badges.push(item.airStartTime);
  }

  if (item.commercialCategory) {
    badges.push(item.commercialCategory);
  }

  if (item.allowCommercialSlicing) {
    badges.push("Slice");
  }

  return badges;
}

function createPlaylistStats({
  programmedItems,
  visibleItems,
  validProgrammedItems,
  missingProgrammedItems,
  duplicateSlotCount,
  programCount,
  embeddedAdCount,
  playableProgramCount,
  totalProgramRuntime,
}: {
  programmedItems: ProgrammedItem[];
  visibleItems: ProgrammedItem[];
  validProgrammedItems: ProgrammedItem[];
  missingProgrammedItems: ProgrammedItem[];
  duplicateSlotCount: number;
  programCount: number;
  embeddedAdCount: number;
  playableProgramCount: number;
  totalProgramRuntime: number;
}): PlaylistStat[] {
  return [
    {
      label: "Slots",
      value: formatCompactNumber(programmedItems.length),
      helper: "Total channel playlist entries.",
      tone: programmedItems.length > 0 ? "good" : "warn",
    },
    {
      label: "Visible",
      value: formatCompactNumber(visibleItems.length),
      helper: "Items currently matching search/filter.",
    },
    {
      label: "Programs",
      value: formatCompactNumber(programCount),
      helper: `${formatCompactNumber(playableProgramCount)} playable program item(s).`,
      tone: programCount > 0 ? "good" : "warn",
    },
    {
      label: "Embedded Ads",
      value: formatCompactNumber(embeddedAdCount),
      helper: "Commercials/bumpers directly inside this playlist. Should be zero.",
      tone: embeddedAdCount === 0 ? "good" : "danger",
    },
    {
      label: "Missing",
      value: formatCompactNumber(missingProgrammedItems.length),
      helper: "Slots pointing to deleted media.",
      tone: missingProgrammedItems.length === 0 ? "good" : "danger",
    },
    {
      label: "Duplicates",
      value: formatCompactNumber(duplicateSlotCount),
      helper: "Repeated media IDs inside this channel.",
      tone: duplicateSlotCount === 0 ? "good" : "warn",
    },
    {
      label: "Runtime",
      value: formatDuration(totalProgramRuntime),
      helper: "Program runtime only, excluding embedded ads.",
      tone: validProgrammedItems.length > 0 ? "default" : "warn",
    },
  ];
}

function getStatStyles(tone: PlaylistStat["tone"] = "default") {
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

function StatCard({ stat }: { stat: PlaylistStat }) {
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
      className="ttv-touch-target rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        background: danger ? "#7f1d1d" : "var(--button-bg)",
        color: danger ? "#fff" : "var(--text)",
      }}
    >
      {children}
    </button>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ttv-touch-target rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90"
      style={{
        background: active
          ? "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 58%, transparent))"
          : "var(--button-bg)",
        borderColor: active ? "var(--primary)" : "var(--border)",
        color: "var(--text)",
      }}
    >
      {label}
    </button>
  );
}

export default function ChannelProgrammingPanel() {
  const media = useStore((state) => state.media);
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const removeMediaFromChannel = useStore(
    (state) => state.removeMediaFromChannel,
  );
  const moveMediaInChannel = useStore((state) => state.moveMediaInChannel);
  const clearChannelMedia = useStore((state) => state.clearChannelMedia);
  const updateChannelSettings = useStore((state) => state.updateChannelSettings);

  const [selectedChannelId, setSelectedChannelId] = useState(currentChannelId);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PlaylistFilter>("all");
  const [targetSlots, setTargetSlots] = useState<Record<string, string>>({});
  const [slotLengthInput, setSlotLengthInput] = useState("");
  const [message, setMessage] = useState(
    "Playback follows this channel configuration.",
  );

  useEffect(() => {
    setSelectedChannelId(currentChannelId);
  }, [currentChannelId]);

  const sortedChannels = useMemo(() => sortChannels(channels), [channels]);

  const activeChannel = useMemo(
    () =>
      sortedChannels.find((channel) => channel.id === selectedChannelId) ??
      sortedChannels.find((channel) => channel.id === currentChannelId) ??
      sortedChannels[0],
    [currentChannelId, selectedChannelId, sortedChannels],
  );

  const mediaById = useMemo(() => {
    return new Map(media.map((item) => [item.id, item]));
  }, [media]);

  const programmedItems = useMemo<ProgrammedItem[]>(() => {
    if (!activeChannel) {
      return [];
    }

    return activeChannel.mediaIds.map((mediaId, index) => ({
      mediaId,
      item: mediaById.get(mediaId) ?? null,
      index,
    }));
  }, [activeChannel, mediaById]);

  const duplicateMediaIds = useMemo(
    () => createDuplicateMediaIdSet(programmedItems),
    [programmedItems],
  );

  const duplicateSlotCount = useMemo(
    () =>
      programmedItems.filter((entry) => duplicateMediaIds.has(entry.mediaId))
        .length,
    [duplicateMediaIds, programmedItems],
  );

  const visibleItems = useMemo(
    () =>
      programmedItems.filter(
        (entry) =>
          matchesQuery(entry, query) &&
          matchesFilter(entry, filter, duplicateMediaIds),
      ),
    [duplicateMediaIds, filter, programmedItems, query],
  );

  const validProgrammedItems = useMemo(
    () => programmedItems.filter((entry) => entry.item),
    [programmedItems],
  );

  const missingProgrammedItems = useMemo(
    () => programmedItems.filter((entry) => !entry.item),
    [programmedItems],
  );

  const embeddedAdItems = useMemo(
    () => programmedItems.filter((entry) => isEmbeddedAdItem(entry.item)),
    [programmedItems],
  );

  const programItems = useMemo(
    () => programmedItems.filter((entry) => isProgramItem(entry.item)),
    [programmedItems],
  );

  const playableProgramCount = useMemo(
    () => programItems.filter((entry) => hasPlayableSource(entry.item)).length,
    [programItems],
  );

  const totalProgramRuntime = useMemo(
    () =>
      programItems.reduce(
        (sum, entry) => sum + Math.max(0, entry.item?.duration ?? 0),
        0,
      ),
    [programItems],
  );

  const playlistStats = useMemo(
    () =>
      createPlaylistStats({
        programmedItems,
        visibleItems,
        validProgrammedItems,
        missingProgrammedItems,
        duplicateSlotCount,
        programCount: programItems.length,
        embeddedAdCount: embeddedAdItems.length,
        playableProgramCount,
        totalProgramRuntime,
      }),
    [
      duplicateSlotCount,
      embeddedAdItems.length,
      missingProgrammedItems,
      playableProgramCount,
      programItems.length,
      programmedItems,
      totalProgramRuntime,
      validProgrammedItems,
      visibleItems,
    ],
  );

  const moveToSlot = (fromIndex: number, slotValue: string) => {
    if (!activeChannel) {
      setMessage("No active channel selected.");
      return;
    }

    const nextSlot = Number(slotValue);

    if (!Number.isInteger(nextSlot)) {
      setMessage("Enter a valid slot number.");
      return;
    }

    const toIndex = nextSlot - 1;

    if (toIndex < 0 || toIndex >= programmedItems.length) {
      setMessage(`Slot must be between 1 and ${programmedItems.length}.`);
      return;
    }

    if (fromIndex === toIndex) {
      setMessage("That item is already in that slot.");
      return;
    }

    moveMediaInChannel(activeChannel.id, fromIndex, toIndex);
    setTargetSlots({});
    setMessage(`Moved item from slot ${fromIndex + 1} to slot ${nextSlot}.`);
  };

  const clearChannel = () => {
    if (!activeChannel) return;

    const confirmed = window.confirm(
      `Clear all programmed media from ${getChannelLabel(
        activeChannel,
      )}? This does not delete media from the library.`,
    );

    if (!confirmed) return;

    clearChannelMedia(activeChannel.id);
    setTargetSlots({});
    setMessage(`Cleared all programming from ${getChannelLabel(activeChannel)}.`);
  };

  const removeMissingSlots = () => {
    if (!activeChannel || missingProgrammedItems.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${missingProgrammedItems.length} missing slot(s) from ${getChannelLabel(
        activeChannel,
      )}?`,
    );

    if (!confirmed) return;

    missingProgrammedItems.forEach((entry) => {
      removeMediaFromChannel(activeChannel.id, entry.mediaId);
    });

    setTargetSlots({});
    setMessage(`Removed ${missingProgrammedItems.length} missing slot(s).`);
  };

  const removeEmbeddedAds = () => {
    if (!activeChannel || embeddedAdItems.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${embeddedAdItems.length} embedded ad/bumpers from ${getChannelLabel(
        activeChannel,
      )}? This keeps the media in the library and only removes it from this playlist.`,
    );

    if (!confirmed) return;

    Array.from(new Set(embeddedAdItems.map((entry) => entry.mediaId))).forEach(
      (mediaId) => {
        removeMediaFromChannel(activeChannel.id, mediaId);
      },
    );

    setTargetSlots({});
    setFilter("all");
    setMessage(
      `Removed ${embeddedAdItems.length} embedded ad/bumpers from ${getChannelLabel(
        activeChannel,
      )}.`,
    );
  };

  const applyDefaultSlotLength = () => {
    if (!activeChannel) {
      setMessage("No active channel selected.");
      return;
    }

    const parsed = parseManualDuration(slotLengthInput, "seconds");

    if (parsed <= 0) {
      setMessage("Enter a valid default slot length. Example: 30:00.");
      return;
    }

    updateChannelSettings(activeChannel.id, {
      defaultSlotLengthSeconds: parsed,
    });

    setSlotLengthInput("");
    setMessage(`Default slot length set to ${formatDurationClock(parsed)}.`);
  };

  const clearDefaultSlotLength = () => {
    if (!activeChannel) {
      setMessage("No active channel selected.");
      return;
    }

    updateChannelSettings(activeChannel.id, {
      defaultSlotLengthSeconds: undefined,
    });

    setSlotLengthInput("");
    setMessage("Default slot length cleared.");
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
            Programming
          </div>

          <h2 className="mt-1 text-base font-black tracking-tight">
            Channel Programming
          </h2>

          <p
            className="mt-1 max-w-3xl text-xs leading-5"
            style={{ color: "var(--text-muted)" }}
          >
            Control playlist order, randomization, commercial behavior, default
            slot length, and release-safe channel hygiene. Commercials should
            stay in global ad inventory, not inside channel playlists.
          </p>
        </div>

        <div
          className="w-fit rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
          style={{
            borderColor:
              embeddedAdItems.length > 0
                ? "rgba(248, 113, 113, 0.45)"
                : "var(--border)",
            background:
              embeddedAdItems.length > 0
                ? "rgba(248, 113, 113, 0.10)"
                : "var(--panel-alt-bg)",
            color: embeddedAdItems.length > 0 ? "#fecaca" : "var(--text-muted)",
          }}
        >
          {activeChannel
            ? `${getChannelLabel(activeChannel)} / ${programmedItems.length} Slots`
            : "No Channel"}
        </div>
      </div>

      <div
        className="mb-3 rounded-2xl border p-3"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
        }}
      >
        <label
          htmlFor="programming-channel"
          className="mb-1 block text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Edit Channel Playlist
        </label>

        <select
          id="programming-channel"
          value={activeChannel?.id ?? ""}
          onChange={(event) => {
            setSelectedChannelId(event.target.value);
            setQuery("");
            setFilter("all");
            setTargetSlots({});
            setMessage("Channel playlist selected.");
          }}
          className="w-full rounded-xl border px-3 py-3 text-base sm:text-sm"
          style={{
            background: "var(--panel-bg)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        >
          {sortedChannels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {getChannelOptionLabel(channel)}
            </option>
          ))}
        </select>
      </div>

      {activeChannel ? (
        <div
          className="mb-3 grid gap-3 rounded-2xl border p-3 lg:grid-cols-4"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
          }}
        >
          <div>
            <label
              className="mb-1 block text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Schedule Mode
            </label>

            <select
              value={activeChannel.scheduleMode ?? "ordered"}
              onChange={(event) => {
                updateChannelSettings(activeChannel.id, {
                  scheduleMode: event.target.value as ScheduleMode,
                });
                setMessage("Schedule mode updated. Global sync will save it.");
              }}
              className="w-full rounded-xl border px-3 py-3 text-base sm:text-sm"
              style={{
                background: "var(--panel-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            >
              <option value="ordered">Ordered Playlist</option>
              <option value="daily-random">Daily Random</option>
            </select>
          </div>

          <div>
            <label
              className="mb-1 block text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Automatic Breaks
            </label>

            <select
              value={activeChannel.commercialBreakMode ?? "none"}
              onChange={(event) => {
                updateChannelSettings(activeChannel.id, {
                  commercialBreakMode: event.target.value as CommercialBreakMode,
                });
                setMessage("Commercial break mode updated. Global sync will save it.");
              }}
              className="w-full rounded-xl border px-3 py-3 text-base sm:text-sm"
              style={{
                background: "var(--panel-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            >
              <option value="none">No Automatic Breaks</option>
              <option value="end-only">End Breaks Only</option>
              <option value="midpoint-and-end">Midpoint + End Breaks</option>
              <option value="classic-tv">Classic TV Breaks</option>
            </select>
          </div>

          <div>
            <label
              className="mb-1 block text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Commercial Strategy
            </label>

            <select
              value={activeChannel.commercialStrategy ?? "best-fit"}
              onChange={(event) => {
                updateChannelSettings(activeChannel.id, {
                  commercialStrategy: event.target.value as CommercialStrategy,
                });
                setMessage("Commercial strategy updated.");
              }}
              className="w-full rounded-xl border px-3 py-3 text-base sm:text-sm"
              style={{
                background: "var(--panel-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            >
              <option value="best-fit">Best Fit</option>
              <option value="sequential">Sequential</option>
              <option value="random">Random</option>
            </select>
          </div>

          <div>
            <label
              className="mb-1 block text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Random Seed
            </label>

            <input
              value={activeChannel.randomSeed ?? `channel-${activeChannel.id}`}
              onChange={(event) => {
                updateChannelSettings(activeChannel.id, {
                  randomSeed: event.target.value,
                });
                setMessage("Random seed updated. Global sync will save it.");
              }}
              className="w-full rounded-xl border px-3 py-3 text-base sm:text-sm"
              style={{
                background: "var(--panel-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
          </div>

          <div className="lg:col-span-4">
            <label
              className="mb-1 block text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Channel Default Slot Length
            </label>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <input
                value={slotLengthInput}
                onChange={(event) =>
                  setSlotLengthInput(event.target.value.replace(/[^\d:.]/g, ""))
                }
                placeholder={
                  activeChannel.defaultSlotLengthSeconds
                    ? formatDurationClock(activeChannel.defaultSlotLengthSeconds)
                    : "30:00"
                }
                className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                style={{
                  background: "var(--panel-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              />

              <button
                type="button"
                onClick={applyDefaultSlotLength}
                className="ttv-action-button ttv-touch-target rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.1em]"
              >
                Apply Default
              </button>

              <button
                type="button"
                onClick={clearDefaultSlotLength}
                disabled={!activeChannel.defaultSlotLengthSeconds}
                className="ttv-action-button ttv-touch-target rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.1em] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear Default
              </button>
            </div>

            <div
              className="mt-1 text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              Current default:{" "}
              {activeChannel.defaultSlotLengthSeconds
                ? formatDurationClock(activeChannel.defaultSlotLengthSeconds)
                : "none"}
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="mb-3 grid gap-2 rounded-2xl border p-3 sm:grid-cols-2 xl:grid-cols-7"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
        }}
      >
        {playlistStats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>

      <div
        className="mb-3 rounded-2xl border px-3 py-3"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor:
            embeddedAdItems.length > 0
              ? "rgba(248, 113, 113, 0.45)"
              : "var(--border)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-black">
              {getChannelLabel(activeChannel)} / {getChannelName(activeChannel)}
            </div>

            <div
              className="mt-1 text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              {activeChannel?.branding?.callsign ??
                activeChannel?.name ??
                "No callsign"}
            </div>
          </div>

          <div
            className="text-right text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            <div>Program runtime</div>
            <div className="font-black" style={{ color: "var(--text)" }}>
              {formatDuration(totalProgramRuntime)}
            </div>
          </div>
        </div>

        {embeddedAdItems.length > 0 ? (
          <div className="mt-3 rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-100">
            This channel has {embeddedAdItems.length} commercial/bumper item(s)
            directly in its playlist. Remove them from the playlist and keep
            them as global ad inventory.
          </div>
        ) : null}
      </div>

      <div className="mb-3 grid gap-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search this channel playlist..."
          className="w-full rounded-xl border px-3 py-3 text-base outline-none transition focus:ring-2 sm:text-sm"
          spellCheck={false}
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />

        <button
          type="button"
          onClick={() => {
            setQuery("");
            setFilter("all");
            setMessage("Search and filters cleared.");
          }}
          className="ttv-action-button ttv-touch-target rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.1em]"
        >
          Clear Search
        </button>

        <button
          type="button"
          onClick={removeEmbeddedAds}
          disabled={!activeChannel || embeddedAdItems.length === 0}
          className="ttv-touch-target rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.1em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: "#7f1d1d",
            color: "#fff",
          }}
        >
          Remove Embedded Ads
        </button>

        <button
          type="button"
          onClick={removeMissingSlots}
          disabled={!activeChannel || missingProgrammedItems.length === 0}
          className="ttv-action-button ttv-touch-target rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.1em] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Remove Missing
        </button>

        <button
          type="button"
          onClick={clearChannel}
          disabled={!activeChannel || programmedItems.length === 0}
          className="ttv-touch-target rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.1em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: "#7f1d1d",
            color: "#fff",
          }}
        >
          Clear Channel
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <FilterButton
          label="All"
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <FilterButton
          label="Programs"
          active={filter === "programs"}
          onClick={() => setFilter("programs")}
        />
        <FilterButton
          label="Embedded Ads"
          active={filter === "embedded-ads"}
          onClick={() => setFilter("embedded-ads")}
        />
        <FilterButton
          label="Missing"
          active={filter === "missing"}
          onClick={() => setFilter("missing")}
        />
        <FilterButton
          label="Duplicates"
          active={filter === "duplicates"}
          onClick={() => setFilter("duplicates")}
        />
      </div>

      <div
        className="mb-3 rounded-2xl border px-3 py-2 text-xs leading-5"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor:
            missingProgrammedItems.length > 0 ||
            duplicateSlotCount > 0 ||
            embeddedAdItems.length > 0
              ? "rgba(250, 204, 21, 0.45)"
              : "var(--border)",
          color: "var(--text-muted)",
        }}
      >
        <div className="flex flex-wrap gap-2">
          <span>Visible: {visibleItems.length}</span>
          <span>•</span>
          <span>Total slots: {programmedItems.length}</span>
          <span>•</span>
          <span>Programs: {programItems.length}</span>
          <span>•</span>
          <span>Embedded ads: {embeddedAdItems.length}</span>
          <span>•</span>
          <span>Missing: {missingProgrammedItems.length}</span>
          <span>•</span>
          <span>Duplicates: {duplicateSlotCount}</span>
        </div>

        <div className="mt-1" style={{ color: "var(--text-muted)" }}>
          {message}
        </div>
      </div>

      <div
        className="space-y-2 overflow-auto pr-1"
        style={{ maxHeight: MAX_PLAYLIST_HEIGHT }}
      >
        {!activeChannel ? (
          <EmptyState message="No active channel selected." />
        ) : programmedItems.length === 0 ? (
          <EmptyState message="No programmed items for this channel yet." />
        ) : visibleItems.length === 0 ? (
          <EmptyState message="No playlist items match your search/filter." />
        ) : (
          visibleItems.map(({ mediaId, item, index }) => {
            const isFirst = index === 0;
            const isLast = index === programmedItems.length - 1;
            const slotKey = `${mediaId}-${index}`;
            const targetSlotValue = targetSlots[slotKey] ?? String(index + 1);
            const isDuplicateSlot = duplicateMediaIds.has(mediaId);
            const isEmbeddedAd = isEmbeddedAdItem(item);

            if (!item) {
              return (
                <article
                  key={`${mediaId}-${index}`}
                  className="rounded-2xl border p-3"
                  style={{
                    background: "rgba(248, 113, 113, 0.08)",
                    borderColor: "rgba(248, 113, 113, 0.35)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-red-200">
                        Missing Media
                      </div>

                      <div className="mt-1 truncate text-[11px] text-red-200/75">
                        ID: {mediaId}
                      </div>
                    </div>

                    <div className="text-[11px] text-red-200/75">
                      Slot {index + 1}
                    </div>
                  </div>

                  <div className="mt-3">
                    <ActionButton
                      danger
                      onClick={() => {
                        if (!activeChannel) return;

                        removeMediaFromChannel(activeChannel.id, mediaId);
                        setMessage(`Removed missing slot ${index + 1}.`);
                      }}
                    >
                      Remove Missing Slot
                    </ActionButton>
                  </div>
                </article>
              );
            }

            const badges = getItemBadges(item);

            return (
              <article
                key={`${item.id}-${index}`}
                className="rounded-2xl border p-3"
                style={{
                  background: isEmbeddedAd
                    ? "rgba(248, 113, 113, 0.08)"
                    : isDuplicateSlot
                      ? "rgba(250, 204, 21, 0.08)"
                      : "var(--panel-alt-bg)",
                  borderColor: isEmbeddedAd
                    ? "rgba(248, 113, 113, 0.35)"
                    : isDuplicateSlot
                      ? "rgba(250, 204, 21, 0.35)"
                      : "var(--border)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className="rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]"
                        style={{
                          borderColor: "var(--border)",
                          color: "var(--text-muted)",
                        }}
                      >
                        Slot {index + 1}
                      </div>

                      {isEmbeddedAd ? (
                        <div className="rounded-full border border-red-300/40 bg-red-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-red-100">
                          Embedded Ad
                        </div>
                      ) : null}

                      {isDuplicateSlot ? (
                        <div className="rounded-full border border-yellow-300/40 bg-yellow-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-yellow-100">
                          Duplicate
                        </div>
                      ) : null}

                      <div
                        className="truncate text-sm font-black"
                        title={item.title}
                      >
                        {item.title}
                      </div>
                    </div>

                    <div
                      className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <span>{item.type.toUpperCase()}</span>
                      <span>•</span>
                      <span>{formatDurationClock(item.duration)}</span>
                      <span>•</span>
                      <span>{getProviderLabel(item)}</span>
                    </div>

                    {badges.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {badges.map((badge, badgeIndex) => (
                          <span
                            key={`${badge}-${badgeIndex}`}
                            className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
                            style={{
                              borderColor: isEmbeddedAd
                                ? "rgba(248, 113, 113, 0.35)"
                                : "var(--border)",
                              color: isEmbeddedAd ? "#fecaca" : "var(--text-muted)",
                            }}
                          >
                            {badge}
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
                  </div>
                </div>

                <div className="mt-3 grid gap-2 xl:grid-cols-[1fr_auto]">
                  <div className="flex flex-wrap gap-2">
                    <ActionButton
                      onClick={() => {
                        if (!activeChannel) return;

                        moveMediaInChannel(activeChannel.id, index, 0);
                        setMessage(`Moved slot ${index + 1} to the top.`);
                      }}
                      disabled={isFirst}
                    >
                      Top
                    </ActionButton>

                    <ActionButton
                      onClick={() => {
                        if (!activeChannel) return;

                        moveMediaInChannel(activeChannel.id, index, index - 1);
                        setMessage(`Moved slot ${index + 1} up.`);
                      }}
                      disabled={isFirst}
                    >
                      Up
                    </ActionButton>

                    <ActionButton
                      onClick={() => {
                        if (!activeChannel) return;

                        moveMediaInChannel(activeChannel.id, index, index + 1);
                        setMessage(`Moved slot ${index + 1} down.`);
                      }}
                      disabled={isLast}
                    >
                      Down
                    </ActionButton>

                    <ActionButton
                      onClick={() => {
                        if (!activeChannel) return;

                        moveMediaInChannel(
                          activeChannel.id,
                          index,
                          programmedItems.length - 1,
                        );
                        setMessage(`Moved slot ${index + 1} to the bottom.`);
                      }}
                      disabled={isLast}
                    >
                      Bottom
                    </ActionButton>

                    <ActionButton
                      onClick={() => {
                        if (isTestableSource(item.file)) {
                          window.open(item.file, "_blank", "noopener,noreferrer");
                        }
                      }}
                      disabled={!isTestableSource(item.file)}
                    >
                      Test
                    </ActionButton>

                    <ActionButton
                      danger
                      onClick={() => {
                        if (!activeChannel) return;

                        removeMediaFromChannel(activeChannel.id, item.id);
                        setMessage(
                          isEmbeddedAd
                            ? `Removed embedded ad "${item.title}" from channel playlist.`
                            : `Removed "${item.title}" from channel.`,
                        );
                      }}
                    >
                      {isEmbeddedAd ? "Remove Embedded Ad" : "Remove"}
                    </ActionButton>
                  </div>

                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={`jump-slot-${item.id}-${index}`}
                      className="text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Move to
                    </label>

                    <input
                      id={`jump-slot-${item.id}-${index}`}
                      value={targetSlotValue}
                      inputMode="numeric"
                      onChange={(event) =>
                        setTargetSlots((current) => ({
                          ...current,
                          [slotKey]: event.target.value.replace(/\D/g, ""),
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          moveToSlot(index, targetSlotValue);
                        }
                      }}
                      className="w-16 rounded-lg border px-2 py-2 text-xs outline-none"
                      style={{
                        background: "var(--panel-bg)",
                        borderColor: "var(--border)",
                        color: "var(--text)",
                      }}
                    />

                    <ActionButton onClick={() => moveToSlot(index, targetSlotValue)}>
                      Go
                    </ActionButton>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}