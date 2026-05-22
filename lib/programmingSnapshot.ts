import type { AppMode, Channel, MediaItem, ThemeId } from "./types";
import { DEFAULT_THEME_ID, isThemeId } from "./themes";

export interface ProgrammingSnapshot {
  media: MediaItem[];
  channels: Channel[];
  currentChannelId: string;
  sidebarWidth: number;
  guideHeight: number;
  appMode: AppMode;
  themeId: ThemeId;
  ownedPremiumThemes: ThemeId[];
  updatedAt: string;
}

export interface ProgrammingApiResponse {
  ok: boolean;
  programming: ProgrammingSnapshot | null;
  source: "database" | "default" | "error";
  error?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidMediaItem(value: unknown): value is MediaItem {
  if (!isObject(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.file === "string" &&
    typeof value.duration === "number" &&
    value.duration > 0 &&
    ["show", "commercial", "movie", "bumper"].includes(String(value.type))
  );
}

function isValidChannel(value: unknown): value is Channel {
  if (!isObject(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.mediaIds) &&
    value.mediaIds.every((id) => typeof id === "string")
  );
}

function validAppMode(value: unknown): AppMode {
  return value === "admin" || value === "viewer" ? value : "viewer";
}

function validThemeId(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME_ID;
}

function validOwnedThemes(value: unknown): ThemeId[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(value.filter((item): item is ThemeId => isThemeId(item))),
  );
}

function validNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function sanitizeProgrammingSnapshot(
  value: unknown,
): ProgrammingSnapshot | null {
  if (!isObject(value)) return null;

  const media = Array.isArray(value.media)
    ? value.media.filter(isValidMediaItem)
    : [];

  const channels = Array.isArray(value.channels)
    ? value.channels.filter(isValidChannel)
    : [];

  if (media.length === 0 || channels.length === 0) {
    return null;
  }

  const currentChannelId =
    typeof value.currentChannelId === "string" &&
    channels.some((channel) => channel.id === value.currentChannelId)
      ? value.currentChannelId
      : channels[0]?.id ?? "1";

  return {
    media,
    channels,
    currentChannelId,
    sidebarWidth: validNumber(value.sidebarWidth, 420),
    guideHeight: validNumber(value.guideHeight, 290),
    appMode: validAppMode(value.appMode),
    themeId: validThemeId(value.themeId),
    ownedPremiumThemes: validOwnedThemes(value.ownedPremiumThemes),
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : new Date().toISOString(),
  };
}