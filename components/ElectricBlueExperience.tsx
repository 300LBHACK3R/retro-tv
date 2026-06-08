"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import ChannelOverlay from "@/components/ChannelOverlay";
import MultiGuide from "@/components/MultiGuide";
import Player from "@/components/Player";
import Remote from "@/components/Remote";
import ShowLibrary from "@/components/ShowLibrary";
import StaticTransition from "@/components/StaticTransition";
import ThemeButton from "@/components/ThemeButton";
import { getLiveState } from "@/lib/liveEngine";
import { useStore } from "@/lib/store";
import type { BroadcastItem, Channel } from "@/lib/types";

type ChannelSchedule = {
  channel: Channel;
  schedule: BroadcastItem[];
};

type MobileDrawer = "guide" | null;

interface ElectricBlueExperienceProps {
  activeChannel: Channel | undefined;
  activeSchedule: BroadcastItem[];
  channelSchedules: ChannelSchedule[];
  onProgramSelect: (channel: Channel) => void;
  onOpenSettings: () => void;
}

const LIVE_TICK_MS = 1000;
const MAX_DESKTOP_GUIDE_CHANNELS = 8;
const MAX_QUICK_CHANNELS = 12;

function getChannelLabel(channel: Channel | undefined): string {
  if (!channel) return "CH --";
  return `CH ${channel.number ?? channel.id}`;
}

function getChannelName(channel: Channel | undefined): string {
  if (!channel) return "No Channel";
  return channel.branding?.displayName ?? channel.name;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remaining = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remaining,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function getPoster(item: BroadcastItem | undefined): string | undefined {
  return item?.poster?.trim() || undefined;
}

function getDisplayTitle(item: BroadcastItem | undefined): string {
  if (!item) return "No program scheduled";
  return item.sourceTitle?.trim() || item.title;
}

function isGuideVisibleItem(item: BroadcastItem | undefined): item is BroadcastItem {
  if (!item) return false;

  return (
    !item.hiddenFromGuide &&
    item.type !== "commercial" &&
    item.type !== "bumper"
  );
}

function getFirstVisibleItem(schedule: BroadcastItem[]): BroadcastItem | undefined {
  return schedule.find(isGuideVisibleItem) ?? schedule[0];
}

function getNextItem(
  schedule: BroadcastItem[],
  currentIndex: number,
): BroadcastItem | undefined {
  if (schedule.length === 0) return undefined;

  for (let offset = 1; offset <= schedule.length; offset += 1) {
    const item = schedule[(currentIndex + offset) % schedule.length];

    if (isGuideVisibleItem(item)) {
      return item;
    }
  }

  return schedule[(currentIndex + 1) % schedule.length];
}

function getProgressPercent(elapsed: number, duration: number | undefined): number {
  if (!duration || duration <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (elapsed / duration) * 100));
}

function PreviewCard({
  item,
  label,
  compact = false,
  progressPercent,
}: {
  item: BroadcastItem | undefined;
  label: string;
  compact?: boolean;
  progressPercent?: number;
}) {
  const poster = getPoster(item);
  const title = getDisplayTitle(item);

  return (
    <article
      className="electric-card-glow overflow-hidden rounded-3xl border"
      style={{
        borderColor: "rgba(34, 211, 238, 0.36)",
        background:
          "linear-gradient(135deg, rgba(5, 22, 52, 0.90), rgba(2, 6, 23, 0.92))",
      }}
    >
      <div
        className={
          compact
            ? "flex gap-3 p-3"
            : "grid gap-3 p-3 sm:grid-cols-[190px_minmax(0,1fr)]"
        }
      >
        <div className="ttv-poster-card relative aspect-video overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950">
          {poster ? (
            <img
              src={poster}
              alt={title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-3 text-center">
              <div className="relative z-10">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">
                  Preview
                </div>

                <div className="mt-1 line-clamp-2 text-xs font-black text-white">
                  {title}
                </div>
              </div>
            </div>
          )}

          {typeof progressPercent === "number" ? (
            <div className="absolute inset-x-3 bottom-3 z-20 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.72)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          ) : null}
        </div>

        <div className="min-w-0 self-center">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
            {label}
          </div>

          <h3 className="mt-1 line-clamp-2 text-lg font-black tracking-tight text-white">
            {title}
          </h3>

          {item ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-blue-200">
              <span>{item.type.toUpperCase()}</span>
              <span className="text-blue-200/40">/</span>
              <span>{formatDuration(item.duration)}</span>
            </div>
          ) : (
            <div className="mt-2 text-xs font-semibold text-blue-200">
              Add media in admin mode.
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ElectricGuide({
  data,
  onProgramSelect,
  onOpenFullGuide,
}: {
  data: ChannelSchedule[];
  onProgramSelect: (channel: Channel) => void;
  onOpenFullGuide: () => void;
}) {
  const limited = data.slice(0, MAX_DESKTOP_GUIDE_CHANNELS);

  return (
    <section className="electric-panel flex h-full min-h-[24rem] flex-col overflow-hidden rounded-3xl border p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
            TV Guide
          </div>

          <div className="mt-1 text-sm font-semibold text-blue-100">
            Live channel schedule
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenFullGuide}
          className="electric-pill px-3 py-2 text-[10px]"
        >
          View All
        </button>
      </div>

      <div className="ttv-guide-scroll min-h-0 flex-1 space-y-2 pr-1">
        {limited.map(({ channel, schedule }) => {
          const firstVisible = getFirstVisibleItem(schedule);

          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => onProgramSelect(channel)}
              className="group grid w-full grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-cyan-300/20 bg-slate-950/55 p-3 text-left transition hover:border-cyan-300/70 hover:bg-cyan-400/10"
            >
              <div>
                <div className="text-xs font-black text-cyan-300">
                  {getChannelLabel(channel)}
                </div>

                <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-blue-200/70">
                  Live
                </div>
              </div>

              <div className="min-w-0">
                <div className="truncate text-sm font-black text-white">
                  {getDisplayTitle(firstVisible)}
                </div>

                <div className="mt-1 truncate text-xs text-blue-200/75">
                  {getChannelName(channel)}
                </div>
              </div>

              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
                ›
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ElectricRemotePanel({
  onOpenGuide,
  onOpenSettings,
}: {
  onOpenGuide: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <section className="electric-panel rounded-3xl border p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
            Controls
          </div>

          <div className="mt-1 text-sm text-blue-100">
            Tune, guide, library, themes
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <button type="button" className="electric-pill" onClick={onOpenGuide}>
          Guide
        </button>

        <button type="button" className="electric-pill" onClick={onOpenSettings}>
          Settings
        </button>

        <div className="[&>button]:w-full [&>button]:rounded-2xl [&>button]:border-cyan-300/30 [&>button]:bg-cyan-400/10 [&>button]:px-4 [&>button]:py-3 [&>button]:text-xs [&>button]:font-black [&>button]:uppercase [&>button]:tracking-[0.12em]">
          <ShowLibrary />
        </div>

        <div className="[&>button]:w-full [&>button]:rounded-2xl [&>button]:border-cyan-300/30 [&>button]:bg-cyan-400/10 [&>button]:px-4 [&>button]:py-3 [&>button]:text-xs [&>button]:font-black [&>button]:uppercase [&>button]:tracking-[0.12em]">
          <ThemeButton />
        </div>
      </div>

      <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/55 p-3">
        <Remote />
      </div>
    </section>
  );
}

function QuickChannelGrid({
  data,
  onProgramSelect,
}: {
  data: ChannelSchedule[];
  onProgramSelect: (channel: Channel) => void;
}) {
  const visibleChannels = data.slice(0, MAX_QUICK_CHANNELS);

  return (
    <section className="electric-panel rounded-3xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
            Channels
          </div>

          <div className="mt-1 text-sm text-blue-100">
            Quick tune lineup
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visibleChannels.map(({ channel, schedule }) => {
          const current = getFirstVisibleItem(schedule);

          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => onProgramSelect(channel)}
              className="group rounded-2xl border border-cyan-300/20 bg-slate-950/55 p-3 text-left transition hover:border-cyan-300/75 hover:bg-cyan-400/10"
            >
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                {getChannelLabel(channel)}
              </div>

              <div className="mt-1 truncate text-sm font-black text-white">
                {getChannelName(channel)}
              </div>

              <div className="mt-2 line-clamp-1 text-xs text-blue-200/70">
                {getDisplayTitle(current)}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MobileDock({
  onOpenGuide,
  onOpenSettings,
}: {
  onOpenGuide: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <nav className="electric-mobile-dock grid grid-cols-4 gap-2 p-2 xl:hidden">
      <button
        type="button"
        onClick={onOpenGuide}
        className="rounded-2xl px-2 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100"
      >
        Guide
      </button>

      <div className="[&>button]:h-full [&>button]:w-full [&>button]:rounded-2xl [&>button]:px-2 [&>button]:py-3 [&>button]:text-[10px]">
        <ShowLibrary />
      </div>

      <div className="[&>button]:h-full [&>button]:w-full [&>button]:rounded-2xl [&>button]:px-2 [&>button]:py-3 [&>button]:text-[10px]">
        <ThemeButton />
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        className="rounded-2xl px-2 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100"
      >
        Admin
      </button>
    </nav>
  );
}

function MobileGuideDrawer({
  data,
  onProgramSelect,
  onClose,
}: {
  data: ChannelSchedule[];
  onProgramSelect: (channel: Channel) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[92] bg-black/75 p-3 backdrop-blur-sm xl:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Electric Blue guide"
    >
      <div className="electric-panel flex h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-3xl border p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
              Full Guide
            </div>

            <div className="mt-1 text-sm text-blue-100">
              Pick a channel to tune instantly.
            </div>
          </div>

          <button type="button" onClick={onClose} className="electric-pill">
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <MultiGuide
            data={data}
            onProgramSelect={({ channel }) => {
              onProgramSelect(channel);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function ElectricBlueExperience({
  activeChannel,
  activeSchedule,
  channelSchedules,
  onProgramSelect,
  onOpenSettings,
}: ElectricBlueExperienceProps) {
  const [now, setNow] = useState(() => new Date());
  const [mobileDrawer, setMobileDrawer] = useState<MobileDrawer>(null);
  const toggleGuide = useStore((state) => state.toggleGuide);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), LIVE_TICK_MS);

    return () => window.clearInterval(timer);
  }, []);

  const live = useMemo(
    () => getLiveState(activeSchedule, now.getTime()),
    [activeSchedule, now],
  );

  const nextItem = useMemo(
    () => getNextItem(activeSchedule, live.index),
    [activeSchedule, live.index],
  );

  const progressPercent = useMemo(
    () => getProgressPercent(live.elapsed, live.item?.duration),
    [live.elapsed, live.item?.duration],
  );

  const openGuide = useCallback(() => {
    setMobileDrawer("guide");
  }, []);

  const closeMobileDrawer = useCallback(() => {
    setMobileDrawer(null);
  }, []);

  return (
    <div className="electric-shell relative min-h-screen overflow-hidden">
      <div className="electric-energy electric-energy-one" aria-hidden="true" />
      <div className="electric-energy electric-energy-two" aria-hidden="true" />
      <div className="electric-grid" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1900px] flex-col gap-4 p-3 pb-[calc(6rem+var(--safe-bottom))] sm:p-5 xl:pb-5">
        <header className="electric-panel flex flex-col gap-3 rounded-3xl border p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Image
              src="/retro-logo.png"
              alt="TatesTv"
              width={320}
              height={110}
              className="h-auto w-[min(270px,68vw)] object-contain sm:w-[280px]"
              priority
            />

            <div className="hidden h-16 w-px bg-cyan-300/20 lg:block" />

            <nav className="hidden flex-wrap gap-2 xl:flex">
              <button type="button" className="electric-nav active">
                Live TV
              </button>

              <button type="button" className="electric-nav" onClick={toggleGuide}>
                Guide
              </button>

              <ShowLibrary />
              <ThemeButton />

              <button type="button" className="electric-nav" onClick={onOpenSettings}>
                Settings
              </button>
            </nav>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="electric-status">
              <span className="text-cyan-300">◷</span> {formatClock(now)}
            </div>

            <div className="electric-status">
              {getChannelLabel(activeChannel)}{" "}
              <span className="text-emerald-300">Live</span>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(390px,500px)]">
          <section className="grid min-w-0 gap-4">
            <div className="electric-player-shell relative aspect-video overflow-hidden rounded-3xl border border-cyan-300/45 bg-black shadow-[0_0_60px_rgba(34,211,238,0.24)]">
              <div className="absolute left-3 top-3 z-20 rounded-xl border border-cyan-300/40 bg-slate-950/70 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200 backdrop-blur-md sm:left-4 sm:top-4 sm:text-xs">
                ● Live
              </div>

              <Player schedule={activeSchedule} />
              <ChannelOverlay />
              <StaticTransition trigger={activeChannel?.id ?? ""} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
              <PreviewCard
                item={live.item ?? undefined}
                label="On Air Now"
                progressPercent={progressPercent}
              />

              <PreviewCard item={nextItem} label="Up Next" compact />
            </div>

            <QuickChannelGrid
              data={channelSchedules}
              onProgramSelect={onProgramSelect}
            />
          </section>

          <aside className="hidden min-w-0 gap-4 xl:grid">
            <ElectricGuide
              data={channelSchedules}
              onProgramSelect={onProgramSelect}
              onOpenFullGuide={toggleGuide}
            />

            <ElectricRemotePanel
              onOpenGuide={toggleGuide}
              onOpenSettings={onOpenSettings}
            />
          </aside>
        </div>

        <footer className="electric-panel rounded-3xl border px-4 py-3 text-xs text-blue-100/80">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="font-black uppercase tracking-[0.18em] text-cyan-300">
                Welcome to TatesTv
              </span>
            </div>

            <div className="truncate">
              Now Playing / {getDisplayTitle(live.item ?? undefined)} /{" "}
              {formatDuration(live.elapsed)} /{" "}
              {formatDuration(live.item?.duration ?? 0)}
            </div>
          </div>
        </footer>
      </div>

      <MobileDock onOpenGuide={openGuide} onOpenSettings={onOpenSettings} />

      {mobileDrawer === "guide" ? (
        <MobileGuideDrawer
          data={channelSchedules}
          onProgramSelect={onProgramSelect}
          onClose={closeMobileDrawer}
        />
      ) : null}
    </div>
  );
}