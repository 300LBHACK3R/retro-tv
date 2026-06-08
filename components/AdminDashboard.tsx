"use client";

import { useMemo, useState } from "react";
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
  | "config";

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
    description: "Load full seasons, channels, commercials, or bumper packs.",
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
];

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

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>("quick-edit");

  const media = useStore((state) => state.media);
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const sidebarWidth = useStore((state) => state.sidebarWidth);
  const guideHeight = useStore((state) => state.guideHeight);
  const appMode = useStore((state) => state.appMode);
  const themeId = useStore((state) => state.themeId);
  const ownedPremiumThemes = useStore((state) => state.ownedPremiumThemes);

  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === currentChannelId),
    [channels, currentChannelId],
  );

  const activeTabMeta = useMemo(
    () => TABS.find((tab) => tab.id === activeTab) ?? TABS[0],
    [activeTab],
  );

  const enabledChannelCount = useMemo(
    () => channels.filter((channel) => channel.isEnabled !== false).length,
    [channels],
  );

  const assignedMediaSet = useMemo(() => createAssignedMediaSet(channels), [
    channels,
  ]);

  const dashboardStats = useMemo<DashboardStat[]>(() => {
    const commercialCount = getMediaTypeCount(media, ["commercial", "bumper"]);
    const longFormCount = getMediaTypeCount(media, ["show", "movie"]);
    const assignedCount = media.filter((item) => assignedMediaSet.has(item.id))
      .length;
    const unassignedCount = Math.max(0, media.length - assignedCount);

    return [
      {
        label: "Media Items",
        value: formatCompactNumber(media.length),
        helper: "Total saved videos, shows, movies, ads, and bumpers.",
      },
      {
        label: "Shows / Movies",
        value: formatCompactNumber(longFormCount),
        helper: "Long-form items available for live channels and library.",
      },
      {
        label: "Ads / Bumpers",
        value: formatCompactNumber(commercialCount),
        helper: "Short-form inventory used for breaks and filler.",
      },
      {
        label: "Enabled Channels",
        value: formatCompactNumber(enabledChannelCount),
        helper: "Public channels available to viewers.",
      },
      {
        label: "Assigned",
        value: formatCompactNumber(assignedCount),
        helper: "Media currently attached to at least one channel.",
      },
      {
        label: "Unassigned",
        value: formatCompactNumber(unassignedCount),
        helper: "Media saved but not yet attached to a channel.",
      },
    ];
  }, [assignedMediaSet, enabledChannelCount, media]);

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
              channel branding, media assignments, and station backups from one
              protected control surface.
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
              {activeTabMeta?.label}
            </span>{" "}
            <span className="opacity-60">/</span> {activeTabMeta?.description}
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