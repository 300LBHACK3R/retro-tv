"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
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

interface ElectricBlueExperienceProps {
  activeChannel: Channel | undefined;
  activeSchedule: BroadcastItem[];
  channelSchedules: ChannelSchedule[];
  onProgramSelect: (channel: Channel) => void;
  onOpenSettings: () => void;
}

const LIVE_TICK_MS = 1000;

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

function getNextItem(schedule: BroadcastItem[], currentIndex: number): BroadcastItem | undefined {
  if (schedule.length === 0) return undefined;

  for (let offset = 1; offset <= schedule.length; offset += 1) {
    const item = schedule[(currentIndex + offset) % schedule.length];

    if (!item) continue;

    if (
      item.hiddenFromGuide ||
      item.type === "commercial" ||
      item.type === "bumper"
    ) {
      continue;
    }

    return item;
  }

  return schedule[(currentIndex + 1) % schedule.length];
}

function PreviewCard({
  item,
  label,
  compact = false,
}: {
  item: BroadcastItem | undefined;
  label: string;
  compact?: boolean;
}) {
  const poster = getPoster(item);
  const title = getDisplayTitle(item);

  return (
    <article
      className="overflow-hidden rounded-2xl border electric-card-glow"
      style={{
        borderColor: "rgba(34, 211, 238, 0.36)",
        background:
          "linear-gradient(135deg, rgba(5, 22, 52, 0.90), rgba(2, 6, 23, 0.92))",
      }}
    >
      <div className={compact ? "flex gap-3 p-3" : "grid gap-3 p-3 sm:grid-cols-[180px_minmax(0,1fr)]"}>
        <div className="relative aspect-video overflow-hidden rounded-xl border border-cyan-300/20 bg-slate-950">
          {poster ? (
            <img
              src={poster}
              alt={title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_40%,rgba(34,211,238,0.32),transparent_36%),linear-gradient(135deg,rgba(15,23,42,1),rgba(8,47,73,0.92))] p-3 text-center">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">
                  Preview
                </div>
                <div className="mt-1 line-clamp-2 text-xs font-black text-white">
                  {title}
                </div>
              </div>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>

        <div className="min-w-0 self-center">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
            {label}
          </div>

          <h3 className="mt-1 line-clamp-2 text-lg font-black tracking-tight text-white">
            {title}
          </h3>

          {item ? (
            <div className="mt-2 text-xs font-semibold text-blue-200">
              {item.type.toUpperCase()} / {formatDuration(item.duration)}
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
}: {
  data: ChannelSchedule[];
  onProgramSelect: (channel: Channel) => void;
}) {
  const limited = data.slice(0, 7);

  return (
    <section className="electric-panel h-full overflow-hidden rounded-3xl border p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
            TV Guide
          </div>
          <div className="mt-1 text-sm font-semibold text-blue-100">
            Live channel schedule
          </div>
        </div>

        <div className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">
          View All
        </div>
      </div>

      <div className="space-y-2 overflow-y-auto pr-1">
        {limited.map(({ channel, schedule }) => {
          const firstVisible =
            schedule.find(
              (item) =>
                !item.hiddenFromGuide &&
                item.type !== "commercial" &&
                item.type !== "bumper",
            ) ?? schedule[0];

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

function ElectricRemotePanel() {
  return (
    <section className="electric-panel rounded-3xl border p-4">
      <div className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
        Remote Control
      </div>

      <div className="grid grid-cols-[1fr_7.5rem_1fr] items-center gap-3">
        <div className="grid gap-3">
          <button className="electric-pill">Back</button>
          <button className="electric-pill">Info</button>
          <button className="electric-pill">CC</button>
        </div>

        <div className="relative mx-auto flex aspect-square w-28 items-center justify-center rounded-full border border-cyan-300/50 bg-cyan-400/10 shadow-[0_0_45px_rgba(34,211,238,0.38)]">
          <div className="absolute top-2 text-cyan-200">▲</div>
          <div className="absolute bottom-2 text-cyan-200">▼</div>
          <div className="absolute left-3 text-cyan-200">‹</div>
          <div className="absolute right-3 text-cyan-200">›</div>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-300 text-sm font-black text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.75)]">
            OK
          </div>
        </div>

        <div className="grid gap-3">
          <button className="electric-pill">Home</button>
          <button className="electric-pill">Fav</button>
          <button className="electric-pill">Mute</button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-slate-950/55 p-3">
        <Remote />
      </div>
    </section>
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
  const toggleGuide = useStore((state) => state.toggleGuide);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), LIVE_TICK_MS);

    return () => window.clearInterval(timer);
  }, []);

  const live = useMemo(() => getLiveState(activeSchedule, now.getTime()), [
    activeSchedule,
    now,
  ]);

  const nextItem = useMemo(
    () => getNextItem(activeSchedule, live.index),
    [activeSchedule, live.index],
  );

  const visibleChannels = useMemo(() => channelSchedules.slice(0, 8), [
    channelSchedules,
  ]);

  return (
    <div className="electric-shell relative min-h-screen overflow-hidden">
      <div className="electric-energy electric-energy-one" aria-hidden="true" />
      <div className="electric-energy electric-energy-two" aria-hidden="true" />
      <div className="electric-grid" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1900px] flex-col gap-4 p-3 sm:p-5">
        <header className="electric-panel flex flex-col gap-3 rounded-3xl border p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/retro-logo.png"
              alt="TatesTv"
              width={320}
              height={110}
              className="h-auto w-[min(280px,70vw)] object-contain"
              priority
            />

            <div className="hidden h-16 w-px bg-cyan-300/20 lg:block" />

            <nav className="hidden flex-wrap gap-2 xl:flex">
              <button className="electric-nav active">Live TV</button>
              <button className="electric-nav" onClick={toggleGuide}>
                Guide
              </button>
              <ShowLibrary />
              <ThemeButton />
              <button className="electric-nav" onClick={onOpenSettings}>
                Settings
              </button>
            </nav>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="electric-status">
              <span className="text-cyan-300">◷</span> {formatClock(now)}
            </div>
            <div className="electric-status">
              Stream Quality <span className="text-emerald-300">Excellent</span>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(390px,500px)]">
          <section className="grid min-w-0 gap-4">
            <div className="electric-player-shell relative aspect-video overflow-hidden rounded-3xl border border-cyan-300/45 bg-black shadow-[0_0_60px_rgba(34,211,238,0.24)]">
              <div className="absolute left-4 top-4 z-20 rounded-xl border border-cyan-300/40 bg-slate-950/70 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200 backdrop-blur-md">
                ● Live
              </div>

              <Player schedule={activeSchedule} />
              <ChannelOverlay />
              <StaticTransition trigger={activeChannel?.id ?? ""} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
              <PreviewCard item={live.item ?? undefined} label="On Air Now" />
              <PreviewCard item={nextItem} label="Up Next" compact />
            </div>

            <section className="electric-panel rounded-3xl border p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                    Channels
                  </div>
                  <div className="mt-1 text-sm text-blue-100">
                    Quick tune lineup
                  </div>
                </div>

                <button className="electric-pill" onClick={toggleGuide}>
                  Full Guide
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {visibleChannels.map(({ channel, schedule }) => {
                  const current =
                    schedule.find(
                      (item) =>
                        !item.hiddenFromGuide &&
                        item.type !== "commercial" &&
                        item.type !== "bumper",
                    ) ?? schedule[0];

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
          </section>

          <aside className="grid min-w-0 gap-4">
            <ElectricGuide data={channelSchedules} onProgramSelect={onProgramSelect} />
            <ElectricRemotePanel />
          </aside>
        </div>

        <footer className="electric-panel rounded-3xl border px-4 py-3 text-xs text-blue-100/80">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="font-black uppercase tracking-[0.18em] text-cyan-300">
                Welcome to Tate&apos;s TV
              </span>
            </div>
            <div className="truncate">
              Now Playing / {getDisplayTitle(live.item ?? undefined)} /{" "}
              {formatDuration(live.elapsed)} / {formatDuration(live.item?.duration ?? 0)}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
