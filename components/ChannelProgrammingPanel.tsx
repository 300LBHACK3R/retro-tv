"use client";

import { useMemo, useState } from "react";
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

  if (!cleanQuery) return true;

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

function getItemBadges(item: MediaItem): string[] {
  const badges: string[] = [];

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

function isTestableSource(file: string): boolean {
  return file.startsWith("https://") || file.startsWith("/");
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

  const [query, setQuery] = useState("");
  const [targetSlots, setTargetSlots] = useState<Record<string, string>>({});
  const [slotLengthInput, setSlotLengthInput] = useState("");
  const [message, setMessage] = useState(
    "Playback follows this channel configuration.",
  );

  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === currentChannelId),
    [channels, currentChannelId],
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

  const visibleItems = useMemo(
    () => programmedItems.filter((entry) => matchesQuery(entry, query)),
    [programmedItems, query],
  );

  const validProgrammedItems = useMemo(
    () => programmedItems.filter((entry) => entry.item),
    [programmedItems],
  );

  const missingProgrammedItems = useMemo(
    () => programmedItems.filter((entry) => !entry.item),
    [programmedItems],
  );

  const totalRuntime = useMemo(
    () =>
      validProgrammedItems.reduce(
        (sum, entry) => sum + Math.max(0, entry.item?.duration ?? 0),
        0,
      ),
    [validProgrammedItems],
  );

  const showCount = useMemo(
    () => validProgrammedItems.filter((entry) => entry.item?.type === "show").length,
    [validProgrammedItems],
  );

  const commercialCount = useMemo(
    () =>
      validProgrammedItems.filter(
        (entry) =>
          entry.item?.type === "commercial" || entry.item?.type === "bumper",
      ).length,
    [validProgrammedItems],
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

    setMessage(`Default slot length set to ${formatDurationClock(parsed)}.`);
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
            Programming
          </div>

          <h2 className="mt-1 text-sm font-semibold tracking-wide">
            Channel Programming
          </h2>

          <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
            Control order, randomization, commercial behaviour, slot defaults,
            and the exact playlist for this channel.
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
          {activeChannel
            ? `${getChannelLabel(activeChannel)} • ${programmedItems.length} Slots`
            : "No Channel"}
        </div>
      </div>

      {activeChannel ? (
        <div
          className="mb-3 grid gap-3 rounded-xl border p-3 lg:grid-cols-4"
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
              className="w-full rounded-lg border px-3 py-3 text-base sm:text-sm"
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
              className="w-full rounded-lg border px-3 py-3 text-base sm:text-sm"
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
              className="w-full rounded-lg border px-3 py-3 text-base sm:text-sm"
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
              className="w-full rounded-lg border px-3 py-3 text-base sm:text-sm"
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

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
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
                className="w-full rounded-lg border px-3 py-3 text-base outline-none sm:text-sm"
                style={{
                  background: "var(--panel-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              />

              <button
                type="button"
                onClick={applyDefaultSlotLength}
                className="rounded-lg px-4 py-3 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90"
                style={{
                  background: "var(--button-bg)",
                  color: "var(--text)",
                }}
              >
                Apply Default
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
        className="mb-3 grid gap-2 rounded-xl border p-3 sm:grid-cols-4"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
        }}
      >
        <div>
          <div className="text-lg font-black">{programmedItems.length}</div>
          <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            Slots
          </div>
        </div>

        <div>
          <div className="text-lg font-black">{showCount}</div>
          <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            Shows
          </div>
        </div>

        <div>
          <div className="text-lg font-black">{commercialCount}</div>
          <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            Ads/Bumpers
          </div>
        </div>

        <div>
          <div className="text-lg font-black">{formatDuration(totalRuntime)}</div>
          <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            Runtime
          </div>
        </div>
      </div>

      <div
        className="mb-3 rounded-xl border px-3 py-2"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {getChannelLabel(activeChannel)} • {getChannelName(activeChannel)}
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
            <div>Total runtime</div>
            <div className="font-semibold" style={{ color: "var(--text)" }}>
              {formatDuration(totalRuntime)}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-3 grid gap-2 lg:grid-cols-[1fr_auto_auto]">
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
            setMessage("Search cleared.");
          }}
          className="rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.1em] transition hover:opacity-90"
          style={{
            background: "var(--button-bg)",
            color: "var(--text)",
          }}
        >
          Clear Search
        </button>

        <button
          type="button"
          onClick={clearChannel}
          disabled={!activeChannel || programmedItems.length === 0}
          className="rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.1em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: "#7f1d1d",
            color: "#fff",
          }}
        >
          Clear Channel
        </button>
      </div>

      <div
        className="mb-3 rounded-xl border px-3 py-2 text-xs leading-5"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
          color: "var(--text-muted)",
        }}
      >
        <div className="flex flex-wrap gap-2">
          <span>Visible: {visibleItems.length}</span>
          <span>•</span>
          <span>Total slots: {programmedItems.length}</span>
          <span>•</span>
          <span>Playable: {validProgrammedItems.length}</span>
          <span>•</span>
          <span>Missing: {missingProgrammedItems.length}</span>
        </div>

        <div className="mt-1" style={{ color: "var(--text-muted)" }}>
          {message}
        </div>
      </div>

      <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
        {!activeChannel ? (
          <EmptyState message="No active channel selected." />
        ) : programmedItems.length === 0 ? (
          <EmptyState message="No programmed items for this channel yet." />
        ) : visibleItems.length === 0 ? (
          <EmptyState message="No playlist items match your search." />
        ) : (
          visibleItems.map(({ mediaId, item, index }) => {
            const isFirst = index === 0;
            const isLast = index === programmedItems.length - 1;
            const targetSlotValue = targetSlots[mediaId] ?? String(index + 1);

            if (!item) {
              return (
                <article
                  key={`${mediaId}-${index}`}
                  className="rounded-xl border p-3"
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
                    <button
                      type="button"
                      onClick={() => {
                        removeMediaFromChannel(currentChannelId, mediaId);
                        setMessage(`Removed missing slot ${index + 1}.`);
                      }}
                      className="rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90"
                      style={{
                        background: "#7f1d1d",
                        color: "#fff",
                      }}
                    >
                      Remove Missing Slot
                    </button>
                  </div>
                </article>
              );
            }

            const badges = getItemBadges(item);

            return (
              <article
                key={`${item.id}-${index}`}
                className="rounded-xl border p-3"
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor: "var(--border)",
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

                      <div
                        className="truncate text-sm font-semibold"
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
                        {badges.map((badge) => (
                          <span
                            key={badge}
                            className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
                            style={{
                              borderColor: "var(--border)",
                              color: "var(--text-muted)",
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
                    <button
                      type="button"
                      onClick={() => {
                        moveMediaInChannel(currentChannelId, index, 0);
                        setMessage(`Moved slot ${index + 1} to the top.`);
                      }}
                      disabled={isFirst}
                      className="rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        background: "var(--button-bg)",
                        color: "var(--text)",
                      }}
                    >
                      Top
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        moveMediaInChannel(currentChannelId, index, index - 1);
                        setMessage(`Moved slot ${index + 1} up.`);
                      }}
                      disabled={isFirst}
                      className="rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        background: "var(--button-bg)",
                        color: "var(--text)",
                      }}
                    >
                      Up
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        moveMediaInChannel(currentChannelId, index, index + 1);
                        setMessage(`Moved slot ${index + 1} down.`);
                      }}
                      disabled={isLast}
                      className="rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        background: "var(--button-bg)",
                        color: "var(--text)",
                      }}
                    >
                      Down
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        moveMediaInChannel(
                          currentChannelId,
                          index,
                          programmedItems.length - 1,
                        );
                        setMessage(`Moved slot ${index + 1} to the bottom.`);
                      }}
                      disabled={isLast}
                      className="rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        background: "var(--button-bg)",
                        color: "var(--text)",
                      }}
                    >
                      Bottom
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (isTestableSource(item.file)) {
                          window.open(item.file, "_blank", "noopener,noreferrer");
                        }
                      }}
                      disabled={!isTestableSource(item.file)}
                      className="rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        background: "var(--button-bg)",
                        color: "var(--text)",
                      }}
                    >
                      Test
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        removeMediaFromChannel(currentChannelId, item.id);
                        setMessage(`Removed "${item.title}" from channel.`);
                      }}
                      className="rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90"
                      style={{
                        background: "#7f1d1d",
                        color: "#fff",
                      }}
                    >
                      Remove
                    </button>
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
                          [mediaId]: event.target.value.replace(/\D/g, ""),
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

                    <button
                      type="button"
                      onClick={() => moveToSlot(index, targetSlotValue)}
                      className="rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition hover:opacity-90"
                      style={{
                        background: "var(--button-bg)",
                        color: "var(--text)",
                      }}
                    >
                      Go
                    </button>
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

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border px-3 py-6 text-center text-xs"
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