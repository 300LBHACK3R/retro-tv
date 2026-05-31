"use client";

import { useState } from "react";
import ChannelBrandingPanel from "@/components/ChannelBrandingPanel";
import ChannelProgrammingPanel from "@/components/ChannelProgrammingPanel";
import MediaLibraryPanel from "@/components/MediaLibraryPanel";
import QuickMediaEditorPanel from "@/components/QuickMediaEditorPanel";
import StationConfigPanel from "@/components/StationConfigPanel";
import UploadPanel from "@/components/UploadPanel";
import { useStore } from "@/lib/store";

type AdminTab =
  | "add"
  | "quick-edit"
  | "programming"
  | "branding"
  | "library"
  | "config";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "add", label: "Add" },
  { id: "quick-edit", label: "Quick Edit" },
  { id: "programming", label: "Playlist" },
  { id: "branding", label: "Branding" },
  { id: "library", label: "Library" },
  { id: "config", label: "Config" },
];

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

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <section
        className="rounded-2xl border p-3"
        style={{
          background: "var(--panel-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <div
          className="mb-3 text-xs font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--primary)" }}
        >
          Admin Control Center
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const active = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] transition hover:opacity-90"
                style={{
                  background: active ? "var(--primary)" : "var(--button-bg)",
                  color: "var(--text)",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {activeTab === "add" ? <UploadPanel /> : null}
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
  );
}
