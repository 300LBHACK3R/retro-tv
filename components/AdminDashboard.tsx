"use client";

import { useEffect, useMemo, useState } from "react";
import BulkImporterPanel from "@/components/BulkImporterPanel";
import ChannelBrandingPanel from "@/components/ChannelBrandingPanel";
import ChannelProgrammingPanel from "@/components/ChannelProgrammingPanel";
import MediaLibraryPanel from "@/components/MediaLibraryPanel";
import QuickMediaEditorPanel from "@/components/QuickMediaEditorPanel";
import StationConfigPanel from "@/components/StationConfigPanel";
import UploadPanel from "@/components/UploadPanel";
import { useStore } from "@/lib/store";
import type { MediaItem } from "@/lib/types";

type AdminTab =
  | "quick-edit"
  | "add"
  | "bulk"
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
};

type LaunchCheck = {
  label: string;
  status: "pass" | "warn";
  helper: string;
};

const ADMIN_TAB_STORAGE_KEY = "tatestv:admin-dashboard-tab:v1";

const TABS: AdminTabMeta[] = [
  {
    id: "quick-edit",
    label: "Quick Edit",
    shortLabel: "Edit",
    description: "Edit shows, breaks, runtime, days, and channel assignments.",
  },
  {
    id: "add",
    label: "Add Media",
    shortLabel: "Add",
    description: "Add one media item from a public R2/video URL.",
  },
  {
    id: "bulk",
    label: "Bulk Import",
    shortLabel: "Bulk",
    description: "Load full seasons, channels, commercials, or music packs.",
  },
  {
    id: "programming",
    label: "Playlist",
    shortLabel: "Playlist",
    description: "Reorder channel playlists and tune schedule behavior.",
  },
  {
    id: "branding",
    label: "Branding",
    shortLabel: "Brand",
    description: "Edit channel identity, callsign, color, and overlay details.",
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
    description: "Review station readiness before going live.",
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

function getChannelLabel(
  channel: { id: string; number?: number; name: string } | undefined,
): string {
  if (!channel) {
    return "No Channel";
  }

  return `CH ${channel.number ?? channel.id}`;
}

function getChannelName(
  channel:
    | {
        name: string;
        branding?: {
          displayName?: string;
        };
      }
    | undefined,
): string {
  if (!channel) {
    return "No active channel selected";
  }

  return channel.branding?.displayName ?? channel.name;
}

function getMediaTypeCount(media: MediaItem[], types: MediaItem["type"][]): number {
  const typeSet = new Set(types);

  return media.filter((item) => typeSet.has(item.type)).length;
}

function createAssignedMediaSet(channels: { mediaIds: string[] }[]): Set<string> {
  const assigned = new Set<string>();

  channels.forEach((channel) => {
    channel.mediaIds.forEach((mediaId) => {
      assigned.add(mediaId);
    });
  });

  return assigned;
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: 0,
  }).format(value);
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
  return (
    <div
      className="rounded-2xl border p-3"
      style={{
        background: "var(--panel-alt-bg)",
        borderColor: "var(--border)",
      }}
    >
      <div className="text-xl font-black tracking-tight">{stat.value}</div>

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
            Quick operational view for programming coverage, channel setup,
            assignments, backups, and the currently selected channel.
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
          <span>{warnCount} watch</span>
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
      // Best-effort UI preference only.
    }
  }, [activeTab]);

  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === currentChannelId),
    [channels, currentChannelId],
  );

  const activeTabMeta = useMemo<AdminTabMeta>(() => {
    return TABS.find((tab) => tab.id === activeTab) ?? TABS[0]!;
  }, [activeTab]);

  const enabledChannelCount = useMemo(
    () => channels.filter((channel) => channel.isEnabled !== false).length,
    [channels],
  );

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

  const activeChannelMediaCount = activeChannel?.mediaIds.length ?? 0;

  const dashboardStats = useMemo<DashboardStat[]>(() => {
    const adInventoryCount = getMediaTypeCount(media, ["commercial", "bumper"]);
    const programCount = getMediaTypeCount(media, [
      "show",
      "movie",
      "music",
      "music-video",
    ]);
    const musicCount = getMediaTypeCount(media, ["music", "music-video"]);

    return [
      {
        label: "Media Items",
        value: formatCompactNumber(media.length),
        helper: "Total saved videos, shows, movies, music, ads, and bumpers.",
      },
      {
        label: "Programs",
        value: formatCompactNumber(programCount),
        helper: "Shows, movies, music, and music videos available to channels.",
      },
      {
        label: "Music",
        value: formatCompactNumber(musicCount),
        helper: "Music and music-video inventory for music channels.",
      },
      {
        label: "Ads / Bumpers",
        value: formatCompactNumber(adInventoryCount),
        helper: "Short-form inventory used for breaks and filler.",
      },
      {
        label: "Enabled Channels",
        value: formatCompactNumber(enabledChannelCount),
        helper: "Public channels available to viewers.",
      },
      {
        label: "Unassigned",
        value: formatCompactNumber(unassignedCount),
        helper: "Media saved but not yet attached to a channel.",
      },
    ];
  }, [enabledChannelCount, media, unassignedCount]);

  const launchChecks = useMemo<LaunchCheck[]>(() => {
    return [
      {
        label: "Channel Lineup",
        status: enabledChannelCount >= 12 ? "pass" : "warn",
        helper:
          enabledChannelCount >= 12
            ? "Twelve or more public channels are enabled."
            : "Enable all launch channels before going public.",
      },
      {
        label: "Programming Inventory",
        status: media.length >= 20 ? "pass" : "warn",
        helper:
          media.length >= 20
            ? "The media library has enough content for a launch pass."
            : "Add more shows, movies, music, ads, or bumpers.",
      },
      {
        label: "Channel Assignments",
        status: assignedCount > 0 && unassignedCount < media.length ? "pass" : "warn",
        helper:
          assignedCount > 0
            ? `${formatCompactNumber(assignedCount)} media items are assigned to channels.`
            : "Assign media to channels so the live schedule can run.",
      },
      {
        label: "Active Channel",
        status: activeChannel && activeChannelMediaCount > 0 ? "pass" : "warn",
        helper:
          activeChannel && activeChannelMediaCount > 0
            ? `${getChannelLabel(activeChannel)} has ${formatCompactNumber(
                activeChannelMediaCount,
              )} assigned item(s).`
            : "Select a channel with assigned media before testing playback.",
      },
      {
        label: "Station Backup",
        status: media.length > 0 && channels.length > 0 ? "pass" : "warn",
        helper:
          "Export Station Config after each major upload or branding session.",
      },
      {
        label: "Commercial Inventory",
        status: getMediaTypeCount(media, ["commercial", "bumper"]) > 0 ? "pass" : "warn",
        helper:
          getMediaTypeCount(media, ["commercial", "bumper"]) > 0
            ? "Commercial or bumper inventory is available."
            : "Add ad/bumpers for more realistic channel breaks.",
      },
    ];
  }, [
    activeChannel,
    activeChannelMediaCount,
    assignedCount,
    channels.length,
    enabledChannelCount,
    media,
    unassignedCount,
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
              Manage uploads, bulk imports, playlists, commercial blocks,
              music channels, channel branding, media assignments, and station
              backups from one protected control surface.
            </p>
          </div>

          <div
            className="max-w-full rounded-2xl border px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em]"
            style={{
              borderColor: "var(--border)",
              background: "var(--panel-alt-bg)",
              color: "var(--text-muted)",
            }}
            title={`${getChannelLabel(activeChannel)} • ${getChannelName(
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
        {activeTab === "bulk" ? <BulkImporterPanel /> : null}
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