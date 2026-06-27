"use client";

import { useEffect, useMemo, useState } from "react";
import ChannelBrandingPanel from "@/components/ChannelBrandingPanel";
import ChannelProgrammingPanel from "@/components/ChannelProgrammingPanel";
import MediaLibraryPanel from "@/components/MediaLibraryPanel";
import QuickMediaEditorPanel from "@/components/QuickMediaEditorPanel";
import StationConfigPanel from "@/components/StationConfigPanel";
import UploadPanel from "@/components/UploadPanel";
import { useStore } from "@/lib/store";
import type { Channel, MediaItem } from "@/lib/types";

type AdminTab =
  | "quick-edit"
  | "add"
  | "programming"
  | "branding"
  | "library"
  | "config"
  | "launch";

type AdminTabMeta = {
  id: AdminTab;
  label: string;
  shortLabel: string;
  description: string;
};

type DashboardStat = {
  label: string;
  value: string | number;
  helper: string;
  tone?: "default" | "good" | "warn" | "danger";
};

type LaunchCheck = {
  label: string;
  status: "pass" | "warn";
  helper: string;
};

const ADMIN_TAB_STORAGE_KEY = "tatestv:admin-dashboard-tab:v1";
const REQUIRED_LAUNCH_CHANNEL_COUNT = 23;

const TABS: AdminTabMeta[] = [
  {
    id: "quick-edit",
    label: "Quick Edit",
    shortLabel: "Edit",
    description: "Edit titles, runtimes, types, air days, and safe channel assignments.",
  },
  {
    id: "add",
    label: "Add Media",
    shortLabel: "Add",
    description: "Add one media item from a public R2 or video URL.",
  },
  {
    id: "programming",
    label: "Playlist",
    shortLabel: "Playlist",
    description: "Reorder channel lineups and tune schedule/ad behavior.",
  },
  {
    id: "branding",
    label: "Branding",
    shortLabel: "Brand",
    description: "Edit channel identity, callsign, color, logo, and overlay details.",
  },
  {
    id: "library",
    label: "Library",
    shortLabel: "Library",
    description: "Manage all saved media metadata and channel assignments.",
  },
  {
    id: "config",
    label: "Config",
    shortLabel: "Config",
    description: "Export, import, backup, and restore station programming.",
  },
  {
    id: "launch",
    label: "Launch Check",
    shortLabel: "Launch",
    description: "Run the station readiness checklist before release.",
  },
];

function isAdminTab(value: string | null): value is AdminTab {
  return Boolean(value && TABS.some((tab) => tab.id === value));
}

function getInitialAdminTab(): AdminTab {
  if (typeof window === "undefined") {
    return "quick-edit";
  }

  try {
    const savedTab = window.localStorage.getItem(ADMIN_TAB_STORAGE_KEY);
    return isAdminTab(savedTab) ? savedTab : "quick-edit";
  } catch {
    return "quick-edit";
  }
}

function getChannelSortValue(channel: Pick<Channel, "id" | "number">): number {
  const value = Number(channel.number ?? channel.id);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function sortChannels(channels: Channel[]): Channel[] {
  return [...channels].sort((a, b) => {
    const aNumber = getChannelSortValue(a);
    const bNumber = getChannelSortValue(b);

    if (aNumber !== bNumber) {
      return aNumber - bNumber;
    }

    return String(a.id).localeCompare(String(b.id), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function getChannelLabel(channel: Pick<Channel, "id" | "number"> | undefined): string {
  if (!channel) {
    return "No Channel";
  }

  return `CH ${channel.number ?? channel.id}`;
}

function getChannelName(
  channel: Pick<Channel, "name" | "branding"> | undefined,
): string {
  if (!channel) {
    return "No active channel selected";
  }

  return channel.branding?.displayName ?? channel.name;
}

function isAdItem(item: MediaItem | undefined): boolean {
  return item?.type === "commercial" || item?.type === "bumper";
}

function isProgramItem(item: MediaItem | undefined): boolean {
  return (
    item?.type === "show" ||
    item?.type === "movie" ||
    item?.type === "music" ||
    item?.type === "music-video"
  );
}

function isPlayableMedia(item: MediaItem | undefined): boolean {
  return Boolean(
    item &&
      typeof item.file === "string" &&
      item.file.trim().length > 0 &&
      Number.isFinite(Number(item.duration)) &&
      Number(item.duration) > 0,
  );
}

function getMediaTypeCount(media: MediaItem[], types: MediaItem["type"][]): number {
  const typeSet = new Set(types);
  return media.filter((item) => typeSet.has(item.type)).length;
}

function createMediaById(media: MediaItem[]): Map<string, MediaItem> {
  return new Map(media.map((item) => [item.id, item]));
}

function createAssignedMediaSet(channels: Pick<Channel, "mediaIds">[]): Set<string> {
  const assigned = new Set<string>();

  channels.forEach((channel) => {
    channel.mediaIds.forEach((mediaId) => assigned.add(mediaId));
  });

  return assigned;
}

function countChannelPrograms(channel: Channel | undefined, mediaById: Map<string, MediaItem>): number {
  if (!channel) {
    return 0;
  }

  return channel.mediaIds.filter((mediaId) => isProgramItem(mediaById.get(mediaId))).length;
}

function countChannelAds(channel: Channel | undefined, mediaById: Map<string, MediaItem>): number {
  if (!channel) {
    return 0;
  }

  return channel.mediaIds.filter((mediaId) => isAdItem(mediaById.get(mediaId))).length;
}

function countMissingChannelItems(
  channel: Channel | undefined,
  mediaById: Map<string, MediaItem>,
): number {
  if (!channel) {
    return 0;
  }

  return channel.mediaIds.filter((mediaId) => !mediaById.has(mediaId)).length;
}

function countChannelsWithPrograms(channels: Channel[], mediaById: Map<string, MediaItem>): number {
  return channels.filter((channel) => countChannelPrograms(channel, mediaById) > 0).length;
}

function countChannelsWithEmbeddedAds(channels: Channel[], mediaById: Map<string, MediaItem>): number {
  return channels.filter((channel) => countChannelAds(channel, mediaById) > 0).length;
}

function countChannelsWithMissingMedia(channels: Channel[], mediaById: Map<string, MediaItem>): number {
  return channels.filter((channel) => countMissingChannelItems(channel, mediaById) > 0).length;
}

function countPlayablePrograms(media: MediaItem[]): number {
  return media.filter((item) => isProgramItem(item) && isPlayableMedia(item)).length;
}

function countPlayableAds(media: MediaItem[]): number {
  return media.filter((item) => isAdItem(item) && isPlayableMedia(item)).length;
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: 0,
  }).format(value);
}

function getStatCardStyles(tone: DashboardStat["tone"] = "default") {
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
      borderColor: "rgba(248, 113, 113, 0.32)",
      background: "rgba(248, 113, 113, 0.08)",
      valueColor: "#fca5a5",
    };
  }

  return {
    borderColor: "var(--border)",
    background: "var(--panel-alt-bg)",
    valueColor: "var(--text)",
  };
}

function getLaunchCheckStyles(status: LaunchCheck["status"]) {
  if (status === "pass") {
    return {
      borderColor: "rgba(34, 197, 94, 0.35)",
      background: "rgba(34, 197, 94, 0.10)",
      color: "#86efac",
    };
  }

  return {
    borderColor: "rgba(250, 204, 21, 0.35)",
    background: "rgba(250, 204, 21, 0.10)",
    color: "#fde68a",
  };
}

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: AdminTabMeta;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "ttv-touch-target shrink-0 scroll-mx-3 rounded-2xl border px-3 py-3 text-left transition",
        "hover:scale-[1.01] hover:opacity-95",
        "sm:min-w-[9rem] sm:px-4",
      ].join(" ")}
      style={{
        background: active
          ? "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 58%, transparent))"
          : "var(--button-bg)",
        borderColor: active ? "var(--primary)" : "var(--border)",
        color: "var(--text)",
        boxShadow: active
          ? "0 0 28px color-mix(in srgb, var(--primary) 22%, transparent)"
          : "none",
      }}
      title={tab.description}
      aria-pressed={active}
    >
      <div className="text-xs font-black uppercase tracking-[0.1em] sm:hidden">
        {tab.shortLabel}
      </div>

      <div className="hidden text-xs font-black uppercase tracking-[0.1em] sm:block">
        {tab.label}
      </div>

      <div
        className="mt-1 hidden text-[11px] leading-4 xl:line-clamp-2"
        style={{ color: active ? "inherit" : "var(--text-muted)" }}
      >
        {tab.description}
      </div>
    </button>
  );
}

function StatCard({ stat }: { stat: DashboardStat }) {
  const styles = getStatCardStyles(stat.tone);

  return (
    <div
      className="rounded-2xl border p-3"
      style={{
        background: styles.background,
        borderColor: styles.borderColor,
      }}
    >
      <div className="text-xl font-black tracking-tight" style={{ color: styles.valueColor }}>
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

function LaunchReadinessPanel({
  checks,
  activeChannelLabel,
  activeChannelName,
}: {
  checks: LaunchCheck[];
  activeChannelLabel: string;
  activeChannelName: string;
}) {
  const passCount = checks.filter((check) => check.status === "pass").length;
  const warnCount = checks.length - passCount;

  return (
    <section
      className="ttv-glass-panel-strong rounded-2xl p-4 shadow-2xl shadow-black/20"
      style={{ color: "var(--text)" }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div
            className="text-xs font-black uppercase tracking-[0.2em]"
            style={{ color: "var(--primary)" }}
          >
            Launch Readiness
          </div>

          <h3 className="mt-1 text-lg font-black tracking-tight">
            Station Preflight
          </h3>

          <p
            className="mt-1 max-w-2xl text-xs leading-5"
            style={{ color: "var(--text-muted)" }}
          >
            Release check for the live-TV engine, 23-channel lineup, programming
            coverage, commercial inventory, playlist hygiene, and backup safety.
          </p>
        </div>

        <div
          className="rounded-2xl border px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em]"
          style={{
            borderColor: "var(--border)",
            background: "var(--panel-alt-bg)",
            color: "var(--text-muted)",
          }}
        >
          <span style={{ color: "var(--primary)" }}>{passCount} pass</span>
          <span className="mx-2 opacity-50">/</span>
          <span>{warnCount} review</span>
        </div>
      </div>

      <div
        className="mt-4 rounded-2xl border px-3 py-3 text-xs leading-5"
        style={{
          borderColor: "var(--border)",
          background: "var(--panel-alt-bg)",
          color: "var(--text-muted)",
        }}
      >
        Active Channel:{" "}
        <span className="font-black" style={{ color: "var(--primary)" }}>
          {activeChannelLabel}
        </span>{" "}
        <span className="opacity-60">/</span>{" "}
        <span style={{ color: "var(--text)" }}>{activeChannelName}</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {checks.map((check) => (
          <div
            key={check.label}
            className="rounded-2xl border p-3"
            style={getLaunchCheckStyles(check.status)}
          >
            <div className="text-xs font-black uppercase tracking-[0.14em]">
              {check.status === "pass" ? "Ready" : "Review"}
            </div>

            <div className="mt-2 text-sm font-black" style={{ color: "var(--text)" }}>
              {check.label}
            </div>

            <div className="mt-2 text-xs leading-5 opacity-85">
              {check.helper}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>(getInitialAdminTab);

  const media = useStore((state) => state.media);
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const sidebarWidth = useStore((state) => state.sidebarWidth);
  const guideHeight = useStore((state) => state.guideHeight);
  const appMode = useStore((state) => state.appMode);
  const themeId = useStore((state) => state.themeId);
  const ownedPremiumThemes = useStore((state) => state.ownedPremiumThemes);

  useEffect(() => {
    try {
      window.localStorage.setItem(ADMIN_TAB_STORAGE_KEY, activeTab);
    } catch {
      // Local UI preference only.
    }
  }, [activeTab]);

  const sortedChannels = useMemo(() => sortChannels(channels), [channels]);

  const enabledChannels = useMemo(
    () => sortedChannels.filter((channel) => channel.isEnabled !== false),
    [sortedChannels],
  );

  const mediaById = useMemo(() => createMediaById(media), [media]);

  const activeChannel = useMemo(
    () =>
      channels.find((channel) => channel.id === currentChannelId) ??
      enabledChannels[0],
    [channels, currentChannelId, enabledChannels],
  );

  const activeTabMeta = useMemo<AdminTabMeta>(() => {
    return TABS.find((tab) => tab.id === activeTab) ?? TABS[0]!;
  }, [activeTab]);

  const assignedMediaSet = useMemo(
    () => createAssignedMediaSet(channels),
    [channels],
  );

  const assignedCount = useMemo(
    () => media.filter((item) => assignedMediaSet.has(item.id)).length,
    [assignedMediaSet, media],
  );

  const unassignedCount = useMemo(
    () => Math.max(0, media.length - assignedCount),
    [assignedCount, media.length],
  );

  const enabledChannelCount = enabledChannels.length;
  const programInventoryCount = getMediaTypeCount(media, [
    "show",
    "movie",
    "music",
    "music-video",
  ]);
  const playableProgramCount = countPlayablePrograms(media);
  const adInventoryCount = getMediaTypeCount(media, ["commercial", "bumper"]);
  const playableAdCount = countPlayableAds(media);
  const musicCount = getMediaTypeCount(media, ["music", "music-video"]);

  const activeChannelProgramCount = countChannelPrograms(activeChannel, mediaById);
  const activeChannelEmbeddedAdCount = countChannelAds(activeChannel, mediaById);
  const activeChannelMissingCount = countMissingChannelItems(activeChannel, mediaById);

  const channelsWithPrograms = countChannelsWithPrograms(enabledChannels, mediaById);
  const channelsWithEmbeddedAds = countChannelsWithEmbeddedAds(enabledChannels, mediaById);
  const channelsWithMissingMedia = countChannelsWithMissingMedia(enabledChannels, mediaById);

  const dashboardStats = useMemo<DashboardStat[]>(() => {
    return [
      {
        label: "Media Items",
        value: formatCompactNumber(media.length),
        helper: "Total saved videos, shows, movies, music, ads, and bumpers.",
        tone: media.length > 0 ? "good" : "warn",
      },
      {
        label: "Programs",
        value: formatCompactNumber(programInventoryCount),
        helper: `${formatCompactNumber(playableProgramCount)} playable long-form items.`,
        tone: playableProgramCount > 0 ? "good" : "warn",
      },
      {
        label: "Music",
        value: formatCompactNumber(musicCount),
        helper: "Music and music-video inventory for The Pulse, Amplify, and worship channels.",
        tone: musicCount > 0 ? "good" : "default",
      },
      {
        label: "Ads / Bumpers",
        value: formatCompactNumber(adInventoryCount),
        helper: `${formatCompactNumber(playableAdCount)} playable short-form ad item(s).`,
        tone: playableAdCount > 0 ? "good" : "warn",
      },
      {
        label: "Enabled Channels",
        value: `${formatCompactNumber(enabledChannelCount)}/${REQUIRED_LAUNCH_CHANNEL_COUNT}`,
        helper: "Public channels available to viewers.",
        tone:
          enabledChannelCount >= REQUIRED_LAUNCH_CHANNEL_COUNT
            ? "good"
            : enabledChannelCount > 0
              ? "warn"
              : "danger",
      },
      {
        label: "Embedded Ads",
        value: formatCompactNumber(channelsWithEmbeddedAds),
        helper: "Channels with commercials directly in mediaIds. Should be zero.",
        tone: channelsWithEmbeddedAds === 0 ? "good" : "danger",
      },
    ];
  }, [
    adInventoryCount,
    channelsWithEmbeddedAds,
    enabledChannelCount,
    media.length,
    musicCount,
    playableAdCount,
    playableProgramCount,
    programInventoryCount,
  ]);

  const launchChecks = useMemo<LaunchCheck[]>(() => {
    return [
      {
        label: "23-Channel Lineup",
        status:
          enabledChannelCount >= REQUIRED_LAUNCH_CHANNEL_COUNT ? "pass" : "warn",
        helper:
          enabledChannelCount >= REQUIRED_LAUNCH_CHANNEL_COUNT
            ? "All 23 launch channels are enabled."
            : `Only ${formatCompactNumber(
                enabledChannelCount,
              )}/${REQUIRED_LAUNCH_CHANNEL_COUNT} channels are enabled.`,
      },
      {
        label: "Every Channel Has Programs",
        status:
          enabledChannelCount > 0 && channelsWithPrograms === enabledChannelCount
            ? "pass"
            : "warn",
        helper:
          enabledChannelCount > 0 && channelsWithPrograms === enabledChannelCount
            ? "Every enabled channel has at least one normal program item."
            : `${formatCompactNumber(
                channelsWithPrograms,
              )}/${formatCompactNumber(enabledChannelCount)} enabled channels have programs.`,
      },
      {
        label: "Commercial Inventory",
        status: playableAdCount > 0 ? "pass" : "warn",
        helper:
          playableAdCount > 0
            ? `${formatCompactNumber(playableAdCount)} playable ad/bumpers available for breaks.`
            : "Add at least one playable commercial or bumper.",
      },
      {
        label: "Commercials Not In Playlists",
        status: channelsWithEmbeddedAds === 0 ? "pass" : "warn",
        helper:
          channelsWithEmbeddedAds === 0
            ? "Commercials are clean inventory, not normal channel episodes."
            : `${formatCompactNumber(
                channelsWithEmbeddedAds,
              )} channel(s) still have ads directly in mediaIds.`,
      },
      {
        label: "No Missing Playlist Items",
        status: channelsWithMissingMedia === 0 ? "pass" : "warn",
        helper:
          channelsWithMissingMedia === 0
            ? "All channel mediaIds resolve to saved media records."
            : `${formatCompactNumber(
                channelsWithMissingMedia,
              )} channel(s) reference missing media.`,
      },
      {
        label: "Active Channel Playback",
        status:
          Boolean(activeChannel) &&
          activeChannelProgramCount > 0 &&
          activeChannelMissingCount === 0
            ? "pass"
            : "warn",
        helper:
          Boolean(activeChannel) && activeChannelProgramCount > 0
            ? `${getChannelLabel(activeChannel)} has ${formatCompactNumber(
                activeChannelProgramCount,
              )} program item(s) and ${formatCompactNumber(
                activeChannelEmbeddedAdCount,
              )} embedded ad item(s).`
            : "Select a channel with at least one playable program.",
      },
      {
        label: "Station Backup",
        status: media.length > 0 && channels.length > 0 ? "pass" : "warn",
        helper: "Export Station Config after every major upload, cleanup, or branding pass.",
      },
    ];
  }, [
    activeChannel,
    activeChannelEmbeddedAdCount,
    activeChannelMissingCount,
    activeChannelProgramCount,
    channels.length,
    channelsWithEmbeddedAds,
    channelsWithMissingMedia,
    channelsWithPrograms,
    enabledChannelCount,
    media.length,
    playableAdCount,
  ]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <section
        className="ttv-glass-panel-strong relative overflow-hidden rounded-2xl p-3 shadow-2xl shadow-black/20 sm:p-4"
        style={{
          color: "var(--text)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--primary)" }}
          aria-hidden="true"
        />

        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--primary), transparent)",
          }}
          aria-hidden="true"
        />

        <div className="relative mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div
              className="text-xs font-black uppercase tracking-[0.2em]"
              style={{ color: "var(--primary)" }}
            >
              Admin Control Center
            </div>

            <h2 className="mt-1 text-xl font-black tracking-tight">
              Station Management
            </h2>

            <p
              className="mt-1 max-w-3xl text-xs leading-5"
              style={{ color: "var(--text-muted)" }}
            >
              Manage uploads, bulk imports, playlists, commercial inventory,
              music channels, channel branding, media assignments, backups, and
              launch readiness from one protected control surface.
            </p>
          </div>

          <div
            className="max-w-full rounded-2xl border px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em]"
            style={{
              borderColor: "var(--border)",
              background: "var(--panel-alt-bg)",
              color: "var(--text-muted)",
            }}
            title={`${getChannelLabel(activeChannel)} â€¢ ${getChannelName(
              activeChannel,
            )}`}
          >
            <span style={{ color: "var(--primary)" }}>
              {getChannelLabel(activeChannel)}
            </span>{" "}
            <span className="opacity-60">/</span>{" "}
            <span className="inline-block max-w-[16rem] truncate align-bottom">
              {getChannelName(activeChannel)}
            </span>
          </div>
        </div>

        <div className="relative mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {dashboardStats.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </div>

        <div className="relative">
          <div className="ttv-no-scrollbar flex snap-x gap-2 overflow-x-auto pb-1">
            {TABS.map((tab) => (
              <TabButton
                key={tab.id}
                tab={tab}
                active={tab.id === activeTab}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </div>

          <div
            className="mt-3 rounded-2xl border px-3 py-3 text-xs leading-5"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text-muted)",
            }}
          >
            <span
              className="font-black uppercase tracking-[0.14em]"
              style={{ color: "var(--primary)" }}
            >
              {activeTabMeta.label}
            </span>{" "}
            <span className="opacity-60">/</span> {activeTabMeta.description}
          </div>
        </div>
      </section>

      <div className="min-w-0">
        {activeTab === "add" ? <UploadPanel /> : null}
        {activeTab === "quick-edit" ? <QuickMediaEditorPanel /> : null}
        {activeTab === "programming" ? <ChannelProgrammingPanel /> : null}
        {activeTab === "branding" ? <ChannelBrandingPanel /> : null}
        {activeTab === "library" ? <MediaLibraryPanel /> : null}

        {activeTab === "launch" ? (
          <LaunchReadinessPanel
            checks={launchChecks}
            activeChannelLabel={getChannelLabel(activeChannel)}
            activeChannelName={getChannelName(activeChannel)}
          />
        ) : null}

        {activeTab === "config" ? (
          <StationConfigPanel
            media={media}
            channels={channels}
            currentChannelId={currentChannelId}
            sidebarWidth={sidebarWidth}
            guideHeight={guideHeight}
            appMode={appMode}
            themeId={themeId}
            ownedPremiumThemes={ownedPremiumThemes}
          />
        ) : null}
      </div>
    </div>
  );
}