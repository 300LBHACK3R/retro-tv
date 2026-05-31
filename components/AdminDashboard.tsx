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

type AdminTab =
  | "add"
  | "bulk"
  | "quick-edit"
  | "programming"
  | "branding"
  | "library"
  | "config";

const TABS: Array<{
  id: AdminTab;
  label: string;
  description: string;
}> = [
  {
    id: "quick-edit",
    label: "Quick Edit",
    description: "Edit shows, breaks, runtime, days, and channels.",
  },
  {
    id: "add",
    label: "Add",
    description: "Add one media item from a public R2/video URL.",
  },
  {
    id: "bulk",
    label: "Bulk Import",
    description: "Load full seasons, channels, commercials, or bumpers.",
  },
  {
    id: "programming",
    label: "Playlist",
    description: "Reorder channels and tune schedule behavior.",
  },
  {
    id: "branding",
    label: "Branding",
    description: "Edit channel identity, callsign, color, and overlay.",
  },
  {
    id: "library",
    label: "Library",
    description: "Manage all saved media metadata and assignments.",
  },
  {
    id: "config",
    label: "Config",
    description: "Export/import station programming and settings.",
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

  const commercialCount = useMemo(
    () =>
      media.filter(
        (item) => item.type === "commercial" || item.type === "bumper",
      ).length,
    [media],
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <section
        className="relative overflow-hidden rounded-2xl border p-3 shadow-2xl shadow-black/20 sm:p-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.035), transparent 44%), var(--panel-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--primary)" }}
          aria-hidden="true"
        />

        <div className="relative mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div
              className="text-xs font-black uppercase tracking-[0.2em]"
              style={{ color: "var(--primary)" }}
            >
              Admin Control Center
            </div>

            <h2 className="mt-1 text-lg font-black tracking-tight">
              Station Management
            </h2>

            <p
              className="mt-1 max-w-3xl text-xs leading-5"
              style={{ color: "var(--text-muted)" }}
            >
              Manage uploads, bulk imports, playlists, commercial blocks,
              channel branding, media assignments, and station backup.
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
            {getChannelLabel(activeChannel)} • {getChannelName(activeChannel)}
          </div>
        </div>

        <div
          className="relative mb-3 grid gap-2 rounded-xl border p-3 sm:grid-cols-4"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
          }}
        >
          <div>
            <div className="text-lg font-black">{media.length}</div>
            <div
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{ color: "var(--text-muted)" }}
            >
              Media Items
            </div>
          </div>

          <div>
            <div className="text-lg font-black">{enabledChannelCount}</div>
            <div
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{ color: "var(--text-muted)" }}
            >
              Enabled Channels
            </div>
          </div>

          <div>
            <div className="text-lg font-black">{commercialCount}</div>
            <div
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{ color: "var(--text-muted)" }}
            >
              Ads / Bumpers
            </div>
          </div>

          <div>
            <div className="truncate text-lg font-black">
              {activeTabMeta?.label ?? "Admin"}
            </div>
            <div
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{ color: "var(--text-muted)" }}
            >
              Current Tool
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map((tab) => {
              const active = tab.id === activeTab;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="shrink-0 rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.08em] transition hover:scale-[1.01] hover:opacity-90"
                  style={{
                    background: active ? "var(--primary)" : "var(--button-bg)",
                    borderColor: active ? "var(--primary)" : "var(--border)",
                    color: "var(--text)",
                  }}
                  title={tab.description}
                  aria-pressed={active}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div
            className="mt-2 rounded-xl border px-3 py-2 text-xs leading-5"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text-muted)",
            }}
          >
            {activeTabMeta?.description}
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