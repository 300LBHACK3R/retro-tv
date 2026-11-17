"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";

function PanelLoading() { return <div className="ttv-admin-card" role="status">Opening admin tools…</div>; }
const LibraryPresentationPanel = dynamic(() => import("./LibraryPresentationPanel"), { loading: PanelLoading });
const ChannelLineupPanel = dynamic(() => import("./ChannelLineupPanel"), { loading: PanelLoading });
const AudiencePanel = dynamic(() => import("./AudiencePanel"), { loading: PanelLoading });
const ServiceHealthPanel = dynamic(() => import("./ServiceHealthPanel"), { loading: PanelLoading });
const StationInsightsPanel = dynamic(() => import("./StationInsightsPanel"), { loading: PanelLoading });
const ProgrammeBlocksPanel = dynamic(() => import("./ProgrammeBlocksPanel"), { loading: PanelLoading });
const ChannelBrandingPanel = dynamic(() => import("./ChannelBrandingPanel"), { loading: PanelLoading });
const ChannelProgrammingPanel = dynamic(() => import("./ChannelProgrammingPanel"), { loading: PanelLoading });
const MediaLibraryPanel = dynamic(() => import("./MediaLibraryPanel"), { loading: PanelLoading });
const QuickMediaEditorPanel = dynamic(() => import("./QuickMediaEditorPanel"), { loading: PanelLoading });
const SubmissionInboxPanel = dynamic(() => import("./SubmissionInboxPanel"), { loading: PanelLoading });
const ShowRequestsPanel = dynamic(() => import("./ShowRequestsPanel"), { loading: PanelLoading });
const ShowOrganizationPanel = dynamic(() => import("./ShowOrganizationPanel"), { loading: PanelLoading });
const StationConfigPanel = dynamic(() => import("./StationConfigPanel"), { loading: PanelLoading });
const UploadPanel = dynamic(() => import("./UploadPanel"), { loading: PanelLoading });
const CommercialsPanel = dynamic(() => import("./CommercialsPanel"), { loading: PanelLoading });
const BatchImportPanel = dynamic(() => import("./BatchImportPanel"), { loading: PanelLoading, ssr: false });

type AdminTab =
  | "batch"
  | "commercials"
  | "artwork"
  | "lineup"
  | "audience"
  | "insights"
  | "blocks"
  | "quick-edit"
  | "add"
  | "submissions"
  | "health"
  | "show-requests"
  | "show-organization"
  | "programming"
  | "branding"
  | "library"
  | "config";

type AdminTabMeta = {
  id: AdminTab;
  label: string;
  description: string;
};

const TABS: AdminTabMeta[] = [
  { id: "show-organization", label: "Show Organization", description: "Group series, review missing season numbers and correct episode order." },
  { id: "health", label: "Service Health", description: "Check accounts, email delivery, playback reports and unavailable videos." },
  { id: "show-requests", label: "Show Requests", description: "Review paid-member show suggestions, update progress and reply to members." },
  { id: "batch", label: "Batch Import", description: "Upload multiple episodes, reuse R2 links, detect runtimes and assign a channel in one review." },
  { id: "commercials", label: "Commercials", description: "Upload ads, assign campaigns, configure breaks and preview the schedule." },
  { id: "artwork", label: "Artwork & Coming Soon", description: "Title posters, Kids library review and upcoming announcements." },
  { id: "lineup", label: "Channel Lineup", description: "Move and renumber channels, control on-air status, and add seasonal channels." },
  { id: "audience", label: "Audience & Channels", description: "Review Kids programming and organize channel categories." },
  {
    id: "insights",
    label: "Station Insights",

    description: "Viewing activity and station audience trends.",
  },
  {
    id: "blocks",
    label: "Programme Blocks",

    description:
      "Schedule recurring nights, weekend blocks, and daily appointments.",
  },
  {
    id: "quick-edit",
    label: "Quick Edit",

    description:
      "Edit titles, runtimes, types, air days, and safe channel assignments.",
  },
  {
    id: "add",
    label: "Add Media",

    description: "Add one media item from a public R2 or video URL.",
  },
  {
    id: "submissions",
    label: "Submissions",

    description:
      "Review FailZone uploads, rights confirmations, notes, and approval status.",
  },
  {
    id: "programming",
    label: "Playlist",

    description: "Reorder channel lineups and tune schedule/ad behavior.",
  },
  {
    id: "branding",
    label: "Branding",

    description:
      "Edit channel identity, callsign, color, logo, and overlay details.",
  },
  {
    id: "library",
    label: "Library",

    description: "Browse inventory, manage channel assignments and remove unused media.",
  },
  {
    id: "config",
    label: "Backups & Restore",

    description: "Export, import, backup, and restore station programming.",
  },
];
const TOOL_GROUPS: { name: string; tabs: AdminTab[] }[] = [
  { name: "Library", tabs: ["quick-edit", "artwork", "show-organization", "library"] },
  { name: "Uploads", tabs: ["batch", "add", "commercials"] },
  { name: "Channels", tabs: ["lineup", "programming", "blocks", "audience", "branding"] },
  { name: "Inbox", tabs: ["show-requests", "submissions"] },
  { name: "Operations", tabs: ["health", "insights", "config"] },
];
const ADMIN_TAB_STORAGE_KEY = "tatestv:admin-dashboard-tab:v1";
function getInitialAdminTab(): AdminTab {
  if (typeof window !== "undefined") {
    try {
      const saved = window.localStorage.getItem(ADMIN_TAB_STORAGE_KEY);
      // Retire the duplicated launch summary without losing a saved destination.
      if (saved === "launch") return "health";
      if (TABS.some(tab => tab.id === saved)) return saved as AdminTab;
    } catch { /* A local preference; storage may be disabled. */ }
  }
  return "quick-edit";
}
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>(getInitialAdminTab);
  const [toolSearch, setToolSearch] = useState("");

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

  const activeGroup = TOOL_GROUPS.find(group => group.tabs.includes(activeTab))!;
  const query = toolSearch.trim().toLowerCase();
  const matchingTools = TABS.filter(tab => `${tab.label} ${tab.description}`.toLowerCase().includes(query));
  const visibleTools = query ? matchingTools : activeGroup.tabs.map(id => TABS.find(tab => tab.id === id)!);
  function openTool(id: AdminTab) { setActiveTab(id); setToolSearch(""); }

  return <div className="ttv-admin-workspace">
    <nav className="ttv-admin-navigation" aria-label="Admin tools">
      <label className="ttv-admin-search">Find an admin tool
        <input type="search" value={toolSearch} onChange={event => setToolSearch(event.target.value)} placeholder="Search uploads, artwork, Kids, backups…" />
      </label>
      <div className="ttv-admin-groups" aria-label="Admin sections">
        {TOOL_GROUPS.map(group => <button type="button" key={group.name} aria-label={`${group.name} section`} aria-pressed={!query && group.name === activeGroup.name}
          onClick={() => openTool(group.tabs.includes(activeTab) ? activeTab : group.tabs[0]!)}>{group.name}</button>)}
      </div>
      <div className="ttv-admin-tool-list" aria-label={query ? "Search results" : `${activeGroup.name} tools`}>
        {visibleTools.map(tab => <button type="button" key={tab.id} aria-label={tab.label} aria-pressed={tab.id === activeTab}
          onClick={() => openTool(tab.id)} title={tab.description}>
          <span>{tab.label}</span><small>{tab.description}</small>
        </button>)}
      </div>
      {visibleTools.length === 0 ? <p role="status">No matching tools. Try a shorter search.</p> : null}
    </nav>
    <div className="ttv-admin-tool-content" key={activeTab}>
        {activeTab === "commercials" ? <CommercialsPanel /> : null}
        {activeTab === "lineup" ? <ChannelLineupPanel onOpen={(tab, channelId) => {
          if (channelId) useStore.getState().setChannel(channelId);
          openTool(tab);
        }} /> : null}
        {activeTab === "artwork" ? <LibraryPresentationPanel /> : null}
        {activeTab === "audience" ? <AudiencePanel /> : null}
        {activeTab === "health" ? <ServiceHealthPanel /> : null}
        {activeTab === "insights" ? <StationInsightsPanel /> : null}
        {activeTab === "blocks" ? <ProgrammeBlocksPanel /> : null}
        {activeTab === "add" ? <UploadPanel /> : null}
        {activeTab === "batch" ? <BatchImportPanel /> : null}
        {activeTab === "submissions" ? <SubmissionInboxPanel /> : null}
        {activeTab === "show-requests" ? <ShowRequestsPanel /> : null}
        {activeTab === "show-organization" ? <ShowOrganizationPanel /> : null}
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
  </div>;
}
