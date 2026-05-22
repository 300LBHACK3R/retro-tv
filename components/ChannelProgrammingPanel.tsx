"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import type { Channel, MediaItem } from "@/lib/types";

type ProgrammedItem = {
  mediaId: string;
  item: MediaItem | null;
  index: number;
};

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
    return "No Channel";
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

export default function ChannelProgrammingPanel() {
  const media = useStore((state) => state.media);
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const removeMediaFromChannel = useStore((state) => state.removeMediaFromChannel);
  const moveMediaInChannel = useStore((state) => state.moveMediaInChannel);

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
          <h2 className="text-sm font-semibold tracking-wide">
            Channel Programming
          </h2>

          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Reorder or remove media assigned to the active channel.
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
          {activeChannel
            ? `${getChannelLabel(activeChannel)} • ${programmedItems.length} Slots`
            : "No Channel"}
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

            <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {activeChannel?.branding?.callsign ?? activeChannel?.name ?? "No callsign"}
            </div>
          </div>

          <div className="text-right text-[11px]" style={{ color: "var(--text-muted)" }}>
            <div>Total runtime</div>
            <div className="font-semibold" style={{ color: "var(--text)" }}>
              {prettyDuration(totalRuntime)}
            </div>
          </div>
        </div>
      </div>

      {missingProgrammedItems.length > 0 ? (
        <div
          className="mb-3 rounded-xl border px-3 py-2 text-xs"
          style={{
            borderColor: "rgba(248, 113, 113, 0.35)",
            background: "rgba(248, 113, 113, 0.08)",
            color: "#fca5a5",
          }}
        >
          {missingProgrammedItems.length} assigned media reference
          {missingProgrammedItems.length === 1 ? "" : "s"} could not be found.
          Remove the missing slot entries below to clean this channel.
        </div>
      ) : null}

      <div className="max-h-[380px] space-y-2 overflow-auto pr-1">
        {!activeChannel ? (
          <EmptyState message="No active channel selected." />
        ) : programmedItems.length === 0 ? (
          <EmptyState message="No programmed items for this channel yet." />
        ) : (
          programmedItems.map(({ mediaId, item, index }) => {
            const isFirst = index === 0;
            const isLast = index === programmedItems.length - 1;

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
                      onClick={() => removeMediaFromChannel(currentChannelId, mediaId)}
                      className="rounded-lg px-2 py-1 text-xs font-semibold transition hover:opacity-90"
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
                  </div>

                  <div
                    className="shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-muted)",
                    }}
                  >
                    Slot {index + 1}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => moveMediaInChannel(currentChannelId, index, index - 1)}
                    disabled={isFirst}
                    className="rounded-lg px-2 py-1 text-xs font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      background: "var(--button-bg)",
                      color: "var(--text)",
                    }}
                  >
                    Move Up
                  </button>

                  <button
                    type="button"
                    onClick={() => moveMediaInChannel(currentChannelId, index, index + 1)}
                    disabled={isLast}
                    className="rounded-lg px-2 py-1 text-xs font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      background: "var(--button-bg)",
                      color: "var(--text)",
                    }}
                  >
                    Move Down
                  </button>

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

                  <button
                    type="button"
                    onClick={() => removeMediaFromChannel(currentChannelId, item.id)}
                    className="rounded-lg px-2 py-1 text-xs font-semibold transition hover:opacity-90"
                    style={{
                      background: "#7f1d1d",
                      color: "#fff",
                    }}
                  >
                    Remove from Channel
                  </button>
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