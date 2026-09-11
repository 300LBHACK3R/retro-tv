"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { buildForwardGuideCells } from "@/lib/guideTimeline";
import { parseLibraryItem } from "@/lib/libraryCatalog";
import {
  getChannelDisplayName,
  getChannelLabel,
  getMediaForChannel,
  isCommercialInventoryItem,
  sortEnabledChannels,
} from "@/lib/viewer";
import { useDeviceLibrary } from "@/lib/deviceLibrary";
import ProgrammeArtwork from "./ProgrammeArtwork";
import SaveButton from "./SaveButton";

export default function DailyDiscovery({
  onTune,
}: {
  onTune: (id: string) => void;
}) {
  const channels = useStore((state) => state.channels);
  const media = useStore((state) => state.media);
  const favourites = useDeviceLibrary((state) => state.favouriteChannels);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [view, setView] = useState<"now" | "tonight">("now");
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") setNowMs(Date.now());
    };
    update();
    const timer = window.setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const picks = useMemo(() => {
    if (nowMs === null) return [];
    const now = new Date(nowMs);
    const start = new Date(now);
    if (view === "tonight")
      start.setHours(
        Math.max(18, now.getHours()),
        now.getHours() < 18 ? 0 : now.getMinutes(),
        0,
        0,
      );
    const end = new Date(start);
    end.setHours(24, 0, 0, 0);
    const windowSeconds =
      view === "now"
        ? 7200
        : Math.max(60, (end.getTime() - start.getTime()) / 1000);
    const mediaById = new Map(media.map((item) => [item.id, item]));
    const availableAds = media.filter(isCommercialInventoryItem);
    const rows = sortEnabledChannels(channels)
      .map((channel) => {
        const cells = buildForwardGuideCells(
          {
            channel,
            media: getMediaForChannel(channel, mediaById),
            availableAds,
          },
          start,
          windowSeconds,
          now,
        );
        const cell =
          view === "now"
            ? cells.find(
                (candidate) => candidate.startSec <= 0 && candidate.endSec > 0,
              )
            : (cells.find((candidate) => candidate.item.programmeBlock) ??
              cells[0]);
        if (!cell) return null;
        const sourceId = cell.item.parentMediaId ?? cell.item.id;
        const source = mediaById.get(sourceId) ?? cell.item;
        return {
          channel,
          cell,
          item: parseLibraryItem(source),
          startsAt: start.getTime() + cell.startSec * 1000,
          sourceId,
        };
      })
      .filter((value) => value !== null);
    // Favourite channels lead; daily rotation lets the rest of the lineup be discovered.
    const day = Math.floor(nowMs / 86_400_000);
    return rows
      .sort(
        (a, b) =>
          Number(favourites.includes(b.channel.id)) -
            Number(favourites.includes(a.channel.id)) ||
          ((channels.indexOf(a.channel) + day) % Math.max(1, channels.length)) -
            ((channels.indexOf(b.channel) + day) %
              Math.max(1, channels.length)),
      )
      .slice(0, 4);
  }, [channels, media, favourites, nowMs, view]);
  if (!nowMs || !picks.length) return null;
  return (
    <section className="ttv-discovery" aria-labelledby="ttv-discovery-title">
      <div className="ttv-discovery-heading">
        <div>
          <span className="ttv-section-kicker">Your daily line-up</span>
          <h2 id="ttv-discovery-title">
            {view === "tonight"
              ? "Tonight on Tate’s TV"
              : "On now at Tate’s TV"}
          </h2>
          <p>
            {view === "tonight"
              ? "From the live schedule · Times shown in your local time"
              : "Pick a programme and jump straight into live TV."}
          </p>
        </div>
        <div className="ttv-section-actions" aria-label="Discover programmes">
          <button
            className="ttv-section-action"
            aria-pressed={view === "now"}
            onClick={() => setView("now")}
          >
            On now
          </button>
          <button
            className="ttv-section-action"
            aria-pressed={view === "tonight"}
            onClick={() => setView("tonight")}
          >
            Tonight
          </button>
        </div>
      </div>
      <div className="ttv-discovery-grid">
        {picks.map(({ channel, cell, item, startsAt, sourceId }) => (
          <article className="ttv-programme-card" key={channel.id}>
            <ProgrammeArtwork
              src={item.media.poster}
              title={item.groupTitle}
              kind={cell.item.programmeBlock || getChannelDisplayName(channel)}
            />
            <div className="ttv-programme-card__body">
              <span>
                {startsAt <= nowMs
                  ? "On now"
                  : new Date(startsAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                · {getChannelLabel(channel)}
              </span>
              <h3>{item.groupTitle}</h3>
              <p>
                {item.displayTitle !== item.groupTitle
                  ? `${item.displayTitle} · `
                  : ""}
                {cell.item.programmeBlock ||
                  item.media.description ||
                  getChannelDisplayName(channel)}
              </p>
              <div className="ttv-programme-card__actions">
                {startsAt <= nowMs ? (
                  <button
                    className="ttv-section-action"
                    onClick={() => onTune(channel.id)}
                  >
                    Watch live
                  </button>
                ) : (
                  <Link
                    className="ttv-section-action"
                    href={`/library?watch=${encodeURIComponent(sourceId)}`}
                  >
                    View in library
                  </Link>
                )}
                <SaveButton
                  kind="programme"
                  id={item.groupKey}
                  title={item.groupTitle}
                  compact
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
