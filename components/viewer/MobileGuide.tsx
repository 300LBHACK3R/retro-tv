"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import ChannelLogo from "./ChannelLogo";
import SaveButton from "./SaveButton";
import {
  formatDuration,
  formatTime,
  getChannelLabel,
  getChannelName,
  getDisplayTitle,
  getDisplayType,
  type PreparedGuideRow,
} from "@/lib/guideTimeline";
import {
  MOBILE_SCHEDULE_PAGE_SIZE,
  mobileNowNext,
  mobileScheduleDay,
  mobileSchedulePage,
} from "@/lib/mobileGuide";
import type { BroadcastItem, Channel } from "@/lib/types";

type Tune = (payload: { channel: Channel; item: BroadcastItem }) => void;

export default function MobileGuide({
  rows,
  selectedRow,
  currentChannelId,
  nowOffsetSec,
  windowStartMs,
  tools,
  emptyMessage,
  onChannelBrowse,
  onFindChannel,
  onTune,
}: {
  rows: PreparedGuideRow[];
  selectedRow: PreparedGuideRow | undefined;
  currentChannelId: string;
  nowOffsetSec: number;
  windowStartMs: number;
  tools: ReactNode;
  emptyMessage: string;
  onChannelBrowse: (channelId: string) => void;
  onFindChannel: () => void;
  onTune: Tune;
}) {
  const [view, setView] = useState<"now" | "schedule">("now");
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const backRef = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const channelListRef = useRef<HTMLDivElement | null>(null);
  const channelListScroll = useRef(0);
  const currentCardRef = useRef<HTMLLIElement | null>(null);
  const pendingFocus = useRef(false);
  const showSchedule = view === "schedule" && Boolean(selectedRow);
  const now = new Date(windowStartMs + nowOffsetSec * 1000);

  useEffect(() => {
    // Removing the last favourite can remove the open schedule as well.
    if (!showSchedule && view === "schedule") {
      setView("now");
      pendingFocus.current = true;
    }
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    if (showSchedule) backRef.current?.focus({ preventScroll: true });
    else {
      if (channelListRef.current)
        channelListRef.current.scrollTop = channelListScroll.current;
      if (returnFocusRef.current?.isConnected)
        returnFocusRef.current.focus({ preventScroll: true });
      else headingRef.current?.focus({ preventScroll: true });
    }
  }, [showSchedule, view]);

  return (
    <section className="ttv-mobile-guide" aria-label="Mobile live TV guide">
      {/* Keep this list mounted so Back restores its scroll position and focus. */}
      <div
        ref={channelListRef}
        className="ttv-mobile-guide-scroll"
        hidden={showSchedule}
      >
        {tools}
        <div className="ttv-mobile-now-heading">
          <h2 ref={headingRef} tabIndex={-1}>
            On now
          </h2>
          <div className="ttv-mobile-now-actions">
            {rows.some((row) => row.channel.id === currentChannelId) && (
              <button
                type="button"
                onClick={() => {
                  const card = currentCardRef.current;
                  card?.scrollIntoView({ block: "nearest" });
                  card?.querySelector<HTMLButtonElement>(".ttv-mobile-airing")
                    ?.focus({ preventScroll: true });
                }}
              >
                Your channel
              </button>
            )}
            <button type="button" onClick={() => {
              if (channelListRef.current) channelListRef.current.scrollTop = 0;
              onFindChannel();
            }}>
              Find
            </button>
          </div>
          <time dateTime={now.toISOString()}>{formatTime(now)}</time>
        </div>
        {rows.length === 0 ? (
          <p className="ttv-guide-empty" role="status">
            {emptyMessage}
          </p>
        ) : (
          <ul className="ttv-mobile-channel-list" aria-label="Channels on now">
            {rows.map((row) => {
              const { channel, cells, isPrepared } = row;
              const name = getChannelName(channel);
              const { live, next } = mobileNowNext(cells, nowOffsetSec);
              const current = channel.id === currentChannelId;
              const progress = live
                ? Math.min(
                    100,
                    Math.max(
                      0,
                      ((nowOffsetSec - live.startSec) /
                        (live.endSec - live.startSec)) *
                        100,
                    ),
                  )
                : 0;
              return (
                <li
                  key={channel.id}
                  ref={current ? currentCardRef : undefined}
                  className="ttv-mobile-channel"
                  data-current={current}
                >
                  <div className="ttv-mobile-channel-station">
                    <button type="button" className="ttv-mobile-station-tune" disabled={!live}
                      aria-label={`Tune to ${getChannelLabel(channel)} ${name}`}
                      aria-pressed={current}
                      onClick={() => live && onTune({ channel, item: live.item })}>
                      <ChannelLogo channel={channel} className="ttv-mobile-channel-logo" />
                      <span className="ttv-mobile-channel-number">{getChannelLabel(channel)}</span>
                      <span className="ttv-mobile-channel-name">{name}</span>
                    </button>
                    <SaveButton compact kind="channel" id={channel.id} title={name} />
                  </div>
                  <div className="ttv-mobile-channel-programmes">
                    <button type="button" className="ttv-mobile-airing" disabled={!live}
                      aria-label={`Watch ${name} live`} aria-pressed={current}
                      onClick={() => live && onTune({ channel, item: live.item })}>
                      <span className="ttv-mobile-airing-meta">
                        <span>{current && live ? "Watching" : live ? "On now" : "Live TV"}</span>
                        {live && <span>{formatDuration(live.endSec - nowOffsetSec)} left</span>}
                      </span>
                      <strong>{!isPrepared ? "Loading schedule…" : live ? getDisplayTitle(live.item) : "Off air"}</strong>
                      <span className="ttv-mobile-airing-time">
                        {live ? `${formatTime(new Date(windowStartMs + live.startSec * 1000))} – ${formatTime(new Date(windowStartMs + live.endSec * 1000))}` : "See upcoming listings below"}
                      </span>
                      {live && <span className="ttv-mobile-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></span>}
                    </button>
                    <button type="button" className="ttv-mobile-open-schedule"
                      aria-label={`Schedule for ${name}`}
                      onClick={(event) => {
                        returnFocusRef.current = event.currentTarget;
                        channelListScroll.current = channelListRef.current?.scrollTop ?? 0;
                        pendingFocus.current = true;
                        onChannelBrowse(channel.id);
                        setView("schedule");
                      }}>
                      <span className="ttv-mobile-next-time">{next ? `Next · ${formatTime(new Date(windowStartMs + next.startSec * 1000))}` : "Channel schedule"}</span>
                      <strong>{next ? getDisplayTitle(next.item) : isPrepared ? "See upcoming shows" : "Preparing listings…"}</strong>
                      <span className="ttv-mobile-schedule-link" aria-hidden="true">›</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {showSchedule && selectedRow && (
        <div className="ttv-mobile-guide-scroll">
          <div className="ttv-mobile-schedule-toolbar">
            <button
              ref={backRef}
              type="button"
              className="ttv-mobile-back"
              onClick={() => {
                pendingFocus.current = true;
                setView("now");
              }}
            >
              <span aria-hidden="true">‹</span> On now
            </button>
            <label>
              <span className="sr-only">Browse channel schedule</span>
              <select
                value={selectedRow.channel.id}
                onChange={(event) => onChannelBrowse(event.target.value)}
              >
                {rows.map(({ channel }) => (
                  <option key={channel.id} value={channel.id}>
                    {getChannelLabel(channel)} · {getChannelName(channel)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ChannelSchedule
            key={selectedRow.channel.id}
            row={selectedRow}
            nowOffsetSec={nowOffsetSec}
            windowStartMs={windowStartMs}
            onTune={onTune}
          />
        </div>
      )}
    </section>
  );
}

function ChannelSchedule({
  row,
  nowOffsetSec,
  windowStartMs,
  onTune,
}: {
  row: PreparedGuideRow;
  nowOffsetSec: number;
  windowStartMs: number;
  onTune: Tune;
}) {
  const [hoursAhead, setHoursAhead] = useState(0);
  const [limit, setLimit] = useState(MOBILE_SCHEDULE_PAGE_SIZE);
  const listRef = useRef<HTMLOListElement | null>(null);
  const nextFocusIndex = useRef<number | null>(null);
  const name = getChannelName(row.channel);
  const { live } = mobileNowNext(row.cells, nowOffsetSec);
  const page = mobileSchedulePage(row.cells, nowOffsetSec, hoursAhead, limit);
  const now = new Date(windowStartMs + nowOffsetSec * 1000);
  const scheduleEnd = row.cells.at(-1);
  const dateAt = (seconds: number) => new Date(windowStartMs + seconds * 1000);

  useEffect(() => {
    const index = nextFocusIndex.current;
    if (index === null) return;
    nextFocusIndex.current = null;
    const title = listRef.current?.querySelectorAll<HTMLElement>("h4")[index];
    title?.focus({ preventScroll: true });
    title?.scrollIntoView({ block: "nearest" });
  }, [limit]);

  return (
    <div className="ttv-mobile-schedule">
      <div className="ttv-mobile-schedule-heading">
        <div>
          <p>Channel schedule · Local time</p>
          <h2>{name}</h2>
        </div>
        <SaveButton compact kind="channel" id={row.channel.id} title={name} />
      </div>
      <div className="ttv-mobile-schedule-live">
        <div>
          <span>On now</span>
          <strong>
            {!row.isPrepared
              ? "Loading schedule…"
              : live
                ? getDisplayTitle(live.item)
                : "Off air"}
          </strong>
        </div>
        <button
          className="ttv-mobile-watch"
          type="button"
          disabled={!live}
          onClick={() =>
            live && onTune({ channel: row.channel, item: live.item })
          }
        >
          Watch live
        </button>
      </div>
      <nav className="ttv-mobile-time-jumps" aria-label="Schedule time">
        {[0, 3, 6, 12].map((hours) => (
          <button
            type="button"
            key={hours}
            aria-pressed={hoursAhead === hours}
            onClick={() => {
              setHoursAhead(hours);
              setLimit(MOBILE_SCHEDULE_PAGE_SIZE);
            }}
          >
            {hours === 0 ? "Now" : `+${hours} hr`}
          </button>
        ))}
      </nav>
      <p className="ttv-mobile-schedule-note">
        Upcoming shows air at the listed time. Watch live joins the current
        broadcast.
      </p>
      {!row.isPrepared ? (
        <p role="status" className="ttv-guide-empty">
          Loading schedule…
        </p>
      ) : (
        <>
          <ol
            ref={listRef}
            className="ttv-mobile-schedule-list"
            aria-label={`Upcoming on ${name}`}
          >
            {page.cells.map((cell, index) => {
              const start = dateAt(cell.startSec);
              const day = mobileScheduleDay(start, now);
              const previous = page.cells[index - 1];
              const showDay =
                !previous ||
                mobileScheduleDay(dateAt(previous.startSec), now) !== day;
              const isLive = cell === live;
              return (
                <li
                  key={`${cell.stableKey}-${cell.startSec}`}
                  data-live={isLive}
                >
                  {showDay && (
                    <h3 className="ttv-mobile-schedule-day">{day}</h3>
                  )}
                  <div className="ttv-mobile-listing">
                    <div className="ttv-mobile-listing-time">
                      {isLive ? (
                        <strong>On now</strong>
                      ) : (
                        <time dateTime={start.toISOString()}>
                          {formatTime(start)}
                        </time>
                      )}
                      <span>
                        {isLive
                          ? `${formatDuration(cell.endSec - nowOffsetSec)} left`
                          : formatDuration(cell.endSec - cell.startSec)}
                      </span>
                    </div>
                    <div className="ttv-mobile-listing-copy">
                      <h4 tabIndex={-1}>{getDisplayTitle(cell.item)}</h4>
                      <p>
                        {getDisplayType(cell.item)} · Until{" "}
                        {formatTime(dateAt(cell.endSec))}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          {page.cells.length === 0 && (
            <p className="ttv-guide-empty" role="status">
              No listings at this time. Try Now or another channel.
            </p>
          )}
          {page.remaining > 0 ? (
            <button
              type="button"
              className="ttv-mobile-load-more"
              onClick={() => {
                nextFocusIndex.current = page.cells.length;
                setLimit((value) => value + MOBILE_SCHEDULE_PAGE_SIZE);
              }}
            >
              Show more programmes
            </button>
          ) : scheduleEnd && page.cells.length > 0 ? (
            <p className="ttv-mobile-schedule-note">
              Listings through{" "}
              {mobileScheduleDay(dateAt(scheduleEnd.endSec), now).toLowerCase()}
              , {formatTime(dateAt(scheduleEnd.endSec))}.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
