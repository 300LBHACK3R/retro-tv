"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
  onTune: Tune;
}) {
  const [view, setView] = useState<"now" | "schedule">("now");
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const backRef = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const channelListRef = useRef<HTMLDivElement | null>(null);
  const channelListScroll = useRef(0);
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
                  className="ttv-mobile-channel"
                  data-current={current}
                >
                  <div className="ttv-mobile-channel-top">
                    <button
                      type="button"
                      className="ttv-mobile-open-schedule"
                      aria-label={`Schedule for ${name}`}
                      onClick={(event) => {
                        returnFocusRef.current = event.currentTarget;
                        channelListScroll.current =
                          channelListRef.current?.scrollTop ?? 0;
                        pendingFocus.current = true;
                        onChannelBrowse(channel.id);
                        setView("schedule");
                      }}
                    >
                      <span className="ttv-mobile-channel-number">
                        {getChannelLabel(channel)}
                      </span>
                      <span className="ttv-mobile-channel-name">{name}</span>
                      <span className="ttv-mobile-schedule-link">
                        Schedule <span aria-hidden="true">›</span>
                      </span>
                    </button>
                    <SaveButton
                      compact
                      kind="channel"
                      id={channel.id}
                      title={name}
                    />
                  </div>
                  <div className="ttv-mobile-channel-broadcast">
                    <div>
                      <h3>
                        {!isPrepared
                          ? "Loading schedule…"
                          : live
                            ? getDisplayTitle(live.item)
                            : "Off air"}
                      </h3>
                      <p>
                        {live
                          ? `${current ? "Your channel" : "Live"} · ${formatDuration(live.endSec - nowOffsetSec)} left`
                          : isPrepared
                            ? "Check the schedule for upcoming shows"
                            : "Just a moment"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ttv-mobile-watch"
                      disabled={!live}
                      aria-label={`Watch ${name} live`}
                      onClick={() =>
                        live && onTune({ channel, item: live.item })
                      }
                    >
                      <span aria-hidden="true">▶</span> Watch
                    </button>
                  </div>
                  {live && (
                    <div className="ttv-mobile-progress" aria-hidden="true">
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  )}
                  <p className="ttv-mobile-next">
                    {next ? (
                      <>
                        <span>
                          Next ·{" "}
                          {formatTime(
                            new Date(windowStartMs + next.startSec * 1000),
                          )}
                        </span>{" "}
                        {getDisplayTitle(next.item)}
                      </>
                    ) : isPrepared ? (
                      "No more listings available"
                    ) : (
                      "Preparing listings…"
                    )}
                  </p>
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
