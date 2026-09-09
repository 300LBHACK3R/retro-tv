import { cleanDisplayText } from "./textClean";
import type { Channel, MediaItem, PlayerViewMode } from "./types";

const DEFAULT_CHANNEL_ACCENT = "#37d8ff";

export function getMediaForChannel(
  channel: Channel | undefined,
  mediaById: ReadonlyMap<string, MediaItem>,
): MediaItem[] {
  if (!channel) {
    return [];
  }

  return channel.mediaIds
    .map((mediaId) => mediaById.get(mediaId))
    .filter((item): item is MediaItem => Boolean(item));
}

export function isCommercialInventoryItem(item: MediaItem): boolean {
  return item.type === "commercial" || item.type === "bumper";
}

export function createBroadcastDayAnchor(now = new Date()): Date {
  const anchor = new Date(now);
  anchor.setHours(0, 0, 0, 0);
  return anchor;
}

export function sortEnabledChannels(channels: readonly Channel[]): Channel[] {
  return [...channels]
    .filter((channel) => channel.isEnabled !== false)
    .sort((a, b) => {
      const aNumber = Number(a.number ?? a.id);
      const bNumber = Number(b.number ?? b.id);

      if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
        return aNumber - bNumber;
      }

      return String(a.id).localeCompare(String(b.id));
    });
}

export function getChannelNumber(channel: Channel | undefined): string {
  return channel ? String(channel.number ?? channel.id) : "--";
}

export function getChannelLabel(channel: Channel | undefined): string {
  return `CH ${getChannelNumber(channel)}`;
}

export function findChannelByNumber(
  channels: readonly Channel[],
  value: string,
): Channel | undefined {
  const normalizedValue = value.trim().replace(/^0+/, "") || "0";

  return channels.find((channel) => {
    const normalizedChannelNumber = getChannelNumber(channel).replace(
      /^0+/,
      "",
    ) || "0";

    return normalizedChannelNumber === normalizedValue;
  });
}

export function getChannelDisplayName(channel: Channel | undefined): string {
  if (!channel) {
    return "No channel selected";
  }

  return cleanDisplayText(
    channel.branding?.displayName || channel.name || "Tate's TV",
  );
}

export function getChannelCallsign(channel: Channel | undefined): string {
  if (!channel) {
    return "TTV";
  }

  return cleanDisplayText(
    channel.branding?.callsign || channel.name || "TTV",
  );
}

export function getChannelDescription(channel: Channel | undefined): string {
  return cleanDisplayText(
    channel?.branding?.description ||
      "Always-on scheduled programming from Tate's TV.",
  );
}

export function getChannelAccent(channel: Channel | undefined): string {
  const accent = channel?.branding?.accentColor?.trim();

  return accent && /^#[0-9a-f]{6}$/i.test(accent)
    ? accent
    : DEFAULT_CHANNEL_ACCENT;
}

export function getChannelLogoUrl(channel: Channel | undefined): string | undefined {
  const logoUrl = channel?.branding?.logoUrl?.trim();

  if (!logoUrl) {
    return undefined;
  }

  if (
    logoUrl.startsWith("/") ||
    logoUrl.startsWith("data:image/") ||
    /^https?:\/\//i.test(logoUrl)
  ) {
    return logoUrl;
  }

  return undefined;
}

export function getPlayerFrameClass(
  playerViewMode: PlayerViewMode,
  tvMode: boolean,
): string {
  if (tvMode) {
    return [
      "ttv-tv-player-frame",
      "ttv-premium-player-frame",
      "relative aspect-video w-full overflow-hidden border bg-black",
    ].join(" ");
  }

  if (playerViewMode === "mini") {
    return [
      "ttv-premium-player-frame",
      "ttv-premium-player-mini",
      "fixed bottom-3 right-3 z-[70] aspect-video",
      "w-[min(440px,calc(100vw-24px))] overflow-hidden border bg-black",
    ].join(" ");
  }

  if (playerViewMode === "theater") {
    return [
      "ttv-premium-player-frame",
      "ttv-premium-player-theater",
      "relative aspect-video w-full overflow-hidden border bg-black",
    ].join(" ");
  }

  return [
    "ttv-premium-player-frame",
    "relative aspect-video w-full overflow-hidden border bg-black",
  ].join(" ");
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}
